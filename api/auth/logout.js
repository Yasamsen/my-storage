const express = require('express');
const router = express.Router();
const { success } = require('../../_lib/response');

router.post('/', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return success(res, null, 'Logged out successfully');
});

module.exports = router;
