const express = require('express');
const router = express.Router();
const Folder = require('../../models/Folder');
const File = require('../../models/File');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound, forbidden } = require('../../_lib/response');

// List
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { parentId } = req.query;
    const query = {
      ownerId: req.user._id,
      deletedAt: null
    };
    if (parentId && parentId !== 'null' && parentId !== 'root') {
      query.parentId = parentId;
    } else {
      query.parentId = null;
    }

    const folders = await Folder.find(query).sort({ name: 1 }).lean();

    return success(
      res,
      folders.map((f) => ({
        id: f._id,
        name: f.name,
        parentId: f.parentId,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      }))
    );
  } catch (err) {
    console.error('List folders error:', err);
    return error(res, 'Failed to list folders', 500);
  }
});

// Create
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
      if (!parent) return notFound(res, 'Parent folder not found');
    }

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

// Rename
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return error(res, 'Folder name is required');

    const folder = await Folder.findById(req.params.id);
    if (!folder || folder.deletedAt) return notFound(res, 'Folder not found');
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

// Delete (soft)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder || folder.deletedAt) return notFound(res, 'Folder not found');
    if (folder.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    const now = new Date();
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
