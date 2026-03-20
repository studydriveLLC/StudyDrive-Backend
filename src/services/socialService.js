const User = require('../models/User');
const Post = require('../models/Post');
const Feed = require('../models/Feed');
const AppError = require('../utils/AppError');
const { feedQueue } = require('../workers/feedQueue');
const notificationService = require('./notificationService');
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
    type: 'system',
    referenceId: currentUserId,
    content: `${currentUser.pseudo} vient de s'abonner a vous.`,
    dataPayload: { screen: 'Profile', userId: currentUserId.toString() }
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
  return true;
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

  await feedQueue.add('fanout', { postId: post._id, authorId }, { 
    attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true 
  });

  await Feed.findOneAndUpdate(
    { user: authorId },
    { $push: { posts: { $each: [{ post: post._id, addedAt: new Date() }], $position: 0, $slice: 500 } } },
    { upsert: true }
  );

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
  // Nettoyage du post dans tous les feeds ou il a ete distribue
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
  return comment;
};

const deleteComment = async (userId, postId, commentId) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);

  const comment = post.comments.id(commentId);
  if (!comment) throw new AppError('Commentaire introuvable.', 404);

  // Autorise l'auteur du commentaire OU l'auteur du post a supprimer le commentaire
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
      { path: 'author', select: 'firstName lastName pseudo university avatar' },
      { path: 'comments.user', select: 'firstName lastName pseudo avatar' }
    ]
  }).lean();

  if (!feed) return [];

  return feed.posts.map(p => {
    if (!p.post) return null;
    const post = p.post;
    // Map isLikedByMe pour le frontend
    post.isLikedByMe = post.likedBy ? post.likedBy.some(id => id.toString() === userId.toString()) : false;
    delete post.likedBy; 
    return post;
  }).filter(p => p !== null);
};

module.exports = {
  followUser,
  unfollowUser,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
  incrementShares,
  getUserFeed
};