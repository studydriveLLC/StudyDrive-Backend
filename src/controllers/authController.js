// src/controllers/authController.js
const authService = require('../services/authService');
const tokenService = require('../services/tokenService');
const env = require('../config/env');
const catchAsync = require('../utils/catchAsync');

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, 
};

const register = async (req, res) => {
  const user = await authService.registerUser(req.body);
  const tokens = tokenService.generateAuthTokens(user._id);

  res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

  res.status(201).json({
    status: 'success',
    data: {
      user,
      accessToken: tokens.accessToken,
    },
  });
};

const login = async (req, res) => {
  const { identifier, password } = req.body;
  
  const user = await authService.loginUser(identifier, password);
  const tokens = tokenService.generateAuthTokens(user._id);

  res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

  res.status(200).json({
    status: 'success',
    data: {
      user,
      accessToken: tokens.accessToken,
    },
  });
};

const logout = (req, res) => {
  res.cookie('refreshToken', 'loggedout', {
    ...cookieOptions,
    maxAge: 10 * 1000,
  });

  res.status(200).json({ status: 'success' });
};

// NOUVEAU : Changement de mot de passe
const updateMyPassword = async (req, res) => {
  const { currentPassword, password } = req.body;
  const user = await authService.updatePassword(req.user._id, currentPassword, password);
  
  // Générer de nouveaux tokens pour ne pas déconnecter l'utilisateur après le changement
  const tokens = tokenService.generateAuthTokens(user._id);
  res.cookie('refreshToken', tokens.refreshToken, cookieOptions);
  
  res.status(200).json({ 
    status: 'success', 
    data: { user, accessToken: tokens.accessToken } 
  });
};

const refreshToken = async (req, res) => {
  const currentRefreshToken = req.cookies.refreshToken;

  if (!currentRefreshToken) {
    return res.status(401).json({ 
      status: 'fail', 
      message: 'Refresh token manquant. Veuillez vous reconnecter.' 
    });
  }

  try {
    const decoded = tokenService.verifyRefreshToken(currentRefreshToken);
    const tokens = tokenService.generateAuthTokens(decoded.id);

    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    res.cookie('refreshToken', 'loggedout', {
      ...cookieOptions,
      maxAge: 10 * 1000,
    });
    return res.status(401).json({ 
      status: 'fail', 
      message: 'Refresh token invalide ou expiré. Veuillez vous reconnecter.' 
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  updateMyPassword, // Exporter la nouvelle fonction
  refreshToken,
};