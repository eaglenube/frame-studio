'use strict';

const express = require('express');
const { downloadSelected } = require('../controllers/downloadController');

const router = express.Router();

router.post('/api/jobs/:jobId/download', downloadSelected);

module.exports = router;
