const adminService = require('../services/adminService');

// --- Exclusif Super Admin ---
const grantAdmin = async (req, res, next) => {
  try {
    const user = await adminService.promoteToAdmin(req.params.userId);
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) { next(error); }
};

const removeAdmin = async (req, res, next) => {
  try {
    const user = await adminService.revokeAdmin(req.params.userId);
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) { next(error); }
};

// --- Modération Utilisateurs ---
const getUsersList = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers(req.query);
    res.status(200).json({ status: 'success', results: users.length, data: { users } });
  } catch (error) { next(error); }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { action } = req.body; // 'ban' ou 'unban'
    const user = await adminService.moderateUser(req.params.userId, action);
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) { next(error); }
};

// --- Modération Contenu ---
const forceDeletePost = async (req, res, next) => {
  try {
    await adminService.deleteAnyPost(req.params.postId);
    res.status(200).json({ status: 'success', message: 'Publication supprimee par moderation.' });
  } catch (error) { next(error); }
};

const forceDeleteComment = async (req, res, next) => {
  try {
    await adminService.deleteAnyComment(req.params.postId, req.params.commentId);
    res.status(200).json({ status: 'success', message: 'Commentaire supprime par moderation.' });
  } catch (error) { next(error); }
};

const forceDeleteResource = async (req, res, next) => {
  try {
    await adminService.deleteAnyResource(req.params.resourceId);
    res.status(200).json({ status: 'success', message: 'Ressource supprimee par moderation.' });
  } catch (error) { next(error); }
};

// --- Certifications ---
const listPendingCertifications = async (req, res, next) => {
  try {
    const requests = await adminService.getPendingCertifications();
    res.status(200).json({ status: 'success', results: requests.length, data: { requests } });
  } catch (error) { next(error); }
};

const resolveCertification = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const request = await adminService.processCertification(req.params.requestId, req.user._id, status, adminNotes);
    res.status(200).json({ status: 'success', data: { request } });
  } catch (error) { next(error); }
};

module.exports = {
  grantAdmin,
  removeAdmin,
  getUsersList,
  toggleUserStatus,
  forceDeletePost,
  forceDeleteComment,
  forceDeleteResource,
  listPendingCertifications,
  resolveCertification
};