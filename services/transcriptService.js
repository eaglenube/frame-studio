'use strict';

const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const { nodewhisper } = require('nodejs-whisper');

const { Transcript } = require('../models');
const summaryService = require('./summaryService');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Where we cache the whisper.cpp models. Keeping them outside node_modules
// means an `npm install` won't blow them away.
const MODEL_ROOT = path.join(__dirname, '..', '.whisper-models');

// Model selection. The smaller multilingual models (tiny, base) are notably
// poor on non-English audio — especially non-Latin-script languages like
// Hindi — so we auto-pick a larger multilingual model for any non-English
// job. English jobs stay on the fast English-specialised model.
//
// Override either of these via .env if you want to force a particular size:
//   WHISPER_MODEL_EN=base.en
//   WHISPER_MODEL_MULTILINGUAL=large-v3-turbo
const MODEL_EN = process.env.WHISPER_MODEL_EN || 'base.en';
const MODEL_MULTILINGUAL =
  process.env.WHISPER_MODEL_MULTILINGUAL ||
  process.env.WHISPER_MODEL ||
  'large-v3-turbo';

function pickModelFor(language) {
  return language === 'en' ? MODEL_EN : MODEL_MULTILINGUAL;
}

const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function probeDurationSeconds(videoPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err || !metadata || !metadata.format) return resolve(0);
      resolve(parseFloat(metadata.format.duration) || 0);
    });
  });
}

// Whisper expects 16 kHz mono PCM. We pull just the audio track and resample
// in a single ffmpeg pass.
function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('error', (err) => reject(err))
      .on('end', () => resolve(audioPath))
      .save(audioPath);
  });
}

// Read the .json output that whisper.cpp writes next to the audio file.
// Returns { segments, text, detectedLanguage } or null if absent / unparseable.
function readWhisperOutput(audioPath) {
  // whisper.cpp writes results as <audioPath>.<ext>
  const jsonPath = audioPath + '.json';
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const rawSegments = raw.transcription || [];
    const segments = rawSegments.map((s) => ({
      start: s.offsets ? s.offsets.from / 1000 : null,
      end: s.offsets ? s.offsets.to / 1000 : null,
      text: (s.text || '').trim(),
    }));
    const text = segments.map((s) => s.text).join(' ').trim();
    // whisper.cpp echoes the detected language (or the one we forced) in
    // result.language. When we passed -l auto, this is genuinely what it
    // decided after running a quick language-id pass on the first 30s.
    const detectedLanguage =
      (raw.result && raw.result.language) ||
      (raw.params && raw.params.language) ||
      null;
    return { segments, text, detectedLanguage };
  } catch (err) {
    return null;
  }
}

// Pulls plain text out of the .txt file whisper.cpp emits. Used as a fallback
// if JSON parsing fails.
function readWhisperText(audioPath) {
  const txtPath = audioPath + '.txt';
  if (!fs.existsSync(txtPath)) return null;
  return fs.readFileSync(txtPath, 'utf8').trim();
}

function readWhisperSrt(audioPath) {
  const srtPath = audioPath + '.srt';
  if (!fs.existsSync(srtPath)) return null;
  return fs.readFileSync(srtPath, 'utf8');
}

// Best-effort cleanup of intermediate files. We keep these around during the
// run so a failed transcription can be inspected, but they're useless once
// the row has been finalised.
function removeIfExists(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
}

async function startTranscription(transcriptId) {
  const t = await Transcript.findByPk(transcriptId);
  if (!t) throw new Error('Transcript not found');

  ensureDir(AUDIO_DIR);
  ensureDir(MODEL_ROOT);

  const audioPath = path.join(AUDIO_DIR, `${t.id}.wav`);

  try {
    await t.update({ status: 'extracting_audio', progress: 5, errorMessage: null });
    const duration = await probeDurationSeconds(t.videoPath);
    await t.update({ durationSeconds: duration });

    await extractAudio(t.videoPath, audioPath);
    await t.update({ audioPath, status: 'transcribing', progress: 25 });

    // nodejs-whisper writes outputs next to the input file. We ask for both
    // JSON (for segments with timestamps) and TXT/SRT (for downloads).
    const modelName = pickModelFor(t.language || 'en');
    await nodewhisper(audioPath, {
      modelName,
      modelRootPath: MODEL_ROOT,
      autoDownloadModelName: modelName,
      removeWavFileAfterTranscription: false,
      whisperOptions: {
        outputInJson: true,
        outputInText: true,
        outputInSrt: true,
        language: t.language || 'en',
        splitOnWord: true,
      },
    });

    const parsed = readWhisperOutput(audioPath);
    const text = (parsed && parsed.text) || readWhisperText(audioPath) || '';
    const segments = (parsed && parsed.segments) || [];
    const srt = readWhisperSrt(audioPath) || null;
    const detectedLanguage = parsed && parsed.detectedLanguage;

    if (!text) {
      throw new Error('Transcription produced no text.');
    }

    await t.update({
      transcriptText: text,
      transcriptSrt: srt,
      transcriptSegments: segments,
      detectedLanguage,
      progress: t.summaryType === 'off' ? 100 : 75,
    });

    if (t.summaryType && t.summaryType !== 'off') {
      await t.update({ status: 'summarizing', progress: 80 });
      try {
        const summary = await summaryService.summarise(text, t.summaryType);
        await t.update({ summary, progress: 100 });
      } catch (err) {
        // A summary failure shouldn't lose the transcript. We mark the row
        // completed and surface the summary error in errorMessage.
        await t.update({
          summary: null,
          errorMessage: `Summary failed: ${(err && err.message) || err}`,
          progress: 100,
        });
      }
    }

    await t.update({ status: 'completed' });

    // Clean up the whisper sidecar files. We don't need them once the data
    // is in the DB and the .srt has been captured as a column.
    removeIfExists(audioPath + '.json');
    removeIfExists(audioPath + '.txt');
    removeIfExists(audioPath + '.srt');
  } catch (err) {
    console.error('[transcript] error:', err);
    await Transcript.update(
      {
        status: 'failed',
        errorMessage: (err && err.message) || 'Transcription failed',
      },
      { where: { id: transcriptId } }
    );
  }
}

module.exports = {
  startTranscription,
};
