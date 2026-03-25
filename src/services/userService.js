//src/services/userService.js
const User = require('../models/User');
const Post = require('../models/Post');
const Document = require('../models/Document');
const CertificationRequest = require('../models/CertificationRequest');
const AppError = require('../utils/AppError');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('-password').lean();
  if (!user) {
    throw new AppError('Utilisateur introuvable.', 404);
  }
  return user;
};

// NOUVEAU : Fonction sécurisée pour le profil public
const getPublicUserProfile = async (targetUserId) => {
  const user = await User.findById(targetUserId)
    .select('-password -fcmTokens -email -phone')
    .lean();
    
  if (!user) {
    throw new AppError('Utilisateur introuvable.', 404);
  }

  const [postsCount, documentsCount] = await Promise.all([
    Post.countDocuments({ author: targetUserId }),
    Document.countDocuments({ $or: [{ author: targetUserId }, { uploadedBy: targetUserId }] })
  ]);

  return {
    ...user,
    publicStats: {
      posts: postsCount,
      documents: documentsCount
    }
  };
};

const updateUserProfile = async (userId, data) => {
  const allowedFields = ['avatar', 'university', 'phone', 'firstName', 'lastName', 'pseudo', 'bio'];
  const updateData = {};

  if (data.pseudo) {
    const existingUser = await User.findOne({ pseudo: data.pseudo, _id: { $ne: userId } }).lean();
    if (existingUser) {
      throw new AppError('Ce pseudo est déjà utilisé par un autre membre.', 409);
    }
  }

  if (data.phone) {
    const existingPhone = await User.findOne({ phone: data.phone, _id: { $ne: userId } }).lean();
    if (existingPhone) {
      throw new AppError('Ce numéro de téléphone est déjà utilisé.', 409);
    }
  }

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

const uploadUserAvatar = async (userId, file) => {
  if (!file) {
    throw new AppError('Aucun fichier image fourni.', 400);
  }

  try {
    const cloudinaryResult = await cloudinary.uploader.upload(file.path, {
      folder: 'LokoNet_avatars',
      transformation: [{ width: 500, height: 500, crop: 'fill' }]
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar: cloudinaryResult.secure_url },
      { new: true }
    ).select('-password');

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return updatedUser;
  } catch (error) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new AppError('Erreur lors de la sauvegarde de l\'image.', 500);
  }
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
    await Promise.all([
      Post.deleteMany({ author: userId }),
      Document.deleteMany({ author: userId }),
      User.findByIdAndDelete(userId)
    ]);
    return { message: 'Compte et données associées supprimés définitivement.' };
  } else {
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
  getPublicUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  getUserStats,
  deleteAccount,
  submitCertificationRequest
};