const User = require('../models/User');
const Post = require('../models/Post');
const Document = require('../models/Document');
const CertificationRequest = require('../models/CertificationRequest');
const AppError = require('../utils/AppError');

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('-password').lean();
  if (!user) {
    throw new AppError('Utilisateur introuvable.', 404);
  }
  return user;
};

const updateUserProfile = async (userId, data) => {
  const allowedFields = ['avatar', 'university', 'phone', 'firstName', 'lastName'];
  const updateData = {};

  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key)) {
      updateData[key] = data[key];
    }
  });

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select('-password').lean();

  if (!updatedUser) {
    throw new AppError('Utilisateur introuvable lors de la mise à jour.', 404);
  }

  return updatedUser;
};

const getUserStats = async (userId) => {
  const [postsCount, documentsCount] = await Promise.all([
    Post.countDocuments({ author: userId }),
    Document.countDocuments({ author: userId })
  ]);

  return {
    posts: postsCount,
    documents: documentsCount
  };
};

const deleteAccount = async (userId, mode = 'deactivate') => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new AppError('Utilisateur introuvable.', 404);
  }

  if (user.role === 'superadmin') {
    throw new AppError('Le compte Super Administrateur ne peut pas être supprimé via cette route.', 403);
  }

  if (mode === 'hard') {
    // Suppression définitive et nettoyage en cascade
    await Promise.all([
      Post.deleteMany({ author: userId }),
      Document.deleteMany({ author: userId }),
      User.findByIdAndDelete(userId)
    ]);
    return { message: 'Compte et données associées supprimés définitivement.' };
  } else {
    // Ta logique originale de soft delete préservée
    await User.findByIdAndUpdate(userId, {
      isActive: false,
      isDeleted: true,
      deletedAt: Date.now(),
      fcmTokens: [],
    });
    return { message: 'Compte supprimé avec succès.' };
  }
};

const submitCertificationRequest = async (userId) => {
  const existingRequest = await CertificationRequest.findOne({ user: userId });

  if (existingRequest && existingRequest.status === 'pending') {
    throw new AppError('Vous avez déjà une demande en cours de traitement.', 400);
  }

  if (existingRequest && existingRequest.status === 'approved') {
    throw new AppError('Vous êtes déjà certifié.', 400);
  }

  if (existingRequest && existingRequest.status === 'rejected') {
    existingRequest.status = 'pending';
    existingRequest.adminNotes = '';
    existingRequest.processedBy = undefined;
    existingRequest.processedAt = undefined;
    await existingRequest.save();
    return existingRequest;
  }

  const newRequest = await CertificationRequest.create({ user: userId });
  return newRequest;
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserStats,
  deleteAccount,
  submitCertificationRequest
};