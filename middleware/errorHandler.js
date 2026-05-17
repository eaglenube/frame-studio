'use strict';

const multer = require('multer');

function notFound(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).render('error', {
    title: 'Not Found',
    statusCode: 404,
    message: 'The page you are looking for does not exist.',
  });
}

function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong.';

  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file is too large.';
    }
  }

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: message });
  }

  res.status(status).render('error', {
    title: 'Error',
    statusCode: status,
    message,
  });
}

module.exports = { notFound, errorHandler };
