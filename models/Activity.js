const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        'upload',
        'download',
        'delete',
        'restore',
        'rename',
        'move',
        'create_folder',
        'delete_folder',
        'share',
        'revoke_share'
      ]
    },
    targetName: {
      type: String,
      default: ''
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

activitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
