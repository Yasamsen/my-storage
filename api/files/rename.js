const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { sanitizeFilename } = require('../../_lib/upload');
const { success, error, notFound, forbidden } = require('../../_lib/response');

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return error(res, 'Name is required');
    }

    const newName = sanitizeFilename(name.trim());
    if (!newName) {
      return error(res, 'Invalid name');
    }

    const file = await File.findById(req.params.id);
    if (!file || file.deletedAt) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    const oldName = file.name;
    file.name = newName;
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'rename',
      targetName: newName,
      targetId: file._id,
      meta: { oldName }
    });

    return success(res, { id: file._id, name: file.name }, 'File renamed');
  } catch (err) {
    console.error('Rename error:', err);
    return error(res, 'Rename failed', 500);
  }
});

module.exports = router;
