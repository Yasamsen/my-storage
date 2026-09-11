const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    originalName: {
      type: String,
      required: true
    },
    storageKey: {
      type: String,
      required: true,
      unique: true
    },
    mimeType: {
      type: String,
      required: true
    },
    extension: {
      type: String,
      default: ''
    },
    size: {
      type: Number,
      required: true,
      min: 0
    },
    category: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'archive', 'other'],
      default: 'other',
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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

// Compound indexes for common queries
fileSchema.index({ ownerId: 1, deletedAt: 1, folderId: 1 });
fileSchema.index({ ownerId: 1, deletedAt: 1, category: 1 });
fileSchema.index({ ownerId: 1, name: 'text' });

module.exports = mongoose.model('File', fileSchema);
