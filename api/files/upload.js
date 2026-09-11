const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const Folder = require('../../models/Folder');
const User = require('../../models/User');
const Activity = require('../../models/Activity');
const { authMiddleware } = require('../../_lib/auth');
const storage = require('../../_lib/storage');
const {
  upload,
  sanitizeFilename,
  getExtension,
  getCategory,
  generateStorageKey,
  resolveMimeType
} = require('../../_lib/upload');
const { success, error } = require('../../_lib/response');

router.post('/', authMiddleware, upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return error(res, 'No files provided');
    }

    const folderId = req.body.folderId || null;
    const userId = req.user._id;

    // Validate folder ownership if provided
    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId: userId,
        deletedAt: null
      });
      if (!folder) {
        return error(res, 'Folder not found', 404);
      }
    }

    // Check total size against remaining storage
    const totalSize = req.files.reduce((sum, f) => sum + f.size, 0);
    const user = await User.findById(userId);
    if (user.storageUsed + totalSize > user.storageLimit) {
      return error(res, 'Storage limit reached', 413);
    }

    const uploaded = [];

    for (const file of req.files) {
      const originalName = sanitizeFilename(file.originalname);
      const extension = getExtension(originalName);
      const mimeType = resolveMimeType(originalName, file.mimetype);
      const category = getCategory(extension, mimeType);
      const storageKey = generateStorageKey(userId.toString(), originalName);

      await storage.upload(storageKey, file.buffer, mimeType);

      const doc = await File.create({
        ownerId: userId,
        folderId,
        name: originalName,
        originalName,
        storageKey,
        mimeType,
        extension,
        size: file.size,
        category,
        metadata: {}
      });

      await Activity.create({
        userId,
        action: 'upload',
        targetName: originalName,
        targetId: doc._id
      });

      uploaded.push({
        id: doc._id,
        name: doc.name,
        size: doc.size,
        mimeType: doc.mimeType,
        category: doc.category,
        extension: doc.extension,
        folderId: doc.folderId,
        createdAt: doc.createdAt
      });
    }

    // Update storage used
    await User.findByIdAndUpdate(userId, {
      $inc: { storageUsed: totalSize }
    });

    return success(
      res,
      { files: uploaded },
      uploaded.length === 1 ? 'File uploaded successfully' : `${uploaded.length} files uploaded successfully`,
      201
    );
  } catch (err) {
    console.error('Upload error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return error(res, 'File too large', 413);
    }
    return error(res, 'Upload failed', 500);
  }
});

module.exports = router;
