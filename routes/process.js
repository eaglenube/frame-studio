'use strict';

const express = require('express');
const {
  showOptions,
  startJob,
  showProgress,
  getStatus,
  showGallery,
  listImages,
} = require('../controllers/processController');
const { requireOwnJob } = require('../middleware/auth');

const router = express.Router();

router.get('/options/:jobId', requireOwnJob, showOptions);
router.post('/api/jobs/:jobId/start', requireOwnJob, startJob);

router.get('/progress/:jobId', requireOwnJob, showProgress);
router.get('/api/jobs/:jobId/status', requireOwnJob, getStatus);

router.get('/gallery/:jobId', requireOwnJob, showGallery);
router.get('/api/jobs/:jobId/images', requireOwnJob, listImages);

module.exports = router;
