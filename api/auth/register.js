const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { hashPassword, generateToken } = require('../../_lib/auth');
const { success, error } = require('../../_lib/response');

router.post('/', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password) {
      return error(res, 'Username, email and password are required');
    }

    if (username.trim().length < 2 || username.trim().length > 50) {
      return error(res, 'Username must be between 2 and 50 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return error(res, 'Invalid email address');
    }

    if (password.length < 8) {
      return error(res, 'Password must be at least 8 characters');
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return error(res, 'Passwords do not match');
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return error(res, 'Email is already registered', 409);
    }

    const passwordHash = await hashPassword(password);
    const storageLimit = (parseInt(process.env.DEFAULT_STORAGE_LIMIT_GB, 10) || 20) * 1024 * 1024 * 1024;

    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      storageLimit
    });

    const token = generateToken({ userId: user._id.toString() });

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return success(
      res,
      {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          storageUsed: user.storageUsed,
          storageLimit: user.storageLimit
        },
        token
      },
      'Account created successfully',
      201
    );
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      return error(res, 'Email is already registered', 409);
    }
    return error(res, 'Registration failed', 500);
  }
});

module.exports = router;
