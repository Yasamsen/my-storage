const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { authMiddleware, hashPassword, comparePassword } = require('../../_lib/auth');
const { success, error } = require('../../_lib/response');

router.get('/', authMiddleware, (req, res) => {
  return success(res, {
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    avatar: req.user.avatar,
    theme: req.user.theme,
    storageUsed: req.user.storageUsed,
    storageLimit: req.user.storageLimit,
    createdAt: req.user.createdAt
  });
});

router.patch('/', authMiddleware, async (req, res) => {
  try {
    const { username, theme } = req.body;
    const updates = {};

    if (username !== undefined) {
      const name = username.trim();
      if (name.length < 2 || name.length > 50) {
        return error(res, 'Username must be between 2 and 50 characters');
      }
      updates.username = name;
    }

    if (theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(theme)) {
        return error(res, 'Invalid theme');
      }
      updates.theme = theme;
    }

    if (Object.keys(updates).length === 0) {
      return error(res, 'No valid fields to update');
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true
    }).select('-passwordHash');

    return success(res, {
      id: user._id,
      username: user.username,
      email: user.email,
      theme: user.theme
    }, 'Profile updated');
  } catch (err) {
    console.error('Update profile error:', err);
    return error(res, 'Failed to update profile', 500);
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return error(res, 'Current and new password are required');
    }
    if (newPassword.length < 8) {
      return error(res, 'New password must be at least 8 characters');
    }

    const user = await User.findById(req.user._id);
    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) {
      return error(res, 'Current password is incorrect', 401);
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return success(res, null, 'Password changed successfully');
  } catch (err) {
    console.error('Change password error:', err);
    return error(res, 'Failed to change password', 500);
  }
});

module.exports = router;
