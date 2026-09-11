const express = require('express');
const router = express.Router();
const Folder = require('../../models/Folder');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound } = require('../../_lib/response');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name || !name.trim()) {
      return error(res, 'Folder name is required');
    }

    const folderName = name.trim().slice(0, 100);

    if (parentId) {
      const parent = await Folder.findOne({
        _id: parentId,
        ownerId: req.user._id,
        deletedAt: null
      });
      if (!parent) {
        return notFound(res, 'Parent folder not found');
      }
    }

    // Prevent duplicate name in same parent
    const existing = await Folder.findOne({
      ownerId: req.user._id,
      parentId: parentId || null,
      name: folderName,
      deletedAt: null
    });
    if (existing) {
      return error(res, 'A folder with this name already exists here');
    }

    const folder = await Folder.create({
      ownerId: req.user._id,
      parentId: parentId || null,
      name: folderName
    });

    await Activity.create({
      userId: req.user._id,
      action: 'create_folder',
      targetName: folderName,
      targetId: folder._id
    });

    return success(
      res,
      {
        id: folder._id,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt
      },
      'Folder created',
      201
    );
  } catch (err) {
    console.error('Create folder error:', err);
    return error(res, 'Failed to create folder', 500);
  }
});

module.exports = router;
