'use strict';

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Image, Job } = require('../models');
const {
  uploadImagesToFolder,
  listFolders,
  createFolder,
  listFolderContents,
  downloadFileToPath,
} = require('../services/driveService');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '500', 10);
const ALLOWED_VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

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

async function listFolderContentsHandler(req, res, next) {
  try {
    const parent = (req.query.parent || 'root').toString();
    const items = await listFolderContents(req.user, parent);
    res.json({ parent, items });
  } catch (err) {
    const msg =
      (err && err.errors && err.errors[0] && err.errors[0].message) ||
      (err && err.message) ||
      'Could not list Drive contents';
    res.status(500).json({ error: msg });
  }
}

function pickExtensionFromName(name) {
  const ext = path.extname(name || '').toLowerCase();
  if (ALLOWED_VIDEO_EXT.includes(ext)) return ext;
  return '.mp4';
}

async function importVideoHandler(req, res, next) {
  let destPath = null;
  try {
    const fileId = (req.body.fileId || '').toString().trim();
    if (!fileId) return res.status(400).json({ error: 'fileId is required.' });

    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const localId = uuidv4();
    // We'll commit the extension after we read metadata. Use a temp name first.
    const tempPath = path.join(UPLOAD_DIR, `${localId}.tmp`);
    destPath = tempPath;

    const meta = await downloadFileToPath(req.user, fileId, tempPath);

    // Reject if mime type isn't a video.
    if (!meta.mimeType || !meta.mimeType.startsWith('video/')) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      return res.status(400).json({ error: 'That file is not a video.' });
    }

    // Reject if file exceeds the upload cap.
    if (meta.size > MAX_UPLOAD_MB * 1024 * 1024) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      return res.status(400).json({
        error: `File is too large (max ${MAX_UPLOAD_MB} MB).`,
      });
    }

    const ext = pickExtensionFromName(meta.name);
    const finalPath = path.join(UPLOAD_DIR, `${localId}${ext}`);
    fs.renameSync(tempPath, finalPath);
    destPath = finalPath;

    const job = await Job.create({
      originalFilename: meta.name,
      videoPath: finalPath,
      fps: 1,
      quality: 8,
      format: 'jpg',
      status: 'pending',
      progress: 0,
      userId: req.user.id,
    });

    res.status(201).json({
      jobId: job.id,
      originalFilename: job.originalFilename,
      sizeBytes: meta.size,
      redirect: `/options/${job.id}`,
    });
  } catch (err) {
    if (destPath) {
      try { fs.unlinkSync(destPath); } catch (_) {}
    }
    const msg =
      (err && err.errors && err.errors[0] && err.errors[0].message) ||
      (err && err.message) ||
      'Could not import the video from Drive.';
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
  listFolderContentsHandler,
  importVideoHandler,
};
