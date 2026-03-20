const userService = require('../services/userService');
const env = require('../config/env');

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 10 * 1000, 
};

const getProfile = async (req, res, next) => {
  try {
    const user = await userService.getUserProfile(req.user._id);
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateUserProfile(req.user._id, req.body);
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const stats = await userService.getUserStats(req.user._id);
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

const deleteMe = async (req, res, next) => {
  try {
    const mode = req.body.mode || 'deactivate';
    const result = await userService.deleteAccount(req.user._id, mode);

    res.cookie('refreshToken', 'loggedout', cookieOptions);

    res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

const requestCertification = async (req, res, next) => {
  try {
    const request = await userService.submitCertificationRequest(req.user._id);

    res.status(201).json({
      status: 'success',
      data: { request }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getStats,
  deleteMe,
  requestCertification
};