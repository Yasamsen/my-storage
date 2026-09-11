require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { connectDB } = require('./_lib/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin: process.env.APP_URL || true,
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many attempts, please try again later' }
});

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, 'public')));

if ((process.env.STORAGE_PROVIDER || 'local') === 'local') {
  const uploadPath = process.env.LOCAL_STORAGE_PATH || './uploads';
  app.use('/uploads', express.static(path.resolve(uploadPath)));
}

// Auth
app.use('/api/auth/register', authLimiter, require('./api/auth/register'));
app.use('/api/auth/login', authLimiter, require('./api/auth/login'));
app.use('/api/auth/logout', require('./api/auth/logout'));
app.use('/api/auth/me', require('./api/auth/me'));

// Files, Folders, Share
app.use('/api/files', require('./api/files/index'));
app.use('/api/folders', require('./api/folders/index'));
app.use('/api/share', require('./api/share/index'));

// User
app.use('/api/user/profile', require('./api/user/profile'));
app.use('/api/storage', require('./api/user/storage'));
app.use('/api/activity', require('./api/user/activity'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MyStorage is running' });
});

// Public share page
app.get('/s/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shared.html'));
});

// App pages
const pages = ['login', 'register', 'dashboard', 'files', 'trash', 'settings', 'preview'];
pages.forEach((page) => {
  app.get('/' + page, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', page + '.html'));
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'File too large' });
    }
  }
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log('');
      console.log('☁  MyStorage running at http://localhost:' + PORT);
      console.log('   Storage provider: ' + (process.env.STORAGE_PROVIDER || 'local'));
      console.log('   Environment: ' + (process.env.NODE_ENV || 'development'));
      console.log('');
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
