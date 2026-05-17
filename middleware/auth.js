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

// For routes that have :jobId in path. Anonymous jobs (userId = null) are
// accessible to anyone with the URL — UUIDs are unguessable. Owned jobs are
// restricted to the owner once claimed.
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
    if (job.userId) {
      if (!req.user || job.userId !== req.user.id) {
        if (req.path.startsWith('/api/')) {
          return res.status(403).json({ error: 'Not your job.' });
        }
        return res.status(403).render('error', {
          title: 'Forbidden',
          statusCode: 403,
          message: 'This job belongs to another account.',
        });
      }
    }
    req.job = job;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireUser, requireOwnJob };
