//src/controllers/notificationController.js
const notificationService = require('../services/notificationService');

const registerToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ status: 'fail', message: 'Token requis' });
    }
    await notificationService.registerDeviceToken(req.user._id, token);
    res.status(200).json({ status: 'success', message: 'Token enregistre avec succes' });
  } catch (error) {
    next(error);
  }
};

const unregisterToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ status: 'fail', message: 'Token requis' });
    }
    await notificationService.unregisterDeviceToken(req.user._id, token);
    res.status(200).json({ status: 'success', message: 'Token supprime avec succes' });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user._id);
    res.status(200).json({ status: 'success', data: { count } });
  } catch (error) {
    next(error);
  }
};

const getMyNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const notifications = await notificationService.getUserNotifications(req.user._id, page, limit);

    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: { notifications }
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id, req.user._id);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

const deleteOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id, req.user._id);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

const deleteMultiple = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ status: 'fail', message: 'Un tableau d IDs est requis' });
    }
    await notificationService.deleteMultipleNotifications(notificationIds, req.user._id);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

const deleteAll = async (req, res, next) => {
  try {
    await notificationService.deleteAllNotifications(req.user._id);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerToken,
  unregisterToken,
  getUnreadCount,
  getMyNotifications,
  markNotificationRead,
  markAllRead,
  deleteOne,
  deleteMultiple,
  deleteAll
};