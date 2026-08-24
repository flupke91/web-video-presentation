#!/usr/bin/env node
/**
 * Generate timeline from narration data and TTS audio files.
 *
 * Reads narration data from src/narration.ts (or a JSON file).
 * Reads audio durations from out/audio/.
 * Generates out/timeline/timeline.json.
 *
 * Usage: node scripts/render/generate-timeline.mjs [--narration <path>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTimeline } from './lib/timeline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

async function main() {
  const args = process.argv.slice(2);
  const narrationArgIndex = args.indexOf('--narration');
  let narrationPath = narrationArgIndex >= 0 ? args[narrationArgIndex + 1] : null;

  // Default narration source: src/narration.ts (we need to parse TS)
  // For simplicity, we can also accept a JSON file
  if (!narrationPath) {
    // Try to read from src/narration.ts? We'll look for default export
    // Better: look for out/narration.json or use TS source
    const tsPath = path.join(PROJECT_ROOT, 'src', 'narration.ts');
    const jsonPath = path.join(PROJECT_ROOT, 'out', 'narration.json');
    if (fs.existsSync(jsonPath)) {
      narrationPath = jsonPath;
    } else if (fs.existsSync(tsPath)) {
      // We'll dynamically import via ts-node? Not feasible.
      // Instead, extract narrations from ts file via regex
      console.log('→ Extracting narrations from source/narration.ts...');
      const narrations = extractNarrationsFromTs(tsPath);
      if (narrations.length === 0) {
        console.error('Error: Could not extract narrations from src/narration.ts');
        console.error('Please provide a narration JSON file via --narration flag');
        process.exit(1);
      }
      const audioDir = path.join(PROJECT_ROOT, 'out', 'audio');
      const outputPath = path.join(PROJECT_ROOT, 'out', 'timeline', 'timeline.json');
      await generateTimeline(narrations, audioDir, outputPath);
      return;
    } else {
      console.error('Error: No narration source found.');
      console.error('Provide a JSON file via --narration or create src/narration.ts');
      process.exit(1);
    }
  }

  const raw = fs.readFileSync(narrationPath, 'utf-8');
  const narrations = JSON.parse(raw);
  const audioDir = path.join(PROJECT_ROOT, 'out', 'audio');
  const outputPath = path.join(PROJECT_ROOT, 'out', 'timeline', 'timeline.json');

  await generateTimeline(narrations, audioDir, outputPath);
}

/**
 * Extract narrations from TypeScript source with a simple regex
 */
function extractNarrationsFromTs(tsPath) {
  const content = fs.readFileSync(tsPath, 'utf-8');
  const entries = [];

  // Find chapter/step/narration pattern
  const regex = /chapter:\s*(\d+),\s*step:\s*(\d+),\s*narration:\s*'([^']*)'/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    entries.push({
      chapter: parseInt(match[1]),
      step: parseInt(match[2]),
      narration: match[3],
    });
  }

  // If no match, try with double quotes
  if (entries.length === 0) {
    const regex2 = /chapter:\s*(\d+),\s*step:\s*(\d+),\s*narration:\s*"([^"]*)"/g;
    while ((match = regex2.exec(content)) !== null) {
      entries.push({
        chapter: parseInt(match[1]),
        step: parseInt(match[2]),
        narration: match[3],
      });
    }
  }

  return entries;
}

main().catch(err => {
  console.error('AUDIO_DURATION_FAILED:', err.message);
  process.exit(1);
});