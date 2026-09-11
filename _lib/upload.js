/**
 * Multer configuration and file validation helpers
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 500) * 1024 * 1024;

// Memory storage – we upload to object storage ourselves
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 20
  },
  fileFilter: (req, file, cb) => {
    // Basic sanitization of original name
    if (!file.originalname || file.originalname.length > 255) {
      return cb(new Error('Invalid filename'));
    }
    cb(null, true);
  }
});

/**
 * Sanitize filename – remove path traversal and dangerous chars
 */
function sanitizeFilename(name) {
  const base = path.basename(name);
  return base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+/g, '.')
    .trim()
    .slice(0, 200) || 'unnamed';
}

/**
 * Get extension from filename (lowercase, without dot)
 */
function getExtension(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  return ext || '';
}

/**
 * Determine category from extension / mime
 */
function getCategory(ext, mimeType) {
  const image = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'];
  const video = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'wmv'];
  const audio = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];
  const document = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv'];
  const archive = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];

  if (image.includes(ext) || (mimeType && mimeType.startsWith('image/'))) return 'image';
  if (video.includes(ext) || (mimeType && mimeType.startsWith('video/'))) return 'video';
  if (audio.includes(ext) || (mimeType && mimeType.startsWith('audio/'))) return 'audio';
  if (document.includes(ext)) return 'document';
  if (archive.includes(ext)) return 'archive';
  return 'other';
}

/**
 * Generate unique storage key for a user
 * Format: users/{userId}/{uuid}.{ext}
 */
function generateStorageKey(userId, originalName) {
  const ext = getExtension(originalName);
  const id = uuidv4();
  return ext ? `users/${userId}/${id}.${ext}` : `users/${userId}/${id}`;
}

/**
 * Resolve content type – prefer mime-types lookup over client-provided
 */
function resolveMimeType(filename, clientMime) {
  const looked = mime.lookup(filename);
  if (looked) return looked;
  if (clientMime && clientMime !== 'application/octet-stream') return clientMime;
  return 'application/octet-stream';
}

module.exports = {
  upload,
  sanitizeFilename,
  getExtension,
  getCategory,
  generateStorageKey,
  resolveMimeType,
  MAX_FILE_SIZE
};
