const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const Folder = require('../../models/Folder');
const { authMiddleware } = require('../../_lib/auth');
const { success, notFound, forbidden, error } = require('../../_lib/response');

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id).lean();
    if (!file || file.deletedAt) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    let location = 'My Files';
    if (file.folderId) {
      const parts = [];
      let current = await Folder.findOne({
        _id: file.folderId,
        ownerId: req.user._id
      }).lean();
      while (current) {
        parts.unshift(current.name);
        if (!current.parentId) break;
        current = await Folder.findOne({
          _id: current.parentId,
          ownerId: req.user._id
        }).lean();
      }
      location = 'My Files / ' + parts.join(' / ');
    }

    return success(res, {
      id: file._id,
      name: file.name,
      originalName: file.originalName,
      mimeType: file.mimeType,
      extension: file.extension,
      size: file.size,
      category: file.category,
      metadata: file.metadata,
      folderId: file.folderId,
      location,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    });
  } catch (err) {
    console.error('File info error:', err);
    return error(res, 'Failed to get file info', 500);
  }
});

module.exports = router;
