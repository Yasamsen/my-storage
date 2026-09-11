const express = require('express');
const router = express.Router();
const Folder = require('../../models/Folder');
const File = require('../../models/File');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound, forbidden } = require('../../_lib/response');

// Soft-delete folder and its contents (move to trash conceptually)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder || folder.deletedAt) {
      return notFound(res, 'Folder not found');
    }
    if (folder.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    const now = new Date();

    // Collect all descendant folder IDs (BFS)
    const toDelete = [folder._id];
    let queue = [folder._id];

    while (queue.length) {
      const children = await Folder.find({
        parentId: { $in: queue },
        ownerId: req.user._id,
        deletedAt: null
      }).select('_id');
      queue = children.map((c) => c._id);
      toDelete.push(...queue);
    }

    await Folder.updateMany(
      { _id: { $in: toDelete } },
      { $set: { deletedAt: now } }
    );

    // Soft-delete all files in those folders
    await File.updateMany(
      {
        ownerId: req.user._id,
        folderId: { $in: toDelete },
        deletedAt: null
      },
      { $set: { deletedAt: now } }
    );

    await Activity.create({
      userId: req.user._id,
      action: 'delete_folder',
      targetName: folder.name,
      targetId: folder._id
    });

    return success(res, null, 'Folder moved to trash');
  } catch (err) {
    console.error('Delete folder error:', err);
    return error(res, 'Failed to delete folder', 500);
  }
});

module.exports = router;
