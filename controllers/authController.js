'use strict';

const passport = require('passport');

function safeNext(value) {
  if (!value || typeof value !== 'string') return null;
  // Only allow same-origin relative paths to avoid open-redirect.
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function showLogin(req, res) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect(safeNext(req.query.next) || '/');
  }
  res.render('login', {
    title: 'Sign in',
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    next: safeNext(req.query.next) || '',
    error: req.query.error || '',
  });
}

function startGoogle(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect('/login?error=not_configured');
  }
  const dest = safeNext(req.query.next);
  if (dest) {
    req.session.postLoginRedirect = dest;
  }
  // Persist the session before redirecting to Google so the value survives the
  // round-trip. Without this, the redirect can race with the async session save.
  req.session.save(function (err) {
    if (err) return next(err);
    passport.authenticate('google', {
      accessType: 'offline',
      prompt: 'consent',
    })(req, res, next);
  });
}

function googleCallback(req, res, next) {
  // keepSessionInfo: true tells Passport not to wipe our pre-login session data
  // (postLoginRedirect) when it regenerates the session post-authentication.
  passport.authenticate('google', {
    failureRedirect: '/login?error=auth_failed',
    keepSessionInfo: true,
  })(req, res, () => {
    const dest = req.session && req.session.postLoginRedirect;
    if (req.session) delete req.session.postLoginRedirect;
    res.redirect(safeNext(dest) || '/');
  });
}

function logout(req, res, next) {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(function () {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
}

module.exports = {
  showLogin,
  startGoogle,
  googleCallback,
  logout,
};
