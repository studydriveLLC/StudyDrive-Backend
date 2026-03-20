const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, authorizeAdmin, authorizeSuperAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Toute route admin necessite d'etre connecte
router.use(protect);

 
router.post('/users/:userId/promote', authorizeSuperAdmin, adminController.grantAdmin);
router.post('/users/:userId/revoke', authorizeSuperAdmin, adminController.removeAdmin);

router.use(authorizeAdmin);

// Gestion des utilisateurs
router.get('/users', adminController.getUsersList);
router.post('/users/:userId/status', adminController.toggleUserStatus);

// Moderation du contenu
router.delete('/posts/:postId', adminController.forceDeletePost);
router.delete('/posts/:postId/comments/:commentId', adminController.forceDeleteComment);
router.delete('/resources/:resourceId', adminController.forceDeleteResource);

// Demandes de certification
router.get('/certifications', adminController.listPendingCertifications);
router.post('/certifications/:requestId/resolve', adminController.resolveCertification);

module.exports = router;