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

const router = express.Router();

router.get('/options/:jobId', showOptions);
router.post('/api/jobs/:jobId/start', startJob);

router.get('/progress/:jobId', showProgress);
router.get('/api/jobs/:jobId/status', getStatus);

router.get('/gallery/:jobId', showGallery);
router.get('/api/jobs/:jobId/images', listImages);

module.exports = router;
