const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const User = require('../../models/User');
const Activity = require('../../models/Activity');
const storage = require('../../_lib/storage');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound, forbidden } = require('../../_lib/response');

// Soft delete (move to trash)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }
    if (file.deletedAt) {
      return error(res, 'File is already in trash');
    }

    file.deletedAt = new Date();
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'delete',
      targetName: file.name,
      targetId: file._id
    });

    return success(res, null, 'File moved to trash');
  } catch (err) {
    console.error('Delete error:', err);
    return error(res, 'Delete failed', 500);
  }
});

// Permanent delete
router.delete('/:id/permanent', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    try {
      await storage.remove(file.storageKey);
    } catch (e) {
      console.warn('Storage remove warning:', e.message);
    }

    const size = file.size;
    await File.deleteOne({ _id: file._id });

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { storageUsed: -size }
    });

    // Ensure storageUsed doesn't go negative
    const user = await User.findById(req.user._id);
    if (user.storageUsed < 0) {
      user.storageUsed = 0;
      await user.save();
    }

    return success(res, null, 'File permanently deleted');
  } catch (err) {
    console.error('Permanent delete error:', err);
    return error(res, 'Delete failed', 500);
  }
});

// Restore from trash
router.post('/:id/restore', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }
    if (!file.deletedAt) {
      return error(res, 'File is not in trash');
    }

    file.deletedAt = null;
    // If original folder was deleted, move to root
    if (file.folderId) {
      const Folder = require('../../models/Folder');
      const folder = await Folder.findOne({
        _id: file.folderId,
        ownerId: req.user._id,
        deletedAt: null
      });
      if (!folder) file.folderId = null;
    }
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'restore',
      targetName: file.name,
      targetId: file._id
    });

    return success(res, null, 'File restored');
  } catch (err) {
    console.error('Restore error:', err);
    return error(res, 'Restore failed', 500);
  }
});

module.exports = router;
