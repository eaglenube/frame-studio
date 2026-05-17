'use strict';

const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

const { User } = require('../models');

const DRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  // Read-only metadata access lets us list the user's existing folders for the
  // custom folder explorer. We never read file contents, only names/IDs.
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    (process.env.APP_URL || 'http://localhost:3000') + '/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn(
      '[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in .env — Google sign-in disabled.'
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: DRIVE_SCOPES,
        accessType: 'offline',
        prompt: 'consent', // ensures refresh_token on first login
      },
      async (accessToken, refreshToken, params, profile, done) => {
        try {
          const email =
            (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
          const picture =
            (profile.photos && profile.photos[0] && profile.photos[0].value) || null;
          const tokenExpiry = params && params.expires_in
            ? new Date(Date.now() + params.expires_in * 1000)
            : null;

          const [user, created] = await User.findOrCreate({
            where: { googleId: profile.id },
            defaults: {
              email: email || '',
              name: profile.displayName || null,
              picture,
              accessToken,
              refreshToken: refreshToken || null,
              tokenExpiry,
              lastLoginAt: new Date(),
            },
          });

          if (!created) {
            const updates = {
              email: email || user.email,
              name: profile.displayName || user.name,
              picture: picture || user.picture,
              accessToken,
              tokenExpiry,
              lastLoginAt: new Date(),
            };
            if (refreshToken) updates.refreshToken = refreshToken;
            await user.update(updates);
          }

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

module.exports = { configurePassport, DRIVE_SCOPES };
