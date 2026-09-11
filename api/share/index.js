const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Readable } = require('stream');
const File = require('../../models/File');
const Share = require('../../models/Share');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const storage = require('../../_lib/storage');
const { success, error, notFound, forbidden } = require('../../_lib/response');

// Create share
router.post('/:fileId', authMiddleware, async (req, res) => {
  try {
    const { permission = 'download', expiresIn } = req.body;

    const file = await File.findById(req.params.fileId);
    if (!file || file.deletedAt) return notFound(res, 'File not found');
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

// Get share info (public)
router.get('/:token', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) return notFound(res, 'Share link not found or revoked');

    if (share.expiresAt && share.expiresAt < new Date()) {
      return error(res, 'Share link has expired', 410);
    }

    const file = await File.findOne({
      _id: share.fileId,
      deletedAt: null
    }).lean();

    if (!file) return notFound(res, 'File no longer available');

    return success(res, {
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      extension: file.extension,
      category: file.category,
      permission: share.permission,
      expiresAt: share.expiresAt
    });
  } catch (err) {
    console.error('Get share error:', err);
    return error(res, 'Failed to get share', 500);
  }
});

// Download via share (public)
router.get('/:token/download', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) return notFound(res, 'Share link not found or revoked');
    if (share.expiresAt && share.expiresAt < new Date()) {
      return error(res, 'Share link has expired', 410);
    }

    const file = await File.findOne({
      _id: share.fileId,
      deletedAt: null
    });
    if (!file) return notFound(res, 'File no longer available');

    const stream = await storage.getDownloadStream(file.storageKey);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.name)}"`
    );
    res.setHeader('Content-Length', file.size);

    if (typeof stream.pipe === 'function') {
      stream.pipe(res);
    } else {
      Readable.from(stream).pipe(res);
    }
  } catch (err) {
    console.error('Share download error:', err);
    return error(res, 'Download failed', 500);
  }
});

// Stream for preview (public)
router.get('/:token/stream', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) return notFound(res, 'Share link not found or revoked');
    if (share.expiresAt && share.expiresAt < new Date()) {
      return error(res, 'Share link has expired', 410);
    }

    const file = await File.findOne({
      _id: share.fileId,
      deletedAt: null
    });
    if (!file) return notFound(res, 'File no longer available');

    const stream = await storage.getDownloadStream(file.storageKey);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.name)}"`
    );
    res.setHeader('Content-Length', file.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (typeof stream.pipe === 'function') {
      stream.pipe(res);
    } else {
      Readable.from(stream).pipe(res);
    }
  } catch (err) {
    console.error('Share stream error:', err);
    return error(res, 'Stream failed', 500);
  }
});

// Revoke
router.delete('/:token', authMiddleware, async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) return notFound(res, 'Share link not found');
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
