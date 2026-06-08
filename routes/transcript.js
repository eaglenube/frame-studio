'use strict';

const express = require('express');
const {
  uploadMiddleware,
  handleUpload,
  showUpload,
  showProgress,
  getStatus,
  showResult,
  downloadTranscript,
} = require('../controllers/transcriptController');

const router = express.Router();

router.get('/transcript', showUpload);

router.post('/api/transcripts', (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) return next(err);
    handleUpload(req, res, next);
  });
});

router.get('/transcript/:id/progress', showProgress);
router.get('/api/transcripts/:id/status', getStatus);
router.get('/transcript/:id', showResult);
router.get('/api/transcripts/:id/download', downloadTranscript);

module.exports = router;
