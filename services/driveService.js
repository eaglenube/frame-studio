'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const { User } = require('../models');

function buildOAuth2Client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials are not configured.');
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    (APP_URL || 'http://localhost:3000') + '/auth/google/callback'
  );
}

// Build a client with the user's stored tokens. Refreshes the access token if expired.
async function getClientForUser(user) {
  const oauth2 = buildOAuth2Client();
  oauth2.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expiry_date: user.tokenExpiry ? new Date(user.tokenExpiry).getTime() : undefined,
  });

  // If expired (or about to be) and we have a refresh token, refresh.
  const expiry = user.tokenExpiry ? new Date(user.tokenExpiry).getTime() : 0;
  const isExpired = !expiry || expiry < Date.now() + 60 * 1000;

  if (isExpired && user.refreshToken) {
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);
    await User.update(
      {
        accessToken: credentials.access_token || user.accessToken,
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
      { where: { id: user.id } }
    );
  }

  return oauth2;
}

function mimeForFormat(format) {
  if ((format || '').toLowerCase() === 'png') return 'image/png';
  return 'image/jpeg';
}

async function uploadImagesToFolder(user, images, folderId, format) {
  const auth = await getClientForUser(user);
  const drive = google.drive({ version: 'v3', auth });

  const results = [];
  for (const img of images) {
    const absPath = path.join(__dirname, '..', 'public', img.filepath.replace(/^\//, ''));
    if (!fs.existsSync(absPath)) {
      results.push({ id: img.id, ok: false, error: 'file missing' });
      continue;
    }
    try {
      const res = await drive.files.create({
        requestBody: {
          name: img.filename,
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType: mimeForFormat(format),
          body: fs.createReadStream(absPath),
        },
        fields: 'id,name',
      });
      results.push({ id: img.id, ok: true, driveFileId: res.data.id, name: res.data.name });
    } catch (err) {
      const msg = (err && err.errors && err.errors[0] && err.errors[0].message) ||
        (err && err.message) || 'upload failed';
      results.push({ id: img.id, ok: false, error: msg });
    }
  }
  return results;
}

async function getFreshAccessToken(user) {
  const auth = await getClientForUser(user);
  const tokenInfo = auth.credentials;
  return tokenInfo.access_token || user.accessToken;
}

// List child folders of a given parent. parentId='root' lists My Drive root.
async function listFolders(user, parentId) {
  const auth = await getClientForUser(user);
  const drive = google.drive({ version: 'v3', auth });
  const parent = parentId || 'root';
  const q = [
    `'${parent.replace(/'/g, "\\'")}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
  ].join(' and ');

  const res = await drive.files.list({
    q,
    pageSize: 200,
    orderBy: 'folder,name',
    fields: 'files(id,name)',
  });

  return (res.data.files || []).map((f) => ({ id: f.id, name: f.name }));
}

// Fetch a single folder's metadata (name + parent) — used to walk up for breadcrumbs.
async function getFolderMeta(user, folderId) {
  const auth = await getClientForUser(user);
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,parents,mimeType',
  });
  return {
    id: res.data.id,
    name: res.data.name,
    parents: res.data.parents || [],
  };
}

async function createFolder(user, name, parentId) {
  const auth = await getClientForUser(user);
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId && parentId !== 'root' ? [parentId] : undefined,
    },
    fields: 'id,name,webViewLink',
  });
  return { id: res.data.id, name: res.data.name, webViewLink: res.data.webViewLink };
}

module.exports = {
  buildOAuth2Client,
  getClientForUser,
  uploadImagesToFolder,
  getFreshAccessToken,
  listFolders,
  getFolderMeta,
  createFolder,
};
