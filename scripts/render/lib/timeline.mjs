/**
 * Timeline generation utilities
 */
import fs from 'fs';
import path from 'path';
import { getAudioDuration } from './ffmpeg.mjs';

/**
 * Generate timeline from narration data and audio files
 *
 * @param {Array<{chapter: number, step: number, narration: string}>} narrations
 * @param {string} audioDir - absolute path to out/audio directory
 * @param {string} outputPath - absolute path to out/timeline/timeline.json
 * @returns {Promise<Array<{chapter, step, start, end, duration, narration}>>}
 */
export async function generateTimeline(narrations, audioDir, outputPath) {
  const entries = [];
  let currentTime = 0;

  for (const n of narrations) {
    const filename = `ch${String(n.chapter).padStart(2, '0')}_step${String(n.step).padStart(2, '0')}.mp3`;
    const audioPath = path.join(audioDir, filename);

    if (!fs.existsSync(audioPath)) {
      throw new Error(`AUDIO_MISSING: ${audioPath}`);
    }
    let duration = 0;
    try {
      duration = await getAudioDuration(audioPath);
    } catch (err) {
      throw new Error(`AUDIO_DURATION_FAILED: ${filename}: ${err.message}`);
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`AUDIO_DURATION_FAILED: ${filename}: invalid duration ${duration}`);
    }

    const start = currentTime;
    const end = start + duration;
    currentTime = end;

    entries.push({
      chapter: n.chapter,
      step: n.step,
      start,
      end,
      duration,
      narration: n.narration
    });
  }

  // Write timeline to out/timeline
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2), 'utf-8');

  // Also mirror to public/timeline so Vite can serve it as /timeline/timeline.json
  const publicDir = path.resolve(path.dirname(outputPath), '..', '..', 'public', 'timeline');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(path.join(publicDir, 'timeline.json'), JSON.stringify(entries, null, 2), 'utf-8');

  console.log(`✓ Timeline generated: ${outputPath} (${entries.length} entries, total ${currentTime.toFixed(2)}s)`);
  return entries;
}

/**
 * Read timeline from file
 * @param {string} path
 * @returns {Array}
 */
export function readTimeline(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Timeline file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Validate timeline
 * @param {Array} timeline
 * @returns {object} { valid, errors }
 */
export function validateTimeline(timeline) {
  const errors = [];
  if (!Array.isArray(timeline)) {
    return { valid: false, errors: ['Timeline must be an array'] };
  }
  if (timeline.length === 0) {
    return { valid: false, errors: ['Timeline is empty'] };
  }
  let prevEnd = 0;
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];
    if (!entry.chapter || !entry.step) {
      errors.push(`Entry ${i}: missing chapter or step`);
    }
    if (typeof entry.start !== 'number' || entry.start < 0) {
      errors.push(`Entry ${i}: invalid start`);
    }
    if (typeof entry.end !== 'number' || entry.end <= entry.start) {
      errors.push(`Entry ${i}: invalid end (must be > start)`);
    }
    if (typeof entry.duration !== 'number' || entry.duration <= 0) {
      errors.push(`Entry ${i}: invalid duration`);
    }
    if (typeof entry.narration !== 'string' || entry.narration.trim().length === 0) {
      errors.push(`Entry ${i}: missing narration`);
    }
    if (i > 0 && entry.start < prevEnd) {
      errors.push(`Entry ${i}: start (${entry.start}) < prev end (${prevEnd})`);
    }
    prevEnd = entry.end;
  }
  return { valid: errors.length === 0, errors };
}