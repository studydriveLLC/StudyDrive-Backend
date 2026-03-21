const express = require('express');
const authController = require('../controllers/authController');
const authValidation = require('../validations/authValidation');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

router.post(
  '/register',
  authValidation.validate(authValidation.registerSchema),
  catchAsync(authController.register)
);

router.post(
  '/login',
  authValidation.validate(authValidation.loginSchema),
  catchAsync(authController.login)
);

router.post('/logout', authController.logout);

// Nouvelle route pour le rafraîchissement silencieux du token
router.post('/refresh', catchAsync(authController.refreshToken));

module.exports = router;