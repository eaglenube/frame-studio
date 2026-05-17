'use strict';

const passport = require('passport');

function showLogin(req, res) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('login', {
    title: 'Sign in',
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
}

function startGoogle(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect('/login?error=not_configured');
  }
  passport.authenticate('google', {
    accessType: 'offline',
    prompt: 'consent',
  })(req, res, next);
}

function googleCallback(req, res, next) {
  passport.authenticate('google', {
    failureRedirect: '/login?error=auth_failed',
  })(req, res, () => {
    res.redirect('/');
  });
}

function logout(req, res, next) {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(function () {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
}

module.exports = {
  showLogin,
  startGoogle,
  googleCallback,
  logout,
};
