const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const AppError = require('../utils/AppError');
const socketConfig = require('../config/socket');

const getOrCreateConversation = async (currentUserId, targetUserId) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [currentUserId, targetUserId], $size: 2 }
  }).populate('participants', 'firstName lastName pseudo');

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [currentUserId, targetUserId],
      unreadCounts: {
        [currentUserId.toString()]: 0,
        [targetUserId.toString()]: 0
      }
    });
    conversation = await conversation.populate('participants', 'firstName lastName pseudo');
  }

  return conversation;
};

const getUserConversations = async (userId) => {
  return await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .populate('participants', 'firstName lastName pseudo')
    .lean();
};

const getMessages = async (conversationId, userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId }).lean();
  if (!conversation) {
    throw new AppError('Acces refuse a cette conversation.', 403);
  }

  return await Message.find({ conversationId })
    .sort({ createdAt: -1 }) 
    .skip(skip)
    .limit(limit)
    .populate('sender', 'firstName lastName pseudo')
    .lean();
};

const sendMessage = async (senderId, conversationId, content) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.includes(senderId)) {
    throw new AppError('Conversation invalide.', 400);
  }

  const message = await Message.create({
    conversationId,
    sender: senderId,
    content
  });

  const messagePopulated = await message.populate('sender', 'firstName lastName pseudo');

  const receiverId = conversation.participants.find(p => p.toString() !== senderId.toString());
  
  const currentUnread = conversation.unreadCounts.get(receiverId.toString()) || 0;
  conversation.unreadCounts.set(receiverId.toString(), currentUnread + 1);
  conversation.lastMessage = {
    text: content,
    sender: senderId,
    createdAt: message.createdAt
  };
  await conversation.save();

  const io = socketConfig.getIo();
  if (io) {
    io.to(conversationId.toString()).emit('new_message', messagePopulated);
  }

  socketConfig.emitToUser(receiverId, 'notification_badge', { 
    type: 'message', 
    conversationId 
  });

  return messagePopulated;
};

const markConversationAsRead = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (conversation && conversation.participants.includes(userId)) {
    conversation.unreadCounts.set(userId.toString(), 0);
    await conversation.save();

    await Message.updateMany(
      { conversationId, sender: { $ne: userId }, status: { $ne: 'read' } },
      { $set: { status: 'read' } }
    );
  }
  return true;
};

const deleteMessage = async (userId, conversationId, messageId) => {
  const message = await Message.findOne({ _id: messageId, conversationId });
  
  if (!message) {
    throw new AppError('Message introuvable.', 404);
  }

  if (message.sender.toString() !== userId.toString()) {
    throw new AppError('Vous n\'etes pas autorise a supprimer ce message.', 403);
  }

  await Message.findByIdAndDelete(messageId);

  // Temps Reel: Notifier les clients pour retirer la bulle de discussion
  const io = socketConfig.getIo();
  if (io) {
    io.to(conversationId.toString()).emit('message_deleted', { messageId });
  }

  return true;
};

module.exports = {
  getOrCreateConversation,
  getUserConversations,
  getMessages,
  sendMessage,
  markConversationAsRead,
  deleteMessage
};