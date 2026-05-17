'use strict';

const express = require('express');
const authRoutes = require('./auth');
const uploadRoutes = require('./upload');
const processRoutes = require('./process');
const downloadRoutes = require('./download');
const driveRoutes = require('./drive');

const router = express.Router();

// Anonymous-friendly: extract-frames flow does not require login.
// Sign-in is only enforced inside the Drive routes themselves.
router.use(authRoutes);
router.use(uploadRoutes);
router.use(processRoutes);
router.use(downloadRoutes);
router.use(driveRoutes);

module.exports = router;
