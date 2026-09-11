const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const Folder = require('../../models/Folder');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound, forbidden } = require('../../_lib/response');

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { folderId } = req.body; // null = root

    const file = await File.findById(req.params.id);
    if (!file || file.deletedAt) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId: req.user._id,
        deletedAt: null
      });
      if (!folder) {
        return notFound(res, 'Destination folder not found');
      }
    }

    file.folderId = folderId || null;
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'move',
      targetName: file.name,
      targetId: file._id,
      meta: { folderId: file.folderId }
    });

    return success(res, { id: file._id, folderId: file.folderId }, 'File moved');
  } catch (err) {
    console.error('Move error:', err);
    return error(res, 'Move failed', 500);
  }
});

module.exports = router;
