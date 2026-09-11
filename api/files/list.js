const express = require('express');
const router = express.Router();
const File = require('../../models/File');
const Folder = require('../../models/Folder');
const { authMiddleware } = require('../../_lib/auth');
const { success, error } = require('../../_lib/response');

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
      fileQuery.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      delete fileQuery.folderId; // search across all folders
    }

    // Sort mapping
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'name-asc':
        sortOption = { name: 1 };
        break;
      case 'name-desc':
        sortOption = { name: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
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

    // Folders (only when not in trash and not searching by category-only)
    let folders = [];
    if (!inTrash && !category) {
      const folderQuery = {
        ownerId: userId,
        deletedAt: null
      };
      if (search && search.trim()) {
        folderQuery.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      } else if (folderId && folderId !== 'null' && folderId !== 'root') {
        folderQuery.parentId = folderId;
      } else {
        folderQuery.parentId = null;
      }

      folders = await Folder.find(folderQuery)
        .sort({ name: 1 })
        .lean();
    }

    const [files, total] = await Promise.all([
      File.find(fileQuery).sort(sortOption).skip(skip).limit(limitNum).lean(),
      File.countDocuments(fileQuery)
    ]);

    // Breadcrumb
    let breadcrumb = [{ id: null, name: 'My Files' }];
    if (folderId && folderId !== 'null' && folderId !== 'root' && !search) {
      const chain = [];
      let current = await Folder.findOne({ _id: folderId, ownerId: userId, deletedAt: null }).lean();
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

module.exports = router;
