// src/routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const authValidation = require('../validations/authValidation');
const catchAsync = require('../utils/catchAsync');
const authMiddleware = require('../middlewares/authMiddleware'); // NOUVEAU : Besoin pour protéger la route mdp

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

router.post('/refresh', catchAsync(authController.refreshToken));

// NOUVEAU : Route protégée pour mettre à jour le mot de passe
router.patch('/updateMyPassword', authMiddleware.protect, catchAsync(authController.updateMyPassword));

module.exports = router;