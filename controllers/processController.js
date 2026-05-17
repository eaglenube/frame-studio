'use strict';

const { Job, Image } = require('../models');
const { startExtraction } = require('../services/videoProcessor');

async function showOptions(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) {
      return res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        message: 'Job not found.',
      });
    }
    res.render('options', {
      title: 'Extraction Options',
      job,
    });
  } catch (err) {
    next(err);
  }
}

async function startJob(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    let fps = parseFloat(req.body.fps);
    if (Number.isNaN(fps) || fps <= 0) fps = 1;
    if (fps > 30) fps = 30;
    if (fps < 0.1) fps = 0.1;

    let quality = parseInt(req.body.quality, 10);
    if (Number.isNaN(quality)) quality = 8;
    if (quality < 1) quality = 1;
    if (quality > 10) quality = 10;

    const format = req.body.format === 'png' ? 'png' : 'jpg';

    let resizeWidth = null;
    if (req.body.resizeWidth && String(req.body.resizeWidth).trim() !== '') {
      const w = parseInt(req.body.resizeWidth, 10);
      if (!Number.isNaN(w) && w >= 32 && w <= 7680) {
        resizeWidth = w;
      }
    }

    await job.update({ fps, quality, format, resizeWidth });

    // Kick off async extraction; do not await
    startExtraction(job.id).catch((err) => {
      console.error('[startExtraction] failed:', err);
    });

    res.json({ jobId: job.id, redirect: `/progress/${job.id}` });
  } catch (err) {
    next(err);
  }
}

async function showProgress(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) {
      return res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        message: 'Job not found.',
      });
    }
    res.render('progress', {
      title: 'Extracting…',
      job,
    });
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const extractedCount = await Image.count({ where: { jobId: job.id } });

    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      totalImages: job.totalImages,
      extractedCount,
      errorMessage: job.errorMessage,
      originalFilename: job.originalFilename,
    });
  } catch (err) {
    next(err);
  }
}

async function showGallery(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) {
      return res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        message: 'Job not found.',
      });
    }
    if (job.status !== 'completed') {
      return res.redirect(`/progress/${job.id}`);
    }
    res.render('gallery', {
      title: 'Extracted Frames',
      job,
    });
  } catch (err) {
    next(err);
  }
}

async function listImages(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(96, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const offset = (page - 1) * limit;

    const { rows, count } = await Image.findAndCountAll({
      where: { jobId: job.id },
      order: [['frameNumber', 'ASC']],
      limit,
      offset,
    });

    res.json({
      page,
      limit,
      total: count,
      hasMore: offset + rows.length < count,
      images: rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        filepath: r.filepath,
        frameNumber: r.frameNumber,
        timestamp: r.timestamp,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showOptions,
  startJob,
  showProgress,
  getStatus,
  showGallery,
  listImages,
};
