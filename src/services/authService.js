// src/services/authService.js
const User = require('../models/User');
const AppError = require('../utils/AppError');
const bcrypt = require('bcrypt');
const env = require('../config/env');

const registerUser = async (userData) => {
  // CORRECTION : On force l'email en minuscules pour la verification
  const existingUser = await User.findOne({
    $or: [
      { email: userData.email.toLowerCase() },
      { pseudo: userData.pseudo },
      { phone: userData.phone },
    ],
  }).lean();

  if (existingUser) {
    throw new AppError('Un utilisateur avec cet email, pseudo ou numero existe deja.', 409);
  }

  // Attribution automatique du role superadmin pour SUPER_ADMIN_MAIL
  const normalizedEmail = userData.email.toLowerCase();
  const isSuperAdminEmail = env.SUPER_ADMIN_MAIL &&
    normalizedEmail === env.SUPER_ADMIN_MAIL.toLowerCase();

  const userRole = isSuperAdminEmail ? 'superadmin' : (userData.role || 'user');
  const userBadgeType = isSuperAdminEmail ? 'superadmin' : (userData.badgeType || 'none');

  const newUser = await User.create({
    ...userData,
    role: userRole,
    badgeType: userBadgeType,
  });

  const userResponse = newUser.toObject();
  delete userResponse.password;

  return userResponse;
};

const loginUser = async (identifier, password) => {
  const user = await User.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { pseudo: identifier },
      { phone: identifier },
    ],
    isDeleted: { $ne: true }
  }).select('+password');

  if (!user) {
    throw new AppError('Identifiants incorrects ou compte introuvable.', 401);
  }

  let isPasswordCorrect = false;
  if (user.password) {
    isPasswordCorrect = await bcrypt.compare(password, user.password);
  }

  if (!isPasswordCorrect) {
    throw new AppError('Identifiants incorrects.', 401);
  }

  const userResponse = user.toObject();
  delete userResponse.password;

  return userResponse;
};

// NOUVEAU : Fonction de mise a jour du mot de passe
const updatePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('Utilisateur introuvable.', 404);

  const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordCorrect) throw new AppError('L\'ancien mot de passe est incorrect.', 401);

  user.password = newPassword;
  await user.save(); // Déclenchera le hook pre('save') pour hasher le nouveau mot de passe

  const userResponse = user.toObject();
  delete userResponse.password;
  return userResponse;
};

module.exports = {
  registerUser,
  loginUser,
  updatePassword // Exporter la nouvelle fonction
};