'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { Job } = require('../models');

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '500', 10);
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const ALLOWED_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'application/octet-stream', // some browsers send this for mkv/avi
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = uuidv4();
    cb(null, `${id}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return cb(new Error('Unsupported file type. Use MP4, MOV, AVI, MKV, or WEBM.'));
  }
  cb(null, true);
}

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
});

const uploadMiddleware = uploader.single('video');

async function handleUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const job = await Job.create({
      originalFilename: req.file.originalname,
      videoPath: req.file.path,
      fps: 1,
      quality: 8,
      format: 'jpg',
      status: 'pending',
      progress: 0,
      userId: (req.user && req.user.id) || null,
    });

    res.status(201).json({
      jobId: job.id,
      originalFilename: job.originalFilename,
      sizeBytes: req.file.size,
      redirect: `/options/${job.id}`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadMiddleware,
  handleUpload,
  ALLOWED_EXT,
  ALLOWED_MIME,
  MAX_UPLOAD_MB,
};
