const express = require('express');
const router = express.Router();
const Share = require('../../models/Share');
const File = require('../../models/File');
const storage = require('../../_lib/storage');
const { success, error, notFound } = require('../../_lib/response');

// Public endpoint – get share info by token
router.get('/:token', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) {
      return notFound(res, 'Share link not found or revoked');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return error(res, 'Share link has expired', 410);
    }

    const file = await File.findOne({
      _id: share.fileId,
      deletedAt: null
    }).lean();

    if (!file) {
      return notFound(res, 'File no longer available');
    }

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

// Public download via share token
router.get('/:token/download', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) {
      return notFound(res, 'Share link not found or revoked');
    }
    if (share.expiresAt && share.expiresAt < new Date()) {
      return error(res, 'Share link has expired', 410);
    }
    if (share.permission !== 'download' && share.permission !== 'view') {
      return error(res, 'Download not allowed', 403);
    }

    const file = await File.findOne({
      _id: share.fileId,
      deletedAt: null
    });
    if (!file) {
      return notFound(res, 'File no longer available');
    }

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
      const { Readable } = require('stream');
      Readable.from(stream).pipe(res);
    }
  } catch (err) {
    console.error('Share download error:', err);
    return error(res, 'Download failed', 500);
  }
});

// Stream for preview (inline)
router.get('/:token/stream', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) {
      return notFound(res, 'Share link not found or revoked');
    }
    if (share.expiresAt && share.expiresAt < new Date()) {
      return error(res, 'Share link has expired', 410);
    }

    const file = await File.findOne({
      _id: share.fileId,
      deletedAt: null
    });
    if (!file) {
      return notFound(res, 'File no longer available');
    }

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
      const { Readable } = require('stream');
      Readable.from(stream).pipe(res);
    }
  } catch (err) {
    console.error('Share stream error:', err);
    return error(res, 'Stream failed', 500);
  }
});

module.exports = router;
