'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// We shell out to `yt-dlp` because it's the only YouTube downloader that
// keeps pace with YouTube's anti-scraping changes (PoToken / signature
// rotations / format gating). Pure-JS libraries break repeatedly on newer
// videos. This adds a one-time system-dependency: the operator must install
// `yt-dlp` (`brew install yt-dlp` on macOS, `pip install yt-dlp`, or a
// pre-built binary).
const YT_DLP_BIN = process.env.YT_DLP_PATH || 'yt-dlp';

// The folder where @ffmpeg-installer dropped its bundled binary — passed to
// yt-dlp so it can merge separate audio/video streams without requiring a
// system-wide ffmpeg install.
const FFMPEG_DIR = path.dirname(ffmpegInstaller.path);

// Recognised YouTube hostnames. Anything outside this set is rejected.
const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

// Pulls the 11-character video id out of any common YouTube URL shape.
// Returns null if the URL isn't a YouTube watch/short/embed link.
function parseYouTubeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch (_) {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (!YT_HOSTS.has(host)) return null;

  let id = null;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.replace(/^\/+/, '').split('/')[0] || null;
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else if (url.pathname.startsWith('/shorts/')) {
    id = url.pathname.split('/')[2] || null;
  } else if (url.pathname.startsWith('/embed/')) {
    id = url.pathname.split('/')[2] || null;
  } else if (url.pathname.startsWith('/v/')) {
    id = url.pathname.split('/')[2] || null;
  } else if (url.pathname.startsWith('/live/')) {
    id = url.pathname.split('/')[2] || null;
  }

  if (!id) return null;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return id;
}

function canonicalUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Runs yt-dlp with the given args. Resolves with { stdout, stderr } when the
// process exits 0; rejects with an Error that includes stderr otherwise.
function runYtDlp(args, { onStderrLine } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(YT_DLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      reject(err);
      return;
    }

    let stdout = '';
    let stderr = '';
    let stderrBuf = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (onStderrLine) {
        stderrBuf += chunk;
        let idx;
        while ((idx = stderrBuf.indexOf('\n')) !== -1) {
          const line = stderrBuf.slice(0, idx);
          stderrBuf = stderrBuf.slice(idx + 1);
          onStderrLine(line);
        }
      }
    });

    child.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        const e = new Error(
          'yt-dlp is not installed. Install with `brew install yt-dlp` (macOS) or `pip install yt-dlp`.'
        );
        e.code = 'YTDLP_MISSING';
        reject(e);
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const err = new Error(parseYtDlpError(stderr) || `yt-dlp exited with code ${code}`);
        err.stderr = stderr;
        err.exitCode = code;
        reject(err);
      }
    });
  });
}

// Pull the last "ERROR:" line out of yt-dlp stderr — it's the most useful
// thing to show a user. Falls back to the first non-empty line.
function parseYtDlpError(stderr) {
  if (!stderr) return null;
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errLines = lines.filter((l) => /^ERROR:/i.test(l));
  if (errLines.length > 0) {
    return errLines[errLines.length - 1].replace(/^ERROR:\s*/i, '');
  }
  return lines[0] || null;
}

// Returns { videoId, title, lengthSeconds, thumbnail, author, isLive } or throws.
async function getVideoInfo(input) {
  const videoId = parseYouTubeUrl(input);
  if (!videoId) {
    const e = new Error('Not a valid YouTube URL.');
    e.code = 'INVALID_URL';
    throw e;
  }

  const { stdout } = await runYtDlp([
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    '--dump-single-json',
    canonicalUrl(videoId),
  ]);

  let meta;
  try {
    meta = JSON.parse(stdout);
  } catch (_) {
    throw new Error('Could not parse YouTube metadata.');
  }

  return {
    videoId,
    title: meta.title || `youtube-${videoId}`,
    author: meta.uploader || meta.channel || null,
    lengthSeconds: typeof meta.duration === 'number' ? Math.round(meta.duration) : null,
    thumbnail: meta.thumbnail || null,
    isLive: !!(meta.is_live || meta.was_live),
  };
}

// Streams the chosen video to destPath. We only need frames — audio doesn't
// matter — so we ask yt-dlp for the best video-only mp4 it can find, falling
// back to a progressive (audio+video) stream if necessary. Returns:
// { bytes, title, container }.
async function downloadVideoToPath(videoId, destPath, { maxBytes } = {}) {
  // yt-dlp wants an output template; we pass the final destPath directly so
  // it writes exactly where we expect.
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--restrict-filenames',
    '--ffmpeg-location', FFMPEG_DIR,
    '-f', 'bv*[ext=mp4]/bv*/b[ext=mp4]/b',
    '--merge-output-format', 'mp4',
    '-o', destPath,
    canonicalUrl(videoId),
  ];

  if (maxBytes && maxBytes > 0) {
    // yt-dlp will refuse to start downloading any single format that exceeds
    // this size, surfacing a clear error rather than truncating mid-stream.
    args.push('--max-filesize', String(maxBytes));
  }

  try {
    await runYtDlp(args);
  } catch (err) {
    if (err && err.stderr && /File is larger than max-filesize/i.test(err.stderr)) {
      const e = new Error('Video is larger than the upload limit.');
      e.code = 'TOO_LARGE';
      throw e;
    }
    throw err;
  }

  if (!fs.existsSync(destPath)) {
    throw new Error('yt-dlp reported success but no output file was written.');
  }

  const stat = fs.statSync(destPath);

  // Look up the title with a separate metadata call — keeps the download
  // command simple. (We could also have yt-dlp print it via --print, but
  // the metadata call is cheap and we already have the helper.)
  let title = null;
  try {
    const info = await getVideoInfo(canonicalUrl(videoId));
    title = info.title;
  } catch (_) {
    // Non-fatal — the caller has a fallback name.
  }

  return {
    bytes: stat.size,
    title,
    container: path.extname(destPath).replace(/^\./, '') || 'mp4',
  };
}

module.exports = {
  parseYouTubeUrl,
  getVideoInfo,
  downloadVideoToPath,
};
