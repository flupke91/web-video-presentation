#!/usr/bin/env node
/**
 * Generate subtitle files from timeline.json
 *
 * Usage: node scripts/render/generate-subtitles.mjs [--timeline <path>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readTimeline, validateTimeline } from './lib/timeline.mjs';
import { generateSubtitleFiles, validateCues } from './lib/subtitles.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

async function main() {
  const args = process.argv.slice(2);
  const timelineArgIndex = args.indexOf('--timeline');
  let timelinePath = timelineArgIndex >= 0 ? args[timelineArgIndex + 1] : null;

  if (!timelinePath) {
    timelinePath = path.join(PROJECT_ROOT, 'out', 'timeline', 'timeline.json');
  }

  if (!fs.existsSync(timelinePath)) {
    console.error(`Error: Timeline file not found at ${timelinePath}`);
    console.error('Run "npm run render:audio" first to generate timeline.');
    process.exit(1);
  }

  console.log(`→ Reading timeline from ${timelinePath}`);
  const timeline = readTimeline(timelinePath);

  const validation = validateTimeline(timeline);
  if (!validation.valid) {
    console.error('TIMELINE_INVALID:', validation.errors.join('; '));
    process.exit(1);
  }

  const totalDuration = timeline[timeline.length - 1].end;
  const outSubtitlesDir = path.join(PROJECT_ROOT, 'out', 'subtitles');

  console.log(`→ Generating subtitles (${timeline.length} entries, ${totalDuration.toFixed(2)}s)`);
  const { cues, srtPath, assPath } = generateSubtitleFiles(timeline, outSubtitlesDir);

  console.log(`✓ SRT: ${srtPath} (${cues.length} cues)`);
  console.log(`✓ ASS: ${assPath} (${cues.length} cues)`);

  // Validate generated cues
  const cueValidation = validateCues(cues, totalDuration);
  if (!cueValidation.valid) {
    console.warn('⚠ Subtitle validation warnings:', cueValidation.errors.join('; '));
  }
}

main().catch(err => {
  console.error('SUBTITLE_GENERATION_FAILED:', err.message);
  process.exit(1);
});