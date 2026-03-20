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
    enum: ['like', 'comment', 'message', 'badge_approved', 'badge_rejected', 'system'],
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
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index pour lister rapidement les notifications non lues d'un utilisateur
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// NOUVEAU : TTL Index - MongoDB nettoiera automatiquement les notifications après 15 jours
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model('Notification', notificationSchema);