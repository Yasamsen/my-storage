const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { comparePassword, generateToken } = require('../../_lib/auth');
const { success, error } = require('../../_lib/response');

router.post('/', async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password are required');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return error(res, 'Invalid email or password', 401);
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return error(res, 'Invalid email or password', 401);
    }

    const token = generateToken({ userId: user._id.toString() });

    const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge
    });

    return success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        theme: user.theme
      },
      token
    }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Login failed', 500);
  }
});

module.exports = router;
