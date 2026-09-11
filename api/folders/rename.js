const express = require('express');
const router = express.Router();
const Folder = require('../../models/Folder');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound, forbidden } = require('../../_lib/response');

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return error(res, 'Folder name is required');
    }

    const folder = await Folder.findById(req.params.id);
    if (!folder || folder.deletedAt) {
      return notFound(res, 'Folder not found');
    }
    if (folder.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    const newName = name.trim().slice(0, 100);

    const existing = await Folder.findOne({
      ownerId: req.user._id,
      parentId: folder.parentId,
      name: newName,
      deletedAt: null,
      _id: { $ne: folder._id }
    });
    if (existing) {
      return error(res, 'A folder with this name already exists here');
    }

    folder.name = newName;
    await folder.save();

    return success(res, { id: folder._id, name: folder.name }, 'Folder renamed');
  } catch (err) {
    console.error('Rename folder error:', err);
    return error(res, 'Failed to rename folder', 500);
  }
});

module.exports = router;
