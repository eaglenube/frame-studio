'use strict';

const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

const { Job, Image } = require('../models');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const EXTRACTED_ROOT = path.join(__dirname, '..', 'public', 'extracted');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function probeDurationSeconds(videoPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err || !metadata || !metadata.format) {
        return resolve(0);
      }
      resolve(parseFloat(metadata.format.duration) || 0);
    });
  });
}

// Map UI 1..10 -> ffmpeg -q:v 31..2 (lower = better quality)
function mapQualityToFfmpeg(uiQuality) {
  const q = Math.max(1, Math.min(10, parseInt(uiQuality, 10) || 5));
  // 1 -> 31 (worst), 10 -> 2 (best)
  return Math.round(31 - ((q - 1) * (31 - 2)) / 9);
}

async function startExtraction(jobId) {
  const job = await Job.findByPk(jobId);
  if (!job) throw new Error('Job not found');

  const outputDir = path.join(EXTRACTED_ROOT, jobId);
  ensureDir(outputDir);

  // Clear any previous output for this job
  try {
    const existing = fs.readdirSync(outputDir);
    existing.forEach((f) => {
      try {
        fs.unlinkSync(path.join(outputDir, f));
      } catch (_) {
        /* ignore */
      }
    });
  } catch (_) {
    /* ignore */
  }

  await job.update({ status: 'processing', progress: 0, errorMessage: null });

  const duration = await probeDurationSeconds(job.videoPath);
  const ext = job.format === 'png' ? 'png' : 'jpg';
  const outputPattern = path.join(outputDir, `frame-%06d.${ext}`);

  const filters = [`fps=${job.fps}`];
  if (job.resizeWidth && job.resizeWidth > 0) {
    filters.push(`scale=${job.resizeWidth}:-2`);
  }

  const command = ffmpeg(job.videoPath)
    .outputOptions([
      '-vf', filters.join(','),
      '-vsync', 'vfr',
    ]);

  if (ext === 'jpg') {
    command.outputOptions(['-q:v', String(mapQualityToFfmpeg(job.quality))]);
  } else {
    // PNG compression: 0 (none/fast) - 9 (max). Map UI quality so high quality = lower compression
    const pngCompression = Math.max(0, Math.min(9, 10 - (parseInt(job.quality, 10) || 5)));
    command.outputOptions(['-compression_level', String(pngCompression)]);
  }

  command.output(outputPattern);

  // Track progress
  command.on('progress', async (info) => {
    let pct = 0;
    if (info.percent && !Number.isNaN(info.percent)) {
      pct = Math.max(0, Math.min(99, Math.round(info.percent)));
    } else if (info.timemark && duration > 0) {
      const parts = info.timemark.split(':');
      const seconds =
        parseFloat(parts[0]) * 3600 +
        parseFloat(parts[1]) * 60 +
        parseFloat(parts[2]);
      pct = Math.max(0, Math.min(99, Math.round((seconds / duration) * 100)));
    }
    try {
      await Job.update({ progress: pct }, { where: { id: jobId } });
    } catch (_) {
      /* ignore transient errors */
    }
  });

  command.on('end', async () => {
    try {
      const files = fs
        .readdirSync(outputDir)
        .filter((f) => f.toLowerCase().endsWith(`.${ext}`))
        .sort();

      const rows = files.map((filename, idx) => {
        const frameNumber = idx + 1;
        const timestamp = job.fps > 0 ? frameNumber / job.fps : 0;
        return {
          jobId,
          filename,
          filepath: `/extracted/${jobId}/${filename}`,
          frameNumber,
          timestamp,
        };
      });

      if (rows.length > 0) {
        await Image.bulkCreate(rows);
      }

      await Job.update(
        {
          status: 'completed',
          progress: 100,
          totalImages: rows.length,
        },
        { where: { id: jobId } }
      );
      console.log(`[ffmpeg] job ${jobId} completed: ${rows.length} frames`);
    } catch (err) {
      console.error('[ffmpeg] finalization error:', err);
      await Job.update(
        {
          status: 'failed',
          errorMessage: err.message || 'Finalization failed',
        },
        { where: { id: jobId } }
      );
    }
  });

  command.on('error', async (err) => {
    console.error('[ffmpeg] error:', err && err.message);
    await Job.update(
      {
        status: 'failed',
        errorMessage: (err && err.message) || 'ffmpeg failed',
      },
      { where: { id: jobId } }
    );
  });

  command.run();
}

module.exports = {
  startExtraction,
  mapQualityToFfmpeg,
};
