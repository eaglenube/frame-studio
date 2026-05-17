'use strict';

const express = require('express');
const { uploadMiddleware, handleUpload, MAX_UPLOAD_MB } = require('../controllers/uploadController');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Upload a Video',
    maxUploadMb: MAX_UPLOAD_MB,
  });
});

router.post('/api/upload', (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) return next(err);
    handleUpload(req, res, next);
  });
});

module.exports = router;
