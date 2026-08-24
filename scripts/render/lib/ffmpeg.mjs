/**
 * FFmpeg / FFprobe utilities
 */
import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Resolve executable based on platform
 */
function resolveExe(program) {
  if (process.platform === 'win32') {
    return `${program}.exe`;
  }
  return program;
}

/**
 * Check if ffmpeg/ffprobe is available
 */
export function checkFFmpeg() {
  try {
    execFileSync(resolveExe('ffmpeg'), ['-version'], { stdio: 'ignore' });
    execFileSync(resolveExe('ffprobe'), ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get audio duration via ffprobe
 * @param {string} filePath - absolute path to audio file
 * @returns {Promise<number>} duration in seconds
 */
export function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    const exe = resolveExe('ffprobe');
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath
    ];
    execFile(exe, args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`ffprobe failed: ${error.message}\n${stderr}`));
      }
      try {
        const data = JSON.parse(stdout);
        const duration = parseFloat(data.format?.duration);
        if (isNaN(duration)) {
          reject(new Error(`Invalid duration from ffprobe: ${stdout}`));
        } else {
          resolve(duration);
        }
      } catch (e) {
        reject(new Error(`ffprobe parse error: ${e.message}\n${stdout}`));
      }
    });
  });
}

/**
 * Get video info via ffprobe
 * @param {string} filePath
 * @returns {Promise<object>} { duration, width, height, codec, fps, audioCodec }
 */
export function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    const exe = resolveExe('ffprobe');
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate',
      '-of', 'json',
      filePath
    ];
    execFile(exe, args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`ffprobe failed: ${error.message}\n${stderr}`));
      }
      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = data.streams || [];
        const videoStream = streams.find(s => s.codec_type === 'video');
        const audioStream = streams.find(s => s.codec_type === 'audio');

        const duration = parseFloat(format.duration) || 0;
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;
        const codec = videoStream?.codec_name || '';
        const fpsStr = videoStream?.avg_frame_rate || '0/1';
        const [num, den] = fpsStr.split('/').map(Number);
        const fps = den > 0 ? num / den : 0;
        const audioCodec = audioStream?.codec_name || '';

        resolve({ duration, width, height, codec, fps, audioCodec });
      } catch (e) {
        reject(new Error(`ffprobe parse error: ${e.message}\n${stdout}`));
      }
    });
  });
}

/**
 * Escape path for FFmpeg filter (ass/subtitles filter)
 * FFmpeg requires: on Windows, colon must be escaped: C\:/path or C\:/path
 */
export function escapeFilterPath(filePath) {
  let p = filePath;
  if (process.platform === 'win32') {
    // Replace backslashes with forward slashes then escape colon
    p = p.replace(/\\/g, '/');
    // Escape colon after drive letter: C\:/path
    p = p.replace(/^([a-zA-Z]):/, '$1\\:');
  }
  return p;
}

/**
 * Create temporary file list for concat
 */
export function createConcatFile(filePaths, outputPath) {
  const absPaths = filePaths.map(p => {
    if (fs.existsSync(p)) {
      const abs = path.resolve(p);
      // On Windows, escape backslashes inside concat file
      if (process.platform === 'win32') {
        return `file '${abs.replace(/\\/g, '/')}'`;
      }
      return `file '${abs}'`;
    }
    return '';
  }).filter(Boolean);
  fs.writeFileSync(outputPath, absPaths.join('\n'), 'utf-8');
  return outputPath;
}

/**
 * Get FFmpeg version string
 */
export function getFFmpegVersion() {
  try {
    const stdout = execFileSync(resolveExe('ffmpeg'), ['-version'], { encoding: 'utf-8', timeout: 5000 });
    const line = stdout.split('\n')[0];
    return line || 'unknown';
  } catch {
    return 'not found';
  }
}

/**
 * Run FFmpeg command
 * @param {string[]} args
 * @param {object} [options={}]
 * @returns {Promise<string>} stdout
 */
export function runFFmpeg(args, options = {}) {
  return new Promise((resolve, reject) => {
    const exe = resolveExe('ffmpeg');
    execFile(exe, args, { timeout: 300000, ...options }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`FFmpeg failed: ${error.message}\n${stderr}`));
      }
      resolve(stdout || stderr);
    });
  });
}