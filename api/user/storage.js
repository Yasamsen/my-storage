const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const { authMiddleware } = require('../../_lib/auth');
const { success, error } = require('../../_lib/response');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    // Aggregate by category (only non-deleted)
    const stats = await File.aggregate([
      {
        $match: {
          ownerId: userId,
          deletedAt: null
        }
      },
      {
        $group: {
          _id: '$category',
          size: { $sum: '$size' },
          count: { $sum: 1 }
        }
      }
    ]);

    const byCategory = {
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      other: 0
    };
    let fileCount = 0;

    stats.forEach((s) => {
      if (byCategory[s._id] !== undefined) {
        byCategory[s._id] = s.size;
      }
      fileCount += s.count;
    });

    // Folder count
    const Folder = require('../../models/Folder');
    const folderCount = await Folder.countDocuments({
      ownerId: userId,
      deletedAt: null
    });

    // Shared count
    const Share = require('../../models/Share');
    const sharedCount = await Share.countDocuments({ ownerId: userId });

    return success(res, {
      used: req.user.storageUsed,
      limit: req.user.storageLimit,
      percent: req.user.storageLimit
        ? Math.min(100, Math.round((req.user.storageUsed / req.user.storageLimit) * 100))
        : 0,
      byCategory,
      fileCount,
      folderCount,
      sharedCount
    });
  } catch (err) {
    console.error('Storage stats error:', err);
    return error(res, 'Failed to get storage stats', 500);
  }
});

module.exports = router;
