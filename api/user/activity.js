const express = require('express');
const router = express.Router();
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { success, error } = require('../../_lib/response');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const items = await Activity.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return success(
      res,
      items.map((a) => ({
        id: a._id,
        action: a.action,
        targetName: a.targetName,
        targetId: a.targetId,
        meta: a.meta,
        createdAt: a.createdAt
      }))
    );
  } catch (err) {
    console.error('Activity error:', err);
    return error(res, 'Failed to get activity', 500);
  }
});

module.exports = router;
