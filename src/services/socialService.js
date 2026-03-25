//src/services/socialService.js
const User = require('../models/User');
const Post = require('../models/Post');
const Feed = require('../models/Feed');
const AppError = require('../utils/AppError');
const { feedQueue } = require('../workers/feedQueue');
const notificationService = require('./notificationService');
const socketConfig = require('../config/socket');
const mongoose = require('mongoose');

const followUser = async (currentUserId, targetUserId) => {
  if (currentUserId.toString() === targetUserId.toString()) {
    throw new AppError('Vous ne pouvez pas vous suivre vous-meme.', 400);
  }

  const targetUser = await User.findByIdAndUpdate(
    targetUserId,
    { $addToSet: { followers: currentUserId } },
    { new: true }
  ).lean();

  if (!targetUser) throw new AppError('Utilisateur cible introuvable.', 404);

  const currentUser = await User.findByIdAndUpdate(
    currentUserId,
    { $addToSet: { following: targetUserId } },
    { new: true }
  ).lean();

  await notificationService.sendNotification({
    recipientId: targetUserId,
    senderId: currentUserId,
    type: 'follow',
    referenceId: currentUserId,
    content: `${currentUser.pseudo} vient de s'abonner a vous.`,
    dataPayload: { screen: 'Profile', userId: currentUserId.toString() }
  });

  socketConfig.emitToUser(targetUserId, 'follow_stats_updated', { 
    action: 'follow', 
    userId: currentUserId.toString() 
  });

  return true;
};

const unfollowUser = async (currentUserId, targetUserId) => {
  const targetUser = await User.findByIdAndUpdate(
    targetUserId,
    { $pull: { followers: currentUserId } },
    { new: true }
  );

  if (!targetUser) throw new AppError('Utilisateur cible introuvable.', 404);

  await User.findByIdAndUpdate(currentUserId, { $pull: { following: targetUserId } });
  
  socketConfig.emitToUser(targetUserId, 'follow_stats_updated', { 
    action: 'unfollow', 
    userId: currentUserId.toString() 
  });

  return true;
};

const getFollowStatus = async (currentUserId, targetUserId) => {
  const user = await User.findById(currentUserId).select('following followers').lean();
  if (!user) throw new AppError('Utilisateur introuvable.', 404);
  
  const isFollowing = user.following ? user.following.some(id => id.toString() === targetUserId.toString()) : false;
  const isFollower = user.followers ? user.followers.some(id => id.toString() === targetUserId.toString()) : false;

  return { isFollowing, isFollower };
};

const getMyFollowStats = async (userId) => {
  const user = await User.findById(userId).select('followers following').lean();
  if (!user) throw new AppError('Utilisateur introuvable.', 404);
  
  return {
    followersCount: user.followers ? user.followers.length : 0,
    followingCount: user.following ? user.following.length : 0
  };
};

const createPost = async (authorId, postData) => {
  const post = await Post.create({
    author: authorId,
    content: {
      text: postData.text,
      mediaUrls: postData.mediaUrls || [],
      mediaType: postData.mediaType
    }
  });

  await post.populate('author', 'firstName lastName pseudo university avatar badgeType');

  await feedQueue.add('fanout', { postId: post._id, authorId }, { 
    attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true 
  });

  await Feed.findOneAndUpdate(
    { user: authorId },
    { $push: { posts: { $each: [{ post: post._id, addedAt: new Date() }], $position: 0, $slice: 500 } } },
    { upsert: true }
  );

  const postObj = post.toObject();
  postObj.isLikedByMe = false;
  delete postObj.likedBy;

  return postObj;
};

const getPost = async (postId, userId) => {
  const post = await Post.findById(postId)
    .populate('author', 'firstName lastName pseudo university avatar badgeType')
    .populate('comments.user', 'firstName lastName pseudo avatar badgeType')
    .lean();

  if (!post) throw new AppError('Publication introuvable.', 404);

  post.isLikedByMe = post.likedBy ? post.likedBy.some(id => id.toString() === userId.toString()) : false;
  delete post.likedBy;
  
  return post;
};

const updatePost = async (userId, postId, updateData) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);
  if (post.author.toString() !== userId.toString()) throw new AppError('Non autorise a modifier cette publication.', 403);

  if (updateData.text !== undefined) post.content.text = updateData.text;
  if (updateData.mediaUrls !== undefined) post.content.mediaUrls = updateData.mediaUrls;
  if (updateData.mediaType !== undefined) post.content.mediaType = updateData.mediaType;

  await post.save();
  return post;
};

const deletePost = async (userId, postId) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);
  if (post.author.toString() !== userId.toString()) throw new AppError('Non autorise a supprimer cette publication.', 403);

  await Post.findByIdAndDelete(postId);
  await Feed.updateMany({ "posts.post": postId }, { $pull: { posts: { post: postId } } });
  return true;
};

const toggleLike = async (userId, postId) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);

  const isLiked = post.likedBy.includes(userId);
  if (isLiked) {
    post.likedBy.pull(userId);
    post.stats.likes = Math.max(0, post.stats.likes - 1);
  } else {
    post.likedBy.push(userId);
    post.stats.likes += 1;

    if (post.author.toString() !== userId.toString()) {
      await notificationService.sendNotification({
        recipientId: post.author, senderId: userId, type: 'system', referenceId: post._id,
        content: `A aime votre publication.`, dataPayload: { screen: 'PostDetail', postId: post._id.toString() }
      });
    }
  }

  await post.save();
  return { isLiked: !isLiked, likesCount: post.stats.likes };
};

const addComment = async (userId, postId, text) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);

  post.comments.push({ user: userId, text });
  post.stats.comments += 1;
  await post.save();

  await post.populate('comments.user', 'firstName lastName pseudo avatar badgeType');

  if (post.author.toString() !== userId.toString()) {
    await notificationService.sendNotification({
      recipientId: post.author, senderId: userId, type: 'system', referenceId: post._id,
      content: `A commente votre publication.`, dataPayload: { screen: 'PostDetail', postId: post._id.toString() }
    });
  }

  return post.comments[post.comments.length - 1];
};

const updateComment = async (userId, postId, commentId, text) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);

  const comment = post.comments.id(commentId);
  if (!comment) throw new AppError('Commentaire introuvable.', 404);
  if (comment.user.toString() !== userId.toString()) throw new AppError('Non autorise a modifier ce commentaire.', 403);

  comment.text = text;
  await post.save();
  
  await post.populate('comments.user', 'firstName lastName pseudo avatar badgeType');
  return comment;
};

const deleteComment = async (userId, postId, commentId) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);

  const comment = post.comments.id(commentId);
  if (!comment) throw new AppError('Commentaire introuvable.', 404);

  if (comment.user.toString() !== userId.toString() && post.author.toString() !== userId.toString()) {
    throw new AppError('Non autorise a supprimer ce commentaire.', 403);
  }

  post.comments.pull(commentId);
  post.stats.comments = Math.max(0, post.stats.comments - 1);
  await post.save();
  return true;
};

const incrementShares = async (postId) => {
  const post = await Post.findByIdAndUpdate(postId, { $inc: { 'stats.shares': 1 } }, { new: true });
  if (!post) throw new AppError('Publication introuvable.', 404);
  return post.stats.shares;
};

const getUserFeed = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const feed = await Feed.findOne(
    { user: userId },
    { posts: { $slice: [skip, limit] } }
  ).populate({
    path: 'posts.post',
    populate: [
      { path: 'author', select: 'firstName lastName pseudo university avatar badgeType' },
      { path: 'comments.user', select: 'firstName lastName pseudo avatar badgeType' }
    ]
  }).lean();

  if (!feed) return [];

  return feed.posts.map(p => {
    if (!p.post) return null;
    const post = p.post;
    post.isLikedByMe = post.likedBy ? post.likedBy.some(id => id.toString() === userId.toString()) : false;
    delete post.likedBy; 
    return post;
  }).filter(p => p !== null);
};

const getUserSpecificPosts = async (userId, targetUserId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  
  const posts = await Post.find({ author: targetUserId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'firstName lastName pseudo university avatar badgeType')
    .populate('comments.user', 'firstName lastName pseudo avatar badgeType')
    .lean();

  return posts.map(post => {
    post.isLikedByMe = post.likedBy ? post.likedBy.some(id => id.toString() === userId.toString()) : false;
    delete post.likedBy;
    return post;
  });
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowStatus,
  getMyFollowStats,
  createPost,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
  incrementShares,
  getUserFeed,
  getUserSpecificPosts
};