const express = require('express');
const router = express.Router();
const path = require('path');
const { Readable } = require('stream');

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
const { success, error, notFound, forbidden } = require('../../_lib/response');

// ========== LIST ==========
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      folderId = null,
      category,
      search,
      sort = 'newest',
      page = 1,
      limit = 30,
      trash = 'false'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;
    const inTrash = trash === 'true';

    const fileQuery = {
      ownerId: userId,
      deletedAt: inTrash ? { $ne: null } : null
    };

    if (!inTrash) {
      if (folderId && folderId !== 'null' && folderId !== 'root') {
        fileQuery.folderId = folderId;
      } else if (!search) {
        fileQuery.folderId = null;
      }
    }

    if (category && category !== 'all') {
      fileQuery.category = category;
    }

    if (search && search.trim()) {
      fileQuery.name = {
        $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i'
      };
      delete fileQuery.folderId;
    }

    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'name-asc':
        sortOption = { name: 1 };
        break;
      case 'name-desc':
        sortOption = { name: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'largest':
        sortOption = { size: -1 };
        break;
      case 'smallest':
        sortOption = { size: 1 };
        break;
      case 'modified':
        sortOption = { updatedAt: -1 };
        break;
    }

    let folders = [];
    if (!inTrash && !category) {
      const folderQuery = {
        ownerId: userId,
        deletedAt: null
      };
      if (search && search.trim()) {
        folderQuery.name = {
          $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i'
        };
      } else if (folderId && folderId !== 'null' && folderId !== 'root') {
        folderQuery.parentId = folderId;
      } else {
        folderQuery.parentId = null;
      }
      folders = await Folder.find(folderQuery).sort({ name: 1 }).lean();
    }

    const [files, total] = await Promise.all([
      File.find(fileQuery).sort(sortOption).skip(skip).limit(limitNum).lean(),
      File.countDocuments(fileQuery)
    ]);

    let breadcrumb = [{ id: null, name: 'My Files' }];
    if (folderId && folderId !== 'null' && folderId !== 'root' && !search) {
      const chain = [];
      let current = await Folder.findOne({
        _id: folderId,
        ownerId: userId,
        deletedAt: null
      }).lean();
      while (current) {
        chain.unshift({ id: current._id, name: current.name });
        if (!current.parentId) break;
        current = await Folder.findOne({
          _id: current.parentId,
          ownerId: userId,
          deletedAt: null
        }).lean();
      }
      breadcrumb = breadcrumb.concat(chain);
    }

    return success(res, {
      folders: folders.map((f) => ({
        id: f._id,
        name: f.name,
        parentId: f.parentId,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      })),
      files: files.map((f) => ({
        id: f._id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        extension: f.extension,
        category: f.category,
        folderId: f.folderId,
        metadata: f.metadata,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        deletedAt: f.deletedAt
      })),
      breadcrumb,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('List files error:', err);
    return error(res, 'Failed to list files', 500);
  }
});

// ========== UPLOAD ==========
router.post('/upload', authMiddleware, upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return error(res, 'No files provided');
    }

    const folderId = req.body.folderId || null;
    const userId = req.user._id;

    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId: userId,
        deletedAt: null
      });
      if (!folder) return error(res, 'Folder not found', 404);
    }

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

    await User.findByIdAndUpdate(userId, { $inc: { storageUsed: totalSize } });

    return success(
      res,
      { files: uploaded },
      uploaded.length === 1
        ? 'File uploaded successfully'
        : `${uploaded.length} files uploaded successfully`,
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

// ========== DOWNLOAD ==========
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, deletedAt: null });
    if (!file) return notFound(res, 'File not found');
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    const stream = await storage.getDownloadStream(file.storageKey);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.name)}"`
    );
    res.setHeader('Content-Length', file.size);

    await Activity.create({
      userId: req.user._id,
      action: 'download',
      targetName: file.name,
      targetId: file._id
    });

    if (typeof stream.pipe === 'function') {
      stream.pipe(res);
    } else {
      Readable.from(stream).pipe(res);
    }
  } catch (err) {
    console.error('Download error:', err);
    return error(res, 'Download failed', 500);
  }
});

// ========== STREAM (preview) ==========
router.get('/:id/stream', authMiddleware, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, deletedAt: null });
    if (!file) return notFound(res, 'File not found');
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
      Readable.from(stream).pipe(res);
    }
  } catch (err) {
    console.error('Stream error:', err);
    return error(res, 'Stream failed', 500);
  }
});

// ========== INFO ==========
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id).lean();
    if (!file || file.deletedAt) return notFound(res, 'File not found');
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    let location = 'My Files';
    if (file.folderId) {
      const parts = [];
      let current = await Folder.findOne({
        _id: file.folderId,
        ownerId: req.user._id
      }).lean();
      while (current) {
        parts.unshift(current.name);
        if (!current.parentId) break;
        current = await Folder.findOne({
          _id: current.parentId,
          ownerId: req.user._id
        }).lean();
      }
      location = 'My Files / ' + parts.join(' / ');
    }

    return success(res, {
      id: file._id,
      name: file.name,
      originalName: file.originalName,
      mimeType: file.mimeType,
      extension: file.extension,
      size: file.size,
      category: file.category,
      metadata: file.metadata,
      folderId: file.folderId,
      location,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    });
  } catch (err) {
    console.error('File info error:', err);
    return error(res, 'Failed to get file info', 500);
  }
});

// ========== RENAME ==========
router.patch('/:id/rename', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return error(res, 'Name is required');

    const newName = sanitizeFilename(name.trim());
    if (!newName) return error(res, 'Invalid name');

    const file = await File.findById(req.params.id);
    if (!file || file.deletedAt) return notFound(res, 'File not found');
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    const oldName = file.name;
    file.name = newName;
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'rename',
      targetName: newName,
      targetId: file._id,
      meta: { oldName }
    });

    return success(res, { id: file._id, name: file.name }, 'File renamed');
  } catch (err) {
    console.error('Rename error:', err);
    return error(res, 'Rename failed', 500);
  }
});

// ========== MOVE ==========
router.patch('/:id/move', authMiddleware, async (req, res) => {
  try {
    const { folderId } = req.body;

    const file = await File.findById(req.params.id);
    if (!file || file.deletedAt) return notFound(res, 'File not found');
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        ownerId: req.user._id,
        deletedAt: null
      });
      if (!folder) return notFound(res, 'Destination folder not found');
    }

    file.folderId = folderId || null;
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'move',
      targetName: file.name,
      targetId: file._id,
      meta: { folderId: file.folderId }
    });

    return success(res, { id: file._id, folderId: file.folderId }, 'File moved');
  } catch (err) {
    console.error('Move error:', err);
    return error(res, 'Move failed', 500);
  }
});

// ========== SOFT DELETE ==========
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return notFound(res, 'File not found');
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }
    if (file.deletedAt) return error(res, 'File is already in trash');

    file.deletedAt = new Date();
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'delete',
      targetName: file.name,
      targetId: file._id
    });

    return success(res, null, 'File moved to trash');
  } catch (err) {
    console.error('Delete error:', err);
    return error(res, 'Delete failed', 500);
  }
});

// ========== PERMANENT DELETE ==========
router.delete('/:id/permanent', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return notFound(res, 'File not found');
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }

    try {
      await storage.remove(file.storageKey);
    } catch (e) {
      console.warn('Storage remove warning:', e.message);
    }

    const size = file.size;
    await File.deleteOne({ _id: file._id });

    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: -size } });
    const user = await User.findById(req.user._id);
    if (user.storageUsed < 0) {
      user.storageUsed = 0;
      await user.save();
    }

    return success(res, null, 'File permanently deleted');
  } catch (err) {
    console.error('Permanent delete error:', err);
    return error(res, 'Delete failed', 500);
  }
});

// ========== RESTORE ==========
router.post('/:id/restore', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return notFound(res, 'File not found');
    if (file.ownerId.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Access denied');
    }
    if (!file.deletedAt) return error(res, 'File is not in trash');

    file.deletedAt = null;
    if (file.folderId) {
      const folder = await Folder.findOne({
        _id: file.folderId,
        ownerId: req.user._id,
        deletedAt: null
      });
      if (!folder) file.folderId = null;
    }
    await file.save();

    await Activity.create({
      userId: req.user._id,
      action: 'restore',
      targetName: file.name,
      targetId: file._id
    });

    return success(res, null, 'File restored');
  } catch (err) {
    console.error('Restore error:', err);
    return error(res, 'Restore failed', 500);
  }
});

module.exports = router;
