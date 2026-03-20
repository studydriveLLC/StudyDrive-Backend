const chatService = require('../services/chatService');

const startConversation = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    const conversation = await chatService.getOrCreateConversation(req.user._id, targetUserId);
    
    res.status(200).json({
      status: 'success',
      data: { conversation }
    });
  } catch (error) {
    next(error);
  }
};

const getMyConversations = async (req, res, next) => {
  try {
    const conversations = await chatService.getUserConversations(req.user._id);
    
    res.status(200).json({
      status: 'success',
      results: conversations.length,
      data: { conversations }
    });
  } catch (error) {
    next(error);
  }
};

const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const messages = await chatService.getMessages(conversationId, req.user._id, page, limit);

    await chatService.markConversationAsRead(conversationId, req.user._id);

    res.status(200).json({
      status: 'success',
      results: messages.length,
      data: { messages }
    });
  } catch (error) {
    next(error);
  }
};

const postMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    const message = await chatService.sendMessage(req.user._id, conversationId, content);

    res.status(201).json({
      status: 'success',
      data: { message }
    });
  } catch (error) {
    next(error);
  }
};

const removeMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    
    await chatService.deleteMessage(req.user._id, conversationId, messageId);

    res.status(200).json({
      status: 'success',
      message: 'Message supprime avec succes.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startConversation,
  getMyConversations,
  getConversationMessages,
  postMessage,
  removeMessage
};