// src/routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware'); // NOUVEAU : Import pour gérer l'upload d'image

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/profile', userController.getProfile);
// CORRECTION : Changement de /profile à /updateMe pour matcher le Frontend
router.patch('/updateMe', userController.updateProfile);
// NOUVEAU : Route pour uploader l'avatar
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);

router.get('/stats', userController.getStats);

router.delete('/delete-me', userController.deleteMe);
router.post('/request-certification', userController.requestCertification);

module.exports = router;