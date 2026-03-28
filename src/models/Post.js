// src/models/Post.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { 
  timestamps: true 
});

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    text: { 
      type: String, 
      trim: true, 
      maxlength: 3000 
    },
    textBackground: {
      type: String,
      default: 'none'
    },
    mediaUrls: [{ 
      type: String 
    }],
    mediaType: { 
      type: String, 
      enum: ['image', 'video', 'none'], 
      default: 'none' 
    }
  },
  likedBy: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  comments: [commentSchema],
  stats: {
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 }
  },
  isRepost: { 
    type: Boolean, 
    default: false 
  },
  originalPost: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Post', 
    default: null 
  }
}, { 
  timestamps: true 
});

// Index composé pour récupérer très rapidement les posts récents d'un auteur spécifique
postSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);