//src/routes/notificationRoutes.js
const express = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/register-token', notificationController.registerToken);
router.post('/unregister-token', notificationController.unregisterToken);

router.get('/unread-count', notificationController.getUnreadCount);
router.get('/', notificationController.getMyNotifications);

router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markNotificationRead);

router.delete('/all', notificationController.deleteAll);
// On utilise POST pour bulk-delete afin d'eviter le blocage des body en DELETE par certains proxies
router.post('/bulk-delete', notificationController.deleteMultiple);
router.delete('/:id', notificationController.deleteOne);

module.exports = router;