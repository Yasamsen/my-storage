const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../_lib/auth');
const { success } = require('../../_lib/response');

router.get('/', authMiddleware, (req, res) => {
  return success(res, {
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    avatar: req.user.avatar,
    storageUsed: req.user.storageUsed,
    storageLimit: req.user.storageLimit,
    theme: req.user.theme,
    createdAt: req.user.createdAt
  });
});

module.exports = router;
