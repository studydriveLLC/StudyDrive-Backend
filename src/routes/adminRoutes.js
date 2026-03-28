const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, authorizeAdmin, authorizeSuperAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/users/:userId/promote', authorizeSuperAdmin, adminController.grantAdmin);
router.post('/users/:userId/revoke', authorizeSuperAdmin, adminController.removeAdmin);

router.use(authorizeAdmin);

router.get('/users', adminController.getUsersList);
router.post('/users/:userId/status', adminController.toggleUserStatus);

router.delete('/posts/:postId', adminController.forceDeletePost);
router.delete('/posts/:postId/comments/:commentId', adminController.forceDeleteComment);
router.delete('/resources/:resourceId', adminController.forceDeleteResource);

// NOUVEAU : Routes pour les signalements
router.get('/reports', adminController.listReports);
router.post('/reports/:reportId/process', adminController.processReport);

router.get('/certifications', adminController.listPendingCertifications);
router.post('/certifications/:requestId/resolve', adminController.resolveCertification);

module.exports = router;