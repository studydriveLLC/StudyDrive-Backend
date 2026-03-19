const User = require('../models/User');
const AppError = require('../utils/AppError');
// Importe bcrypt ou bcryptjs selon ce que tu as installé dans ton package.json backend
const bcrypt = require('bcrypt'); 

const registerUser = async (userData) => {
  // Verification de l'existence prealable (email, pseudo ou telephone)
  const existingUser = await User.findOne({
    $or: [
      { email: userData.email },
      { pseudo: userData.pseudo },
      { phone: userData.phone },
    ],
  }).lean();

  if (existingUser) {
    throw new AppError('Un utilisateur avec cet email, pseudo ou numero existe deja.', 409);
  }

  // Creation de l'utilisateur (le mot de passe sera hache par le hook Mongoose)
  const newUser = await User.create(userData);

  // On retire le mot de passe de l'objet renvoye
  const userResponse = newUser.toObject();
  delete userResponse.password;

  return userResponse;
};

const loginUser = async (identifier, password) => {
  // 1. Recherche : On inclut le mot de passe ET on exclut les comptes supprimes
  const user = await User.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { pseudo: identifier },
      { phone: identifier },
    ],
    isDeleted: { $ne: true } // 🔒 SECURITE : Bloque les comptes "soft-deleted"
  }).select('+password');

  // Si on ne trouve personne (ou si le compte est supprime), on rejette
  if (!user) {
    throw new AppError('Identifiants incorrects ou compte introuvable.', 401);
  }

  // 2. Verification du mot de passe (Crash Proof 🛡️)
  // On utilise bcrypt directement pour eviter les erreurs de methodes Mongoose manquantes
  let isPasswordCorrect = false;
  
  if (user.password) {
    // Si tu utilises bcrypt au lieu de bcryptjs, change juste l'import en haut
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