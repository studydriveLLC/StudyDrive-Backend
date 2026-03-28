const User = require('../models/User');
const Post = require('../models/Post');
const Resource = require('../models/Resource');
const CertificationRequest = require('../models/CertificationRequest');
const Report = require('../models/Report'); // NOUVEAU MODELE
const AppError = require('../utils/AppError');

// --- Gestion des Administrateurs (Exclusif Super Admin) ---

const promoteToAdmin = async (targetUserId) => {
  const user = await User.findById(targetUserId);
  if (!user) throw new AppError('Utilisateur introuvable.', 404);
  if (user.role === 'admin' || user.role === 'superadmin') {
    throw new AppError('Cet utilisateur possede deja des privileges d\'administration.', 400);
  }

  user.previousBadgeType = user.badgeType;
  user.role = 'admin';
  user.badgeType = 'admin';
  await user.save();

  return user.toJSON();
};

const revokeAdmin = async (targetUserId) => {
  const user = await User.findById(targetUserId);
  if (!user) throw new AppError('Utilisateur introuvable.', 404);
  if (user.role !== 'admin') {
    throw new AppError('Cet utilisateur n\'est pas un administrateur classique.', 400);
  }

  user.role = 'user';
  user.badgeType = user.previousBadgeType || 'none';
  user.previousBadgeType = 'none';
  await user.save();

  return user.toJSON();
};

// --- Modération des Utilisateurs ---

const getAllUsers = async (filters = {}) => {
  const query = { role: { $ne: 'superadmin' }, ...filters };
  return await User.find(query).select('-password').sort({ createdAt: -1 }).lean();
};

const moderateUser = async (targetUserId, action) => {
  const user = await User.findById(targetUserId);
  if (!user) throw new AppError('Utilisateur introuvable.', 404);
  if (user.role === 'superadmin') throw new AppError('Action impossible sur le Super Administrateur.', 403);

  if (action === 'ban') {
    user.isActive = false;
  } else if (action === 'unban') {
    user.isActive = true;
  }
  
  await user.save();
  return { id: user._id, isActive: user.isActive };
};

// --- Modération du Contenu ---

const deleteAnyPost = async (postId) => {
  const post = await Post.findByIdAndDelete(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);
  return true;
};

const deleteAnyComment = async (postId, commentId) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('Publication introuvable.', 404);

  const comment = post.comments.id(commentId);
  if (!comment) throw new AppError('Commentaire introuvable.', 404);

  post.comments.pull(commentId);
  post.stats.comments = Math.max(0, post.stats.comments - 1);
  await post.save();
  return true;
};

const deleteAnyResource = async (resourceId) => {
  const resource = await Resource.findByIdAndDelete(resourceId);
  if (!resource) throw new AppError('Ressource introuvable.', 404);
  return true;
};

// --- Gestion des Signalements (NOUVEAU) ---

const getAllReports = async (statusFilter = 'pending') => {
  const query = statusFilter !== 'all' ? { status: statusFilter } : {};
  return await Report.find(query)
    .populate('reporter', 'firstName lastName pseudo email')
    .populate({
      path: 'reportedPost',
      populate: { path: 'author', select: 'firstName lastName pseudo' }
    })
    .sort({ createdAt: -1 })
    .lean();
};

const resolveReport = async (reportId, action) => {
  const report = await Report.findById(reportId);
  if (!report) throw new AppError('Signalement introuvable.', 404);

  // action: 'dismiss' (ignorer) ou 'delete_post' (supprimer le post signalé)
  if (action === 'delete_post') {
    await Post.findByIdAndDelete(report.reportedPost);
    report.status = 'resolved';
  } else if (action === 'dismiss') {
    report.status = 'reviewed';
  } else {
    throw new AppError('Action invalide.', 400);
  }

  await report.save();
  return report;
};

// --- Gestion des Certifications ---

const getPendingCertifications = async () => {
  return await CertificationRequest.find({ status: 'pending' })
    .populate('user', 'firstName lastName pseudo university avatar')
    .sort({ createdAt: 1 })
    .lean();
};

const processCertification = async (requestId, adminId, status, adminNotes = '') => {
  if (!['approved', 'rejected'].includes(status)) {
    throw new AppError('Statut de certification invalide.', 400);
  }

  const request = await CertificationRequest.findById(requestId).populate('user');
  if (!request) throw new AppError('Demande introuvable.', 404);
  if (request.status !== 'pending') throw new AppError('Cette demande a deja ete traitee.', 400);

  request.status = status;
  request.processedBy = adminId;
  request.processedAt = Date.now();
  request.adminNotes = adminNotes;
  await request.save();

  if (status === 'approved') {
    const user = request.user;
    if (user.role === 'admin' || user.role === 'superadmin') {
      user.previousBadgeType = 'certified';
    } else {
      user.badgeType = 'certified';
    }
    await user.save();
  }

  return request;
};

module.exports = {
  promoteToAdmin,
  revokeAdmin,
  getAllUsers,
  moderateUser,
  deleteAnyPost,
  deleteAnyComment,
  deleteAnyResource,
  getAllReports,       // NOUVEAU
  resolveReport,       // NOUVEAU
  getPendingCertifications,
  processCertification
};