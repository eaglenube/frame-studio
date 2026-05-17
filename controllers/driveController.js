'use strict';

const { Op } = require('sequelize');
const { Image } = require('../models');
const { uploadImagesToFolder, getFreshAccessToken } = require('../services/driveService');

async function pickerConfig(req, res, next) {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_API_KEY) {
      return res.status(503).json({
        error:
          'Google Drive integration is not fully configured. The server is missing GOOGLE_CLIENT_ID and/or GOOGLE_API_KEY.',
      });
    }
    const accessToken = await getFreshAccessToken(req.user);
    res.json({
      accessToken,
      apiKey: process.env.GOOGLE_API_KEY,
      appId: process.env.GOOGLE_APP_ID || '',
      clientId: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    next(err);
  }
}

async function saveToDrive(req, res, next) {
  try {
    const job = req.job; // attached by requireOwnJob
    const ids = Array.isArray(req.body.imageIds) ? req.body.imageIds : [];
    const folderId = req.body.folderId || null;

    if (ids.length === 0) {
      return res.status(400).json({ error: 'No images selected.' });
    }
    if (!folderId) {
      return res.status(400).json({ error: 'No destination folder selected.' });
    }

    const images = await Image.findAll({
      where: { jobId: job.id, id: { [Op.in]: ids } },
      order: [['frameNumber', 'ASC']],
    });
    if (images.length === 0) {
      return res.status(404).json({ error: 'No matching images.' });
    }

    const results = await uploadImagesToFolder(req.user, images, folderId, job.format);
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    res.json({
      ok: failed === 0,
      uploaded: succeeded,
      failed,
      total: results.length,
      results,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { pickerConfig, saveToDrive };
