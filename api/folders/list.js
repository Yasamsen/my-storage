const express = require('express');
const router = express.Router();
const Folder = require('../../models/Folder');
const { authMiddleware } = require('../../_lib/auth');
const { success, error } = require('../../_lib/response');

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

module.exports = router;
