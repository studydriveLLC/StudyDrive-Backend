const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  pseudo: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true },
  university: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  
  role: { 
    type: String, 
    enum: ['user', 'admin', 'superadmin'], 
    default: 'user' 
  },
  badgeType: { 
    type: String, 
    enum: ['none', 'certified', 'admin', 'superadmin'], 
    default: 'none' 
  },
  previousBadgeType: { 
    type: String, 
    enum: ['none', 'certified'], 
    default: 'none' 
  },
  
  isEmailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { 
  timestamps: true 
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);