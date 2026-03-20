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

// Les try/catch sont gérés par catchAsync dans le routeur
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

module.exports = {
  register,
  login,
  logout,
};