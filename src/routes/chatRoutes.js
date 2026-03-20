const express = require('express');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/conversations', chatController.startConversation);
router.get('/conversations', chatController.getMyConversations);

router.get('/conversations/:conversationId/messages', chatController.getConversationMessages);
router.post('/conversations/:conversationId/messages', chatController.postMessage);

// Nouvelle route pour la suppression de message
router.delete('/conversations/:conversationId/messages/:messageId', chatController.removeMessage);

module.exports = router;