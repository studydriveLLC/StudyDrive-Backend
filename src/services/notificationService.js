//src/services/notificationService.js
const firebaseAdmin = require('../config/firebase');
const Notification = require('../models/Notification');
const User = require('../models/User');
const socketConfig = require('../config/socket');
const logger = require('../config/logger');

const sendNotification = async ({ recipientId, senderId, type, referenceId, content, dataPayload }) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      referenceId,
      content,
      dataPayload
    });

    socketConfig.emitToUser(recipientId, 'new_notification', notification);

    if (firebaseAdmin) {
      const recipient = await User.findById(recipientId).select('fcmTokens').lean();
      
      if (recipient && recipient.fcmTokens && recipient.fcmTokens.length > 0) {
        const message = {
          notification: {
            title: 'LokoNet',
            body: content,
          },
          data: {
            type,
            referenceId: referenceId.toString(),
            ...dataPayload 
          },
          tokens: recipient.fcmTokens, 
        };

        const response = await firebaseAdmin.messaging().sendMulticast(message);
        
        if (response.failureCount > 0) {
          const failedTokens = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error.code === 'messaging/registration-token-not-registered') {
              failedTokens.push(recipient.fcmTokens[idx]);
            }
          });

          if (failedTokens.length > 0) {
            await User.findByIdAndUpdate(recipientId, {
              $pull: { fcmTokens: { $in: failedTokens } }
            });
            logger.info(`Nettoyage de ${failedTokens.length} tokens FCM obsoletes pour l'utilisateur ${recipientId}`);
          }
        }
      }
    }

    return notification;
  } catch (error) {
    logger.error('Erreur dans notificationService:', error);
  }
};

const getUserNotifications = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  return await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'firstName lastName pseudo')
    .lean();
};

const markAsRead = async (notificationId, userId) => {
  await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true }
  );
  return true;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true }
  );
  return true;
};

const deleteNotification = async (notificationId, userId) => {
  await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  return true;
};

const deleteMultipleNotifications = async (notificationIds, userId) => {
  await Notification.deleteMany({ _id: { $in: notificationIds }, recipient: userId });
  return true;
};

const deleteAllNotifications = async (userId) => {
  await Notification.deleteMany({ recipient: userId });
  return true;
};

const registerDeviceToken = async (userId, fcmToken) => {
  await User.findByIdAndUpdate(
    userId,
    { $addToSet: { fcmTokens: fcmToken } }
  );
  return true;
};

const unregisterDeviceToken = async (userId, fcmToken) => {
  await User.findByIdAndUpdate(
    userId,
    { $pull: { fcmTokens: fcmToken } }
  );
  return true;
};

module.exports = {
  sendNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  deleteAllNotifications,
  registerDeviceToken,
  unregisterDeviceToken
};