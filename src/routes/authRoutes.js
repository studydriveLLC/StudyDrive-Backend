const express = require('express');
const authController = require('../controllers/authController');
const authValidation = require('../validations/authValidation');
const catchAsync = require('../utils/catchAsync'); // IMPORT CRITIQUE

const router = express.Router();

router.post(
  '/register',
  authValidation.validate(authValidation.registerSchema),
  catchAsync(authController.register) // ENCAPSULATION
);

router.post(
  '/login',
  authValidation.validate(authValidation.loginSchema),
  catchAsync(authController.login) // ENCAPSULATION
);

router.post('/logout', authController.logout);

module.exports = router;