'use strict';

const express = require('express');
const uploadRoutes = require('./upload');
const processRoutes = require('./process');
const downloadRoutes = require('./download');

const router = express.Router();

router.use(uploadRoutes);
router.use(processRoutes);
router.use(downloadRoutes);

module.exports = router;
