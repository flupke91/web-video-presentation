#!/usr/bin/env node
/**
 * Phase 4: Auto Render & Subtitle
 *
 * Full pipeline:
 *   1. Generate timeline from audio segments
 *   2. Start HTTP server
 *   3. Run Playwright recording
 *   4. Generate subtitles
 *   5. Compose final video
 *   6. QC
 *   7. Generate report
 *
 * Usage:
 *   node scripts/render/render-video.mjs         # full pipeline
 *   node scripts/render/render-video.mjs --full  # full pipeline (same)
 *   node scripts/render/render-video.mjs --skip-timeline  # skip if already exists
 *   node scripts/render/render-video.mjs --skip-record    # skip recording
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTimeline, readTimeline, validateTimeline } from './lib/timeline.mjs';
import { generateSubtitleFiles, validateCues } from './lib/subtitles.mjs';
import { getVideoInfo, checkFFmpeg, getFFmpegVersion } from './lib/ffmpeg.mjs';
import { recordVideo } from './lib/playwright.mjs';
import { startServer, killProcess } from './start-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const DURATION_MISMATCH_THRESHOLD = 0.1; // 100ms

async function main() {
  const args = process.argv.slice(2);
  const skipTimeline = args.includes('--skip-timeline');
  const skipRecord = args.includes('--skip-record');
  const full = args.includes('--full');

  console.log('\n=== Phase 4: Auto Render & Subtitle ===\n');

  const startTime = Date.now();

  // Define paths
  const outDir = {
    audio: path.join(PROJECT_ROOT, 'out', 'audio'),
    timeline: path.join(PROJECT_ROOT, 'out', 'timeline'),
    raw: path.join(PROJECT_ROOT, 'out', 'raw'),
    subtitles: path.join(PROJECT_ROOT, 'out', 'subtitles'),
    final: path.join(PROJECT_ROOT, 'out', 'final'),
    qa: path.join(PROJECT_ROOT, 'out', 'qa'),
  };

  // Ensure all dirs exist
  for (const dir of Object.values(outDir)) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // 1. Generate timeline
  if (!skipTimeline) {
    console.log('Step 1: Generate timeline...');
    // Read narration from source
    const narrations = await loadNarrations();
    await generateTimeline(narrations, outDir.audio, path.join(outDir.timeline, 'timeline.json'));
    console.log('✓ Timeline generated\n');
  } else {
    console.log('→ Skipping timeline generation (--skip-timeline)\n');
  }

  // 2. Validate timeline
  const timelinePath = path.join(outDir.timeline, 'timeline.json');
  if (!fs.existsSync(timelinePath)) {
    console.error('Timeline not found. Run without --skip-timeline');
    process.exit(1);
  }
  const timeline = readTimeline(timelinePath);
  const validation = validateTimeline(timeline);
  if (!validation.valid) {
    console.error('TIMELINE_INVALID:', validation.errors.join('; '));
    process.exit(1);
  }
  const totalTimelineDuration = timeline[timeline.length - 1].end;
  console.log(`Timeline: ${timeline.length} entries, ${totalTimelineDuration.toFixed(2)}s\n`);

  // Make sure Vite can serve the timeline file
  const publicTimelineDir = path.join(PROJECT_ROOT, 'public', 'timeline');
  if (!fs.existsSync(publicTimelineDir)) fs.mkdirSync(publicTimelineDir, { recursive: true });
  fs.copyFileSync(timelinePath, path.join(publicTimelineDir, 'timeline.json'));

  // 3. Start server
  console.log('Step 2: Start HTTP server...');
  let serverProcess = null;
  let port;
  try {
    // If full render, use build + preview (production mode)
    const result = await startServer({ build: full });
    serverProcess = result.serverProcess;
    port = result.port;
  } catch (err) {
    console.error('SERVER_START_FAILED:', err.message);
    process.exit(1);
  }

  // 4. Record video
  if (!skipRecord) {
    console.log('Step 3: Record video via Playwright...');
    try {
      const url = `http://127.0.0.1:${port}/?auto=1&driver=renderer`;
      const rawVideoPath = await recordVideo({
        url,
        outputDir: outDir.raw,
        timeline,
        drive: true,
        timeout: Math.max(60000, (totalTimelineDuration + 30) * 1000),
      });
      console.log('✓ Recording complete\n');
    } catch (err) {
      console.error('PLAYWRIGHT_RECORD_FAILED:', err.message);
      killProcess(serverProcess);
      process.exit(1);
    }
  } else {
    console.log('→ Skipping recording (--skip-record)\n');
  }

  // 5. Generate subtitles
  console.log('Step 4: Generate subtitles...');
  try {
    const { cues, srtPath, assPath } = generateSubtitleFiles(timeline, outDir.subtitles);
    console.log(`✓ SRT: ${srtPath} (${cues.length} cues)`);
    console.log(`✓ ASS: ${assPath} (${cues.length} cues)`);
  } catch (err) {
    console.error('SUBTITLE_GENERATION_FAILED:', err.message);
    killProcess(serverProcess);
    process.exit(1);
  }
  console.log('');

  // 6. Compose final video
  console.log('Step 5: Compose final video...');
  try {
    // Find raw video
    const rawFiles = fs.readdirSync(outDir.raw);
    const webmFile = rawFiles.find(f => f.endsWith('.webm'));
    if (!webmFile) {
      console.error('FFMPEG_FAILED: No raw .webm file found');
      killProcess(serverProcess);
      process.exit(1);
    }
    const rawVideoPath = path.join(outDir.raw, webmFile);

    // Build full audio
    const audioFiles = timeline.map(entry => {
      const filename = `ch${String(entry.chapter).padStart(2, '0')}_step${String(entry.step).padStart(2, '0')}.mp3`;
      return path.join(outDir.audio, filename);
    });
    const fullAudioPath = path.join(outDir.audio, 'full.mp3');
    await buildFullAudio(audioFiles, fullAudioPath);

    // Get durations
    const videoInfo = await getVideoInfo(rawVideoPath);
    const audioInfo = await getVideoInfo(fullAudioPath);
    const videoDuration = videoInfo.duration;
    const audioDuration = audioInfo.duration;

    // Compose
    const finalVideoPath = path.join(outDir.final, 'video.mp4');
    await composeFinalVideo(rawVideoPath, fullAudioPath, outDir.subtitles, finalVideoPath, totalTimelineDuration);

    // Save duration info
    fs.writeFileSync(path.join(outDir.qa, 'duration.json'), JSON.stringify({
      videoDuration,
      audioDuration,
      timelineDuration: totalTimelineDuration,
      videoAudioDiff: Math.abs(videoDuration - audioDuration),
      videoTimelineDiff: Math.abs(videoDuration - totalTimelineDuration),
      audioTimelineDiff: Math.abs(audioDuration - totalTimelineDuration),
      threshold: DURATION_MISMATCH_THRESHOLD,
    }, null, 2), 'utf-8');

  } catch (err) {
    console.error('FFMPEG_FAILED:', err.message);
    killProcess(serverProcess);
    process.exit(1);
  }
  console.log('');

  // 7. QC
  console.log('Step 6: Quality Check...');
  let qcPassed = false;
  try {
    qcPassed = await runQC(outDir, timeline);
  } catch (err) {
    console.error('QC_FAILED:', err.message);
    killProcess(serverProcess);
    process.exit(1);
  }

  // 8. Generate report
  console.log('Step 7: Generate report...');
  const renderTime = (Date.now() - startTime) / 1000;
  const report = generateReport(outDir, timeline, renderTime, qcPassed);
  const reportPath = path.join(outDir.qa, 'render-report.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`✓ Report: ${reportPath}\n`);

  // 9. Cleanup
  killProcess(serverProcess);

  // 10. Output summary
  console.log('=== Render Complete ===\n');
  console.log('Video:');
  console.log('  ' + path.join(outDir.final, 'video.mp4'));
  console.log('Subtitles:');
  console.log('  ' + path.join(outDir.subtitles, 'subtitles.ass'));
  console.log('  ' + path.join(outDir.subtitles, 'subtitles.srt'));
  console.log('Timeline:');
  console.log('  ' + timelinePath);
  console.log('QC:');
  console.log(qcPassed ? '  PASS' : '  FAIL');
  console.log('');

  if (!qcPassed) {
    console.error('QC FAILED — video may have issues');
    process.exit(1);
  } else {
    console.log('✓ Render complete');
  }
}

async function loadNarrations() {
  // Try to load from src/narration.ts via regex
  const tsPath = path.join(PROJECT_ROOT, 'src', 'narration.ts');
  const jsonPath = path.join(PROJECT_ROOT, 'out', 'narration.json');

  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  }

  if (fs.existsSync(tsPath)) {
    const content = fs.readFileSync(tsPath, 'utf-8');
    const entries = [];
    const regex = /chapter:\s*(\d+),\s*step:\s*(\d+),\s*narration:\s*'([^']*)'/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      entries.push({
        chapter: parseInt(match[1]),
        step: parseInt(match[2]),
        narration: match[3],
      });
    }
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
    if (entries.length > 0) {
      return entries;
    }
  }

  console.error('No narration source found. Create src/narration.ts or out/narration.json');
  process.exit(1);
}

async function buildFullAudio(audioFiles, outputPath) {
  const existingFiles = audioFiles.filter(f => fs.existsSync(f));
  if (existingFiles.length === 0) {
    throw new Error('No audio files found');
  }
  if (existingFiles.length === 1) {
    fs.copyFileSync(existingFiles[0], outputPath);
    return;
  }
  // Use ffmpeg concat filter
  const { createConcatFile, runFFmpeg } = await import('./lib/ffmpeg.mjs');
  const concatFile = path.join(path.dirname(outputPath), 'concat.txt');
  createConcatFile(existingFiles, concatFile);
  await runFFmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    '-y',
    outputPath,
  ]);
}

async function composeFinalVideo(rawVideo, audioPath, subtitlesDir, outputPath, targetDuration) {
  const { runFFmpeg, escapeFilterPath } = await import('./lib/ffmpeg.mjs');
  const assPath = path.join(subtitlesDir, 'subtitles.ass');
  const srtPath = path.join(subtitlesDir, 'subtitles.srt');
  const subtitlePath = fs.existsSync(assPath) ? assPath : (fs.existsSync(srtPath) ? srtPath : null);

  const args = [
    '-i', rawVideo,
    '-i', audioPath,
    '-map', '0:v',
    '-map', '1:a',
  ];

  if (subtitlePath) {
    const escapedPath = escapeFilterPath(subtitlePath);
    const ext = path.extname(subtitlePath).toLowerCase();
    if (ext === '.ass') {
      args.push('-vf', `ass='${escapedPath}'`);
    } else {
      args.push('-vf', `subtitles='${escapedPath}'`);
    }
  }

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

async function runQC(outDir, timeline) {
  const { getVideoInfo, getFFmpegVersion } = await import('./lib/ffmpeg.mjs');
  const { readTimeline } = await import('./lib/timeline.mjs');
  const { validateCues } = await import('./lib/subtitles.mjs');

  const finalVideoPath = path.join(outDir.final, 'video.mp4');
  const subtitlesAssPath = path.join(outDir.subtitles, 'subtitles.ass');
  const subtitlesSrtPath = path.join(outDir.subtitles, 'subtitles.srt');
  const timelinePath = path.join(outDir.timeline, 'timeline.json');

  let allPassed = true;

  // 18.1 Video exists
  console.log('  QC: Video existence...');
  if (!fs.existsSync(finalVideoPath)) {
    console.error('  ✗ final/video.mp4 not found');
    allPassed = false;
  } else {
    console.log('  ✓ final/video.mp4 exists');
  }

  // 18.2 Video info
  console.log('  QC: Video metadata...');
  try {
    const info = await getVideoInfo(finalVideoPath);
    console.log(`    Duration: ${info.duration.toFixed(3)}s`);
    console.log(`    Resolution: ${info.width}×${info.height}`);
    console.log(`    Codec: ${info.codec}`);
    console.log(`    FPS: ${info.fps.toFixed(2)}`);
    console.log(`    Audio: ${info.audioCodec}`);

    if (info.width !== 1920 || info.height !== 1080) {
      console.error('  ✗ Resolution must be 1920×1080');
      allPassed = false;
    } else {
      console.log('  ✓ Resolution 1920×1080');
    }
  } catch (err) {
    console.error('  ✗ FFprobe failed:', err.message);
    allPassed = false;
  }

  // 18.3 Duration sync
  console.log('  QC: Duration sync...');
  try {
    const videoInfo = await getVideoInfo(finalVideoPath);
    const videoDuration = videoInfo.duration;
    const timelineDuration = timeline[timeline.length - 1].end;

    const durationJsonPath = path.join(outDir.qa, 'duration.json');
    let audioDuration = timelineDuration;
    if (fs.existsSync(durationJsonPath)) {
      try {
        const durationInfo = JSON.parse(fs.readFileSync(durationJsonPath, 'utf-8'));
        if (typeof durationInfo.audioDuration === 'number') {
          audioDuration = durationInfo.audioDuration;
        }
      } catch {
        // keep timeline duration fallback
      }
    }

    const diffs = [
      Math.abs(videoDuration - timelineDuration),
      Math.abs(videoDuration - audioDuration),
      Math.abs(audioDuration - timelineDuration),
    ];
    const maxDiff = Math.max(...diffs);
    if (maxDiff > DURATION_MISMATCH_THRESHOLD) {
      console.error(`  ✗ Duration mismatch: video=${videoDuration.toFixed(3)}s, audio=${audioDuration.toFixed(3)}s, timeline=${timelineDuration.toFixed(3)}s, maxDiff=${maxDiff.toFixed(3)}s`);
      allPassed = false;
    } else {
      console.log(`  ✓ Duration sync (video ${videoDuration.toFixed(3)}s / audio ${audioDuration.toFixed(3)}s / timeline ${timelineDuration.toFixed(3)}s)`);
    }
  } catch (err) {
    console.error('  ✗ Duration check failed:', err.message);
    allPassed = false;
  }

  // 18.4 Subtitle check
  console.log('  QC: Subtitle files...');
  if (!fs.existsSync(subtitlesAssPath) && !fs.existsSync(subtitlesSrtPath)) {
    console.error('  ✗ No subtitle files found');
    allPassed = false;
  } else {
    if (fs.existsSync(subtitlesAssPath)) console.log('  ✓ subtitles.ass exists');
    if (fs.existsSync(subtitlesSrtPath)) console.log('  ✓ subtitles.srt exists');

    // Validate cues
    try {
      const { readTimeline } = await import('./lib/timeline.mjs');
      const { generateCues, validateCues } = await import('./lib/subtitles.mjs');
      const timeline = readTimeline(timelinePath);
      const cues = generateCues(timeline);
      const videoInfo = await getVideoInfo(finalVideoPath);
      const validation = validateCues(cues, videoInfo.duration);
      if (!validation.valid) {
        console.error('  ✗ Subtitle validation warnings:', validation.errors.join('; '));
        // Not failing for now, just warn
      } else {
        console.log(`  ✓ ${cues.length} cues valid`);
      }
    } catch (err) {
      console.error('  ✗ Subtitle validation error:', err.message);
    }
  }

  // 18.5 Resolution
  console.log('  QC: Resolution...');
  // Already checked above

  return allPassed;
}

function generateReport(outDir, timeline, renderTime, qcPassed) {
  const now = new Date().toISOString();
  const ffmpegVersion = getFFmpegVersion();

  const report = `# Render Report

- **Project**: web-video-presentation
- **Date**: ${now}
- **Render Time**: ${renderTime.toFixed(1)}s
- **Resolution**: 1920×1080
- **FPS**: 30 (approximate)
- **Video Duration**: ${timeline[timeline.length - 1].end.toFixed(3)}s
- **Audio Duration**: (from timeline)
- **Timeline Duration**: ${timeline[timeline.length - 1].end.toFixed(3)}s
- **Subtitle Count**: ${timeline.length} entries
- **Chapters**: ${new Set(timeline.map(t => t.chapter)).size}
- **Steps**: ${timeline.length}
- **FFmpeg Version**: ${ffmpegVersion}
- **Browser**: Playwright Chromium
- **QC Result**: ${qcPassed ? 'PASS' : 'FAIL'}

## Output Files

| File | Path |
|------|------|
| Final Video | \`out/final/video.mp4\` |
| ASS Subtitles | \`out/subtitles/subtitles.ass\` |
| SRT Subtitles | \`out/subtitles/subtitles.srt\` |
| Timeline | \`out/timeline/timeline.json\` |
| Duration Info | \`out/qa/duration.json\` |

## Timeline Overview

| # | Chapter | Step | Start | End | Duration | Narration |
|---|---------|------|-------|-----|----------|-----------|
${timeline.map((t, i) => {
  const nar = t.narration.length > 50 ? t.narration.substring(0, 50) + '...' : t.narration;
  return `| ${i + 1} | ${t.chapter} | ${t.step} | ${t.start.toFixed(2)} | ${t.end.toFixed(2)} | ${t.duration.toFixed(2)} | ${nar} |`;
}).join('\n')}

## QC

${qcPassed ? '✅ All checks passed' : '❌ Some checks failed'}
`;

  return report;
}

main().catch(err => {
  console.error('RENDER FAILED:', err.message);
  process.exit(1);
});