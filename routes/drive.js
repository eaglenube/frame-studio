'use strict';

const express = require('express');
const {
  listFoldersHandler,
  createFolderHandler,
  saveToDrive,
  listFolderContentsHandler,
  importVideoHandler,
} = require('../controllers/driveController');
const { requireUser, requireOwnJob } = require('../middleware/auth');

const router = express.Router();

// Folder destination picker (for Save-to-Drive)
router.get('/api/drive/folders', requireUser, listFoldersHandler);
router.post('/api/drive/folders', requireUser, createFolderHandler);

// Video import picker (for upload-from-Drive)
router.get('/api/drive/contents', requireUser, listFolderContentsHandler);
router.post('/api/drive/import', requireUser, importVideoHandler);

// Save selected frames into a folder
router.post('/api/jobs/:jobId/drive/save', requireUser, requireOwnJob, saveToDrive);

module.exports = router;
