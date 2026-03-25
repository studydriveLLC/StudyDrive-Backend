//src/routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/profile', userController.getProfile);
router.patch('/updateMe', userController.updateProfile);
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);
router.get('/stats', userController.getStats);
router.delete('/delete-me', userController.deleteMe);
router.post('/request-certification', userController.requestCertification);

// NOUVEAU : Route publique pour consulter un profil.
// Placée strictement à la fin pour éviter que "profile" ou "stats" ne soient interprétés comme des IDs.
router.get('/:id', userController.getPublicProfile);

module.exports = router;