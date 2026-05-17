'use strict';

const express = require('express');
const {
  listFoldersHandler,
  createFolderHandler,
  saveToDrive,
} = require('../controllers/driveController');
const { requireUser, requireOwnJob } = require('../middleware/auth');

const router = express.Router();

router.get('/api/drive/folders', requireUser, listFoldersHandler);
router.post('/api/drive/folders', requireUser, createFolderHandler);
router.post('/api/jobs/:jobId/drive/save', requireUser, requireOwnJob, saveToDrive);

module.exports = router;
