//src/controllers/socialController.js
const socialService = require('../services/socialService');

const follow = async (req, res, next) => {
  try {
    await socialService.followUser(req.user._id, req.params.targetId);
    res.status(200).json({ status: 'success', message: 'Utilisateur suivi avec succes.' });
  } catch (error) { next(error); }
};

const unfollow = async (req, res, next) => {
  try {
    await socialService.unfollowUser(req.user._id, req.params.targetId);
    res.status(200).json({ status: 'success', message: 'Utilisateur desabonne avec succes.' });
  } catch (error) { next(error); }
};

const getFollowStatus = async (req, res, next) => {
  try {
    const data = await socialService.getFollowStatus(req.user._id, req.params.targetId);
    res.status(200).json({ status: 'success', data });
  } catch (error) { next(error); }
};

const getMyFollowStats = async (req, res, next) => {
  try {
    const data = await socialService.getMyFollowStats(req.user._id);
    res.status(200).json({ status: 'success', data });
  } catch (error) { next(error); }
};

const createPost = async (req, res, next) => {
  try {
    const post = await socialService.createPost(req.user._id, req.body);
    res.status(201).json({ status: 'success', data: { post } });
  } catch (error) { next(error); }
};

const getPost = async (req, res, next) => {
  try {
    const post = await socialService.getPost(req.params.postId, req.user._id);
    res.status(200).json({ status: 'success', data: { post } });
  } catch (error) { next(error); }
};

const updatePost = async (req, res, next) => {
  try {
    const post = await socialService.updatePost(req.user._id, req.params.postId, req.body);
    res.status(200).json({ status: 'success', data: { post } });
  } catch (error) { next(error); }
};

const deletePost = async (req, res, next) => {
  try {
    await socialService.deletePost(req.user._id, req.params.postId);
    res.status(200).json({ status: 'success', message: 'Publication supprimee.' });
  } catch (error) { next(error); }
};

const toggleLike = async (req, res, next) => {
  try {
    const result = await socialService.toggleLike(req.user._id, req.params.postId);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) { next(error); }
};

const addComment = async (req, res, next) => {
  try {
    const comment = await socialService.addComment(req.user._id, req.params.postId, req.body.text);
    res.status(201).json({ status: 'success', data: { comment } });
  } catch (error) { next(error); }
};

const updateComment = async (req, res, next) => {
  try {
    const comment = await socialService.updateComment(req.user._id, req.params.postId, req.params.commentId, req.body.text);
    res.status(200).json({ status: 'success', data: { comment } });
  } catch (error) { next(error); }
};

const deleteComment = async (req, res, next) => {
  try {
    await socialService.deleteComment(req.user._id, req.params.postId, req.params.commentId);
    res.status(200).json({ status: 'success', message: 'Commentaire supprime.' });
  } catch (error) { next(error); }
};

const incrementShares = async (req, res, next) => {
  try {
    const sharesCount = await socialService.incrementShares(req.params.postId);
    res.status(200).json({ status: 'success', data: { shares: sharesCount } });
  } catch (error) { next(error); }
};

const getFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const posts = await socialService.getUserFeed(req.user._id, page, limit);

    res.status(200).json({ status: 'success', results: posts.length, data: { posts } });
  } catch (error) { next(error); }
};

// NOUVEAU: Controlleur pour recuperer les posts d'un utilisateur specifique
const getUserPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const posts = await socialService.getUserSpecificPosts(req.user._id, req.params.userId, page, limit);

    res.status(200).json({ status: 'success', results: posts.length, data: { posts } });
  } catch (error) { next(error); }
};

module.exports = {
  follow,
  unfollow,
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
  getFeed,
  getUserPosts // EXPORT DE LA NOUVELLE METHODE
};