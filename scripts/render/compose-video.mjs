#!/usr/bin/env node
/**
 * Compose final video from raw recording, TTS audio, and ASS subtitles.
 *
 * Steps:
 * 1. Build full audio from all segments (concat)
 * 2. Check raw video duration vs audio duration vs timeline duration
 * 3. Compose: video + audio + subtitles = final.mp4
 *
 * Usage: node scripts/render/compose-video.mjs [options]
 *
 * Options:
 *   --raw <path>        Path to raw recording.webm (default: out/raw/recording.webm)
 *   --force             Force compose even if duration mismatch
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readTimeline, validateTimeline } from './lib/timeline.mjs';
import { getVideoInfo, runFFmpeg, checkFFmpeg, createConcatFile, escapeFilterPath } from './lib/ffmpeg.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const DURATION_MISMATCH_THRESHOLD = 0.1; // 100ms

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const rawArgIndex = args.indexOf('--raw');
  let rawVideoPath = rawArgIndex >= 0 ? args[rawArgIndex + 1] : null;

  if (!checkFFmpeg()) {
    console.error('FFMPEG_FAILED: ffmpeg/ffprobe not found');
    process.exit(1);
  }

  const outDir = {
    audio: path.join(PROJECT_ROOT, 'out', 'audio'),
    raw: path.join(PROJECT_ROOT, 'out', 'raw'),
    subtitles: path.join(PROJECT_ROOT, 'out', 'subtitles'),
    final: path.join(PROJECT_ROOT, 'out', 'final'),
    timeline: path.join(PROJECT_ROOT, 'out', 'timeline'),
  };

  // Ensure dirs exist
  for (const dir of Object.values(outDir)) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // 1. Read timeline
  const timelinePath = path.join(outDir.timeline, 'timeline.json');
  if (!fs.existsSync(timelinePath)) {
    console.error('FFMPEG_FAILED: timeline.json not found');
    process.exit(1);
  }
  const timeline = readTimeline(timelinePath);
  const timelineValidation = validateTimeline(timeline);
  if (!timelineValidation.valid) {
    console.error('TIMELINE_INVALID:', timelineValidation.errors.join('; '));
    process.exit(1);
  }

  const totalTimelineDuration = timeline[timeline.length - 1].end;

  // 2. Locate raw video
  if (!rawVideoPath) {
    // Find the webm file in raw dir
    const rawFiles = fs.readdirSync(outDir.raw);
    const webmFile = rawFiles.find(f => f.endsWith('.webm'));
    if (!webmFile) {
      console.error('FFMPEG_FAILED: No raw .webm file found in out/raw/');
      process.exit(1);
    }
    rawVideoPath = path.join(outDir.raw, webmFile);
  }

  if (!fs.existsSync(rawVideoPath)) {
    console.error(`FFMPEG_FAILED: Raw video not found: ${rawVideoPath}`);
    process.exit(1);
  }

  console.log(`→ Raw video: ${rawVideoPath}`);

  // 3. Build full audio
  const audioFiles = timeline.map(entry => {
    const filename = `ch${String(entry.chapter).padStart(2, '0')}_step${String(entry.step).padStart(2, '0')}.mp3`;
    return path.join(outDir.audio, filename);
  });

  const fullAudioPath = path.join(outDir.audio, 'full.mp3');
  console.log('→ Building full audio...');
  await buildFullAudio(audioFiles, fullAudioPath);
  console.log(`✓ Full audio: ${fullAudioPath}`);

  // 4. Get durations
  console.log('→ Analyzing durations...');
  const videoInfo = await getVideoInfo(rawVideoPath);
  const audioInfo = await getVideoInfo(fullAudioPath); // same function works for audio
  const videoDuration = videoInfo.duration;
  const audioDuration = audioInfo.duration;

  console.log(`  Video duration: ${videoDuration.toFixed(3)}s`);
  console.log(`  Audio duration: ${audioDuration.toFixed(3)}s`);
  console.log(`  Timeline duration: ${totalTimelineDuration.toFixed(3)}s`);

  // Check mismatches
  const videoAudioDiff = Math.abs(videoDuration - audioDuration);
  const videoTimelineDiff = Math.abs(videoDuration - totalTimelineDuration);
  const audioTimelineDiff = Math.abs(audioDuration - totalTimelineDuration);

  if (videoAudioDiff > DURATION_MISMATCH_THRESHOLD || videoTimelineDiff > DURATION_MISMATCH_THRESHOLD || audioTimelineDiff > DURATION_MISMATCH_THRESHOLD) {
    console.warn(`⚠ Duration mismatch detected:`);
    console.warn(`  Video vs Audio: ${videoAudioDiff.toFixed(3)}s`);
    console.warn(`  Video vs Timeline: ${videoTimelineDiff.toFixed(3)}s`);
    console.warn(`  Audio vs Timeline: ${audioTimelineDiff.toFixed(3)}s`);
    if (!force) {
      console.error('FFMPEG_FAILED: Duration mismatch exceeds threshold. Use --force to ignore.');
      process.exit(1);
    }
    console.log('  (--force: continuing)');
  }

  // 5. Compose final video
  const finalVideoPath = path.join(outDir.final, 'video.mp4');
  console.log('→ Composing final video...');
  await composeFinalVideo(rawVideoPath, fullAudioPath, outDir.subtitles, finalVideoPath, totalTimelineDuration);
  console.log(`✓ Final video: ${finalVideoPath}`);

  // 6. Save duration info
  const durationInfo = {
    videoDuration,
    audioDuration,
    timelineDuration: totalTimelineDuration,
    videoAudioDiff,
    videoTimelineDiff,
    audioTimelineDiff,
    threshold: DURATION_MISMATCH_THRESHOLD,
  };
  const qaDir = path.join(PROJECT_ROOT, 'out', 'qa');
  if (!fs.existsSync(qaDir)) fs.mkdirSync(qaDir, { recursive: true });
  fs.writeFileSync(path.join(qaDir, 'duration.json'), JSON.stringify(durationInfo, null, 2), 'utf-8');
  console.log('✓ Duration info saved');
}

/**
 * Build full audio by concatenating all segments
 */
async function buildFullAudio(audioFiles, outputPath) {
  // Filter existing files
  const existingFiles = audioFiles.filter(f => fs.existsSync(f));
  if (existingFiles.length === 0) {
    throw new Error('No audio files found');
  }

  if (existingFiles.length === 1) {
    // Just copy
    fs.copyFileSync(existingFiles[0], outputPath);
    return;
  }

  // Use concat demuxer with absolute paths
  const concatFile = path.join(path.dirname(outputPath), 'concat.txt');
  createConcatFile(existingFiles, concatFile);

  // Run ffmpeg concat
  const args = [
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    '-y',
    outputPath,
  ];
  await runFFmpeg(args);
}

/**
 * Compose final video with audio and subtitles
 */
async function composeFinalVideo(rawVideo, audioPath, subtitlesDir, outputPath, targetDuration) {
  const assPath = path.join(subtitlesDir, 'subtitles.ass');
  const srtPath = path.join(subtitlesDir, 'subtitles.srt');

  // Prefer ASS
  const subtitlePath = fs.existsSync(assPath) ? assPath : (fs.existsSync(srtPath) ? srtPath : null);

  const args = [
    '-i', rawVideo,
    '-i', audioPath,
    '-map', '0:v',
    '-map', '1:a',
  ];

  // Add subtitles filter if available
  if (subtitlePath) {
    console.log(`  Subtitle: ${subtitlePath}`);
    const escapedPath = escapeFilterPath(subtitlePath);
    const ext = path.extname(subtitlePath).toLowerCase();
    if (ext === '.ass') {
      args.push('-vf', `ass='${escapedPath}'`);
    } else {
      args.push('-vf', `subtitles='${escapedPath}'`);
    }
  }

  // Target duration: use audio duration (or timeline)
  // We'll use -shortest with -t to ensure exact duration
  args.push(
    '-t', String(targetDuration.toFixed(3)),
    '-c:v', 'libx264',
    '-crf', '20',
    '-preset', 'medium',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    '-pix_fmt', 'yuv420p',
    '-y',
    outputPath
  );

  await runFFmpeg(args);
}

main().catch(err => {
  console.error('FFMPEG_FAILED:', err.message);
  process.exit(1);
});