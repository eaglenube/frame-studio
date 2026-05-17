'use strict';

const express = require('express');
const { downloadSelected } = require('../controllers/downloadController');
const { requireOwnJob } = require('../middleware/auth');

const router = express.Router();

router.post('/api/jobs/:jobId/download', requireOwnJob, downloadSelected);

module.exports = router;
