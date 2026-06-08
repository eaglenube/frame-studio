'use strict';

const express = require('express');
const { infoHandler, importHandler } = require('../controllers/youtubeController');

const router = express.Router();

router.post('/api/youtube/info', infoHandler);
router.post('/api/youtube/import', importHandler);

module.exports = router;
