#!/usr/bin/env node
/**
 * Inspect a video file via ffprobe and output metadata.
 *
 * Usage: node scripts/render/inspect-video.mjs <video-path>
 */

import fs from 'fs';
import { getVideoInfo, checkFFmpeg, getFFmpegVersion } from './lib/ffmpeg.mjs';

async function main() {
  const args = process.argv.slice(2);
  const videoPath = args[0];

  if (!videoPath) {
    console.error('Usage: node scripts/render/inspect-video.mjs <video-path>');
    process.exit(1);
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`File not found: ${videoPath}`);
    process.exit(1);
  }

  if (!checkFFmpeg()) {
    console.error('ffmpeg/ffprobe not found');
    process.exit(1);
  }

  try {
    const info = await getVideoInfo(videoPath);
    console.log('=== Video Info ===');
    console.log('File:', videoPath);
    console.log('Duration:', info.duration.toFixed(3), 's');
    console.log('Resolution:', info.width, 'x', info.height);
    console.log('Video codec:', info.codec);
    console.log('FPS:', info.fps.toFixed(2));
    console.log('Audio codec:', info.audioCodec);
    console.log('FFmpeg:', getFFmpegVersion());
  } catch (err) {
    console.error('Inspect failed:', err.message);
    process.exit(1);
  }
}

main();