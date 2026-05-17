'use strict';

const { Op } = require('sequelize');
const { Image } = require('../models');
const {
  uploadImagesToFolder,
  listFolders,
  createFolder,
} = require('../services/driveService');

async function listFoldersHandler(req, res, next) {
  try {
    const parent = (req.query.parent || 'root').toString();
    const folders = await listFolders(req.user, parent);
    res.json({ parent, folders });
  } catch (err) {
    const msg =
      (err && err.errors && err.errors[0] && err.errors[0].message) ||
      (err && err.message) ||
      'Could not list folders';
    res.status(500).json({ error: msg });
  }
}

async function createFolderHandler(req, res, next) {
  try {
    const name = (req.body.name || '').toString().trim();
    const parentId = (req.body.parentId || 'root').toString();
    if (!name) return res.status(400).json({ error: 'Folder name is required.' });
    if (name.length > 200) return res.status(400).json({ error: 'Folder name is too long.' });

    const folder = await createFolder(req.user, name, parentId);
    res.status(201).json(folder);
  } catch (err) {
    const msg =
      (err && err.errors && err.errors[0] && err.errors[0].message) ||
      (err && err.message) ||
      'Could not create folder';
    res.status(500).json({ error: msg });
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

module.exports = {
  listFoldersHandler,
  createFolderHandler,
  saveToDrive,
};
