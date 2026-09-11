/**
 * Stream file content for authenticated preview (inline)
 */
const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const { authMiddleware } = require('../../_lib/auth');
const storage = require('../../_lib/storage');
const { error, notFound, forbidden } = require('../../_lib/response');

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      deletedAt: null
    });

    if (!file) {
      return notFound(res, 'File not found');
    }
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
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
    console.error('Stream error:', err);
    return error(res, 'Stream failed', 500);
  }
});

module.exports = router;
