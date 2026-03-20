const mongoose = require('mongoose');

const certificationRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// NOUVEAU : TTL Index intelligent. Démarre le compte à rebours de 30 jours UNIQUEMENT quand la demande a été traitée (processedAt).
certificationRequestSchema.index({ processedAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('CertificationRequest', certificationRequestSchema);