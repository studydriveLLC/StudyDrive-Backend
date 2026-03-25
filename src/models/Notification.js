//src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' 
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'message', 'badge_approved', 'badge_rejected', 'system', 'follow'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId, 
    required: true
  },
  content: {
    type: String, 
    required: true
  },
  dataPayload: {
    type: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model('Notification', notificationSchema);