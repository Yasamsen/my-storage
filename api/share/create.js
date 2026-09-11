const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const File = require('../../models/File');
const Share = require('../../models/Share');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const { success, error, notFound, forbidden } = require('../../_lib/response');

router.post('/:fileId', authMiddleware, async (req, res) => {
  try {
    const { permission = 'download', expiresIn } = req.body;

    const file = await File.findById(req.params.fileId);
    if (!file || file.deletedAt) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    if (!['view', 'download'].includes(permission)) {
      return error(res, 'Invalid permission');
    }

    let expiresAt = null;
    if (expiresIn && expiresIn !== 'never') {
      const map = {
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      if (map[expiresIn]) {
        expiresAt = new Date(Date.now() + map[expiresIn]);
      }
    }

    // Revoke existing shares for this file (one active share per file for simplicity)
    await Share.deleteMany({ fileId: file._id, ownerId: req.user._id });

    const token = crypto.randomBytes(16).toString('base64url');

    const share = await Share.create({
      fileId: file._id,
      ownerId: req.user._id,
      token,
      permission,
      expiresAt
    });

    await Activity.create({
      userId: req.user._id,
      action: 'share',
      targetName: file.name,
      targetId: file._id
    });

    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const shareUrl = `${appUrl}/s/${token}`;

    return success(
      res,
      {
        token: share.token,
        url: shareUrl,
        permission: share.permission,
        expiresAt: share.expiresAt
      },
      'Share link created',
      201
    );
  } catch (err) {
    console.error('Create share error:', err);
    return error(res, 'Failed to create share link', 500);
  }
});

module.exports = router;
