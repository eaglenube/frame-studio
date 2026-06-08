'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { Transcript } = require('../models');
const { startTranscription } = require('../services/transcriptService');

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '500', 10);
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const ALLOWED_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];

// Order matters here — the upload page renders the dropdown in this order
// and selects the FIRST entry by default, so 'auto' sits at the top to make
// auto-detect the default choice.
const ALLOWED_LANGUAGES = [
  'auto',
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'uk', 'tr',
  'zh', 'ja', 'ko', 'ar', 'hi', 'bn', 'ta', 'te', 'mr', 'ur',
  'id', 'th', 'vi', 'sv', 'no', 'da', 'fi', 'cs', 'el', 'he',
];

const ALLOWED_SUMMARY = ['off', 'general', 'meeting', 'interview', 'podcast', 'news'];

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return cb(new Error('Unsupported file type. Use MP4, MOV, MKV, WEBM, MP3, WAV, or M4A.'));
  }
  cb(null, true);
}

const uploader = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

const uploadMiddleware = uploader.single('video');

function showUpload(req, res) {
  res.render('transcript-upload', {
    title: 'Generate a Transcript',
    maxUploadMb: MAX_UPLOAD_MB,
    languages: ALLOWED_LANGUAGES,
    summaryStyles: ALLOWED_SUMMARY,
  });
}

async function handleUpload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const language = ALLOWED_LANGUAGES.includes(req.body.language) ? req.body.language : 'auto';
    const summaryType = ALLOWED_SUMMARY.includes(req.body.summaryType) ? req.body.summaryType : 'off';

    const transcript = await Transcript.create({
      originalFilename: req.file.originalname,
      videoPath: req.file.path,
      language,
      summaryType,
      status: 'pending',
      progress: 0,
      userId: (req.user && req.user.id) || null,
    });

    // Kick off async transcription, don't block the response.
    startTranscription(transcript.id).catch((err) => {
      console.error('[startTranscription] failed:', err);
    });

    res.status(201).json({
      transcriptId: transcript.id,
      redirect: `/transcript/${transcript.id}/progress`,
    });
  } catch (err) {
    next(err);
  }
}

async function showProgress(req, res, next) {
  try {
    const t = await Transcript.findByPk(req.params.id);
    if (!t) {
      return res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        message: 'Transcript not found.',
      });
    }
    if (t.status === 'completed') {
      return res.redirect(`/transcript/${t.id}`);
    }
    res.render('transcript-progress', {
      title: 'Transcribing…',
      transcript: t,
    });
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const t = await Transcript.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Transcript not found' });
    res.json({
      id: t.id,
      status: t.status,
      progress: t.progress,
      summaryType: t.summaryType,
      errorMessage: t.errorMessage,
      originalFilename: t.originalFilename,
    });
  } catch (err) {
    next(err);
  }
}

async function showResult(req, res, next) {
  try {
    const t = await Transcript.findByPk(req.params.id);
    if (!t) {
      return res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        message: 'Transcript not found.',
      });
    }
    if (t.status !== 'completed' && t.status !== 'failed') {
      return res.redirect(`/transcript/${t.id}/progress`);
    }
    res.render('transcript-result', {
      title: t.originalFilename + ' · Transcript',
      transcript: t,
    });
  } catch (err) {
    next(err);
  }
}

async function downloadTranscript(req, res, next) {
  try {
    const t = await Transcript.findByPk(req.params.id);
    if (!t || t.status !== 'completed') {
      return res.status(404).json({ error: 'Transcript not ready.' });
    }
    const fmt = (req.query.format || 'txt').toLowerCase();
    const baseName = (t.originalFilename || 'transcript').replace(/\.[^.]+$/, '');

    if (fmt === 'srt') {
      res.setHeader('Content-Type', 'application/x-subrip');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.srt"`);
      return res.send(t.transcriptSrt || '');
    }
    if (fmt === 'md' && t.summary) {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}-summary.md"`);
      return res.send(t.summary);
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.txt"`);
    res.send(t.transcriptText || '');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadMiddleware,
  handleUpload,
  showUpload,
  showProgress,
  getStatus,
  showResult,
  downloadTranscript,
};
