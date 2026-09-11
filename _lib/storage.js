/**
 * Storage abstraction layer
 * Supports: local (dev), Cloudflare R2, AWS S3
 * Switch provider via STORAGE_PROVIDER env
 */

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const PROVIDER = process.env.STORAGE_PROVIDER || 'local';

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  if (PROVIDER === 'r2') {
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) throw new Error('R2_ACCOUNT_ID is required');
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    });
  } else if (PROVIDER === 's3') {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return s3Client;
}

function getBucket() {
  if (PROVIDER === 'r2') return process.env.R2_BUCKET_NAME;
  if (PROVIDER === 's3') return process.env.AWS_S3_BUCKET;
  return null;
}

function ensureLocalDir(key) {
  const base = process.env.LOCAL_STORAGE_PATH || './uploads';
  const full = path.join(base, path.dirname(key));
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
  return path.join(base, key);
}

/**
 * Upload a file buffer/stream to storage
 * @param {string} key - storage key (path)
 * @param {Buffer|Readable} body
 * @param {string} contentType
 * @returns {Promise<{key: string, size: number}>}
 */
async function upload(key, body, contentType = 'application/octet-stream') {
  if (PROVIDER === 'local') {
    const filePath = ensureLocalDir(key);
    const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body);
    fs.writeFileSync(filePath, buffer);
    return { key, size: buffer.length };
  }

  const client = getS3Client();
  const bucket = getBucket();
  const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));

  return { key, size: buffer.length };
}

/**
 * Get a readable stream or signed URL for download
 */
async function getDownloadStream(key) {
  if (PROVIDER === 'local') {
    const filePath = ensureLocalDir(key);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found in storage');
    }
    return fs.createReadStream(filePath);
  }

  const client = getS3Client();
  const bucket = getBucket();
  const result = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key
  }));
  return result.Body;
}

/**
 * Generate a temporary signed URL for direct download (S3/R2)
 */
async function getSignedDownloadUrl(key, expiresIn = 3600) {
  if (PROVIDER === 'local') {
    // Local: return a path that the server can serve
    return null;
  }
  const client = getS3Client();
  const bucket = getBucket();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete object from storage
 */
async function remove(key) {
  if (PROVIDER === 'local') {
    const filePath = ensureLocalDir(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  const client = getS3Client();
  const bucket = getBucket();
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  }));
}

/**
 * Check if object exists
 */
async function exists(key) {
  if (PROVIDER === 'local') {
    const filePath = ensureLocalDir(key);
    return fs.existsSync(filePath);
  }

  try {
    const client = getS3Client();
    const bucket = getBucket();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get public URL if available (R2 public bucket)
 */
function getPublicUrl(key) {
  if (PROVIDER === 'r2' && process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = {
  upload,
  getDownloadStream,
  getSignedDownloadUrl,
  remove,
  exists,
  getPublicUrl,
  PROVIDER
};
