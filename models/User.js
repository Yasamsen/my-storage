const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255
    },
    passwordHash: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      default: null
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0
    },
    storageLimit: {
      type: Number,
      default: () => (parseInt(process.env.DEFAULT_STORAGE_LIMIT_GB, 10) || 20) * 1024 * 1024 * 1024
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);
