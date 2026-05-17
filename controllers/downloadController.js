'use strict';

const path = require('path');
const fs = require('fs');
const { ZipArchive } = require('archiver');

const { Job, Image } = require('../models');
const { Op } = require('sequelize');

async function downloadSelected(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const ids = Array.isArray(req.body.imageIds) ? req.body.imageIds : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'No images selected.' });
    }

    const images = await Image.findAll({
      where: { jobId: job.id, id: { [Op.in]: ids } },
      order: [['frameNumber', 'ASC']],
    });

    if (images.length === 0) {
      return res.status(404).json({ error: 'No matching images.' });
    }

    const zipName = `extracted-images-${job.id.slice(0, 8)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });

    archive.on('warning', (err) => {
      console.warn('[archiver] warning:', err.message);
    });
    archive.on('error', (err) => {
      console.error('[archiver] error:', err);
      try {
        res.status(500).end();
      } catch (_) {
        /* ignore */
      }
    });

    archive.pipe(res);

    for (const img of images) {
      const absPath = path.join(__dirname, '..', 'public', img.filepath.replace(/^\//, ''));
      if (fs.existsSync(absPath)) {
        archive.file(absPath, { name: img.filename });
      }
    }

    archive.finalize();
  } catch (err) {
    next(err);
  }
}

module.exports = { downloadSelected };
