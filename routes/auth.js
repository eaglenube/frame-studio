'use strict';

const express = require('express');
const {
  showLogin,
  startGoogle,
  googleCallback,
  logout,
} = require('../controllers/authController');

const router = express.Router();

router.get('/login', showLogin);
router.get('/auth/google', startGoogle);
router.get('/auth/google/callback', googleCallback);
router.post('/logout', logout);
router.get('/logout', logout);

module.exports = router;
