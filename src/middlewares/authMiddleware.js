const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const AppError = require('../utils/AppError');

exports.protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Vous n\'etes pas connecte. Veuillez vous connecter pour acceder a cette ressource.', 401));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return next(new AppError('L\'utilisateur possedant ce token n\'existe plus.', 401));
    }

    if (!currentUser.isActive) {
      return next(new AppError('Ce compte a ete desactive.', 403));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    return next(new AppError('Token invalide ou expire.', 401));
  }
};

exports.authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return next(new AppError('Acces refuse. Droits d\'administrateur requis.', 403));
  }
  next();
};

exports.authorizeSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return next(new AppError('Acces refuse. Seul le Super Administrateur peut effectuer cette action.', 403));
  }
  next();
};