const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

folderSchema.index({ ownerId: 1, parentId: 1, deletedAt: 1 });
folderSchema.index({ ownerId: 1, name: 1 });

module.exports = mongoose.model('Folder', folderSchema);
