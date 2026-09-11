const express = require('express');
const router = express.Router();
const Share = require('../../models/Share');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound, forbidden } = require('../../_lib/response');

router.delete('/:token', authMiddleware, async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) {
      return notFound(res, 'Share link not found');
    }
    if (share.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    await Share.deleteOne({ _id: share._id });

    await Activity.create({
      userId: req.user._id,
      action: 'revoke_share',
      targetId: share.fileId
    });

    return success(res, null, 'Share link revoked');
  } catch (err) {
    console.error('Revoke share error:', err);
    return error(res, 'Failed to revoke share', 500);
  }
});

module.exports = router;
