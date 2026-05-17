'use strict';

const express = require('express');
const { pickerConfig, saveToDrive } = require('../controllers/driveController');
const { requireOwnJob } = require('../middleware/auth');

const router = express.Router();

router.get('/api/drive/picker-config', pickerConfig);
router.post('/api/jobs/:jobId/drive/save', requireOwnJob, saveToDrive);

module.exports = router;
