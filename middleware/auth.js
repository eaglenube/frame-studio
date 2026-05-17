'use strict';

const { Job } = require('../models');

function requireUser(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  return res.redirect('/login');
}

// For routes that have :jobId in path — ensure the job belongs to the user.
async function requireOwnJob(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Job not found.' });
      }
      return res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        message: 'Job not found.',
      });
    }
    if (job.userId && req.user && job.userId !== req.user.id) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Not your job.' });
      }
      return res.status(403).render('error', {
        title: 'Forbidden',
        statusCode: 403,
        message: 'This job belongs to another account.',
      });
    }
    req.job = job;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireUser, requireOwnJob };
