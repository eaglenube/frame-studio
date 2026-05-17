'use strict';

const express = require('express');
const authRoutes = require('./auth');
const uploadRoutes = require('./upload');
const processRoutes = require('./process');
const downloadRoutes = require('./download');
const driveRoutes = require('./drive');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

// Public auth routes
router.use(authRoutes);

// All app routes require login
router.use(requireUser);
router.use(uploadRoutes);
router.use(processRoutes);
router.use(downloadRoutes);
router.use(driveRoutes);

module.exports = router;
