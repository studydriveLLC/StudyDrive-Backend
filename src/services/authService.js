const User = require('../models/User');
const AppError = require('../utils/AppError');
const bcrypt = require('bcrypt'); 

const registerUser = async (userData) => {
  // CORRECTION : On force l'email en minuscules pour la vérification
  const existingUser = await User.findOne({
    $or: [
      { email: userData.email.toLowerCase() }, 
      { pseudo: userData.pseudo },
      { phone: userData.phone },
    ],
  }).lean();

  if (existingUser) {
    throw new AppError('Un utilisateur avec cet email, pseudo ou numéro existe déjà.', 409);
  }

  const newUser = await User.create(userData);

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

module.exports = {
  registerUser,
  loginUser,
};