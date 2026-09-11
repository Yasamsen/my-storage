const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    permission: {
      type: String,
      enum: ['view', 'download'],
      default: 'download'
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

shareSchema.index({ token: 1, expiresAt: 1 });

module.exports = mongoose.model('Share', shareSchema);
