/**
 * Playwright browser automation for video recording
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Wait for page ready signal
 * @param {import('playwright').Page} page
 * @param {number} [timeout=30000]
 */
export async function waitForReady(page, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const ready = await page.evaluate(() => window.__WEB_VIDEO_READY__ === true);
      if (ready) return true;
    } catch {
      // Page may not be loaded yet
    }
    await page.waitForTimeout(500);
  }
  throw new Error('PAGE_READY_TIMEOUT');
}

/**
 * Wait for page done signal
 * @param {import('playwright').Page} page
 * @param {number} [timeout=600000]
 */
export async function waitForDone(page, timeout = 600000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const done = await page.evaluate(() => window.__WEB_VIDEO_DONE__ === true);
      if (done) return true;
    } catch {
      // Page may be transitioning
    }
    await page.waitForTimeout(500);
  }
  throw new Error('RENDER_TIMEOUT');
}

/**
 * Set done signal on page
 * @param {import('playwright').Page} page
 */
export async function setDone(page) {
  await page.evaluate(() => {
    window.__WEB_VIDEO_DONE__ = true;
    if (window.__WEB_VIDEO_RENDER__) {
      window.__WEB_VIDEO_RENDER__.done = true;
    }
  });
}

/**
 * Navigate to step via bridge
 * @param {import('playwright').Page} page
 * @param {number} chapter
 * @param {number} step
 */
export async function gotoStep(page, chapter, step) {
  await page.evaluate(({ chapter, step }) => {
    if (window.__WEB_VIDEO_RENDER__ && typeof window.__WEB_VIDEO_RENDER__.goto === 'function') {
      window.__WEB_VIDEO_RENDER__.goto(chapter, step);
    }

    /**
     * Wait until render bridge reports the expected chapter/step
     * @param {import('playwright').Page} page
     * @param {number} chapter
     * @param {number} step
     * @param {number} [timeout=3000]
     * @returns {Promise<boolean>}
     */
    async function waitForStepReached(page, chapter, step, timeout = 3000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          const reached = await page.evaluate(({ chapter, step }) => {
            const bridge = window.__WEB_VIDEO_RENDER__;
            return Boolean(bridge && bridge.chapter === chapter && bridge.step === step);
          }, { chapter, step });
          if (reached) return true;
        } catch {
          // Page may be transitioning
        }
        await page.waitForTimeout(100);
      }
      return false;
    }
  }, { chapter, step });
}

/**
 * Record video with Playwright
 *
 * @param {object} options
 * @param {string} options.url - URL to open
 * @param {string} options.outputDir - absolute path to out/raw
 * @param {Array} options.timeline - timeline entries for driving
 * @param {boolean} [options.drive=true] - whether to drive via page.evaluate
 * @param {number} [options.timeout=300000] - timeout for each step
 * @returns {Promise<string>} path to recorded webm
 */
export async function recordVideo(options) {
  const { url, outputDir, timeline, drive = true, timeout = 600000 } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Remove previous recordings to avoid stale files
  for (const f of fs.readdirSync(outputDir)) {
    if (f.endsWith('.webm')) {
      fs.rmSync(path.join(outputDir, f), { force: true });
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outputDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // Suppress console noise
  page.on('console', () => {});
  page.on('pageerror', err => console.error('Page error:', err.message));

  try {
    console.log(`→ Opening page: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    // Wait for fonts, images, etc.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // Wait for ready signal
    await waitForReady(page, 30000);
    console.log('✓ Page ready');

    if (drive && timeline && timeline.length > 0) {
      // External driver: drive the page according to timeline
      console.log('→ Driving external mode...');
      const startTime = Date.now();
      let completedEntries = 0;

      for (const entry of timeline) {
        const { chapter, step, start } = entry;
        if (Date.now() - startTime > timeout) {
          throw new Error(`RENDER_TIMEOUT: timed out before chapter ${chapter} step ${step}`);
        }
        // Wait until the start time (relative to page load)
        const elapsed = (Date.now() - startTime) / 1000;
        const waitSec = Math.max(0, start - elapsed);
        if (waitSec > 0.01) {
          await page.waitForTimeout(waitSec * 1000);
        }
        console.log(`  → Chapter ${chapter}, Step ${step} (${start.toFixed(2)}s)`);
        await gotoStep(page, chapter, step);
        const reached = await waitForStepReached(page, chapter, step, 3000);
        if (!reached) {
          throw new Error(`RENDER_DRIVER_STALLED: goto not reached for chapter ${chapter} step ${step}`);
        }
        completedEntries += 1;
      }

      if (completedEntries !== timeline.length) {
        throw new Error(`RENDER_DRIVER_STALLED: completed ${completedEntries}/${timeline.length} timeline entries`);
      }

      // Wait for last step to finish visually
      const lastEntry = timeline[timeline.length - 1];
      const elapsed = (Date.now() - startTime) / 1000;
      const waitSec = Math.max(0, lastEntry.end - elapsed);
      if (waitSec > 0.01) {
        await page.waitForTimeout(waitSec * 1000);
      }
      if (Date.now() - startTime > timeout) {
        throw new Error('RENDER_TIMEOUT: timed out waiting for final timeline entry to finish');
      }

      const lastReached = await waitForStepReached(page, lastEntry.chapter, lastEntry.step, 3000);
      if (!lastReached) {
        throw new Error(`RENDER_DRIVER_STALLED: last timeline entry not reached (${lastEntry.chapter}-${lastEntry.step})`);
      }

      // Set done
      await setDone(page);
      await waitForDone(page, 5000);
      console.log('RENDER_COMPLETE');
    } else {
      // Self-driven: wait for page to finish
      console.log('→ Waiting for auto playback to complete...');
      await waitForDone(page, timeout);
      console.log('RENDER_COMPLETE');
    }

    // Close context to flush video
    await context.close();

    // Find the recorded video file
    const files = fs.readdirSync(outputDir);
    const videoFile = files.find(f => f.endsWith('.webm'));
    if (!videoFile) {
      throw new Error('PLAYWRIGHT_RECORD_FAILED: No video file found');
    }
    // Normalize filename to recording.webm
    const rawVideoPath = path.join(outputDir, videoFile);
    const recordingPath = path.join(outputDir, 'recording.webm');
    if (rawVideoPath !== recordingPath) {
      fs.rmSync(recordingPath, { force: true });
      fs.renameSync(rawVideoPath, recordingPath);
    }
    console.log(`✓ Recording saved: ${recordingPath}`);
    return recordingPath;
  } catch (error) {
    await context.close();
    throw error;
  } finally {
    await browser.close();
  }
}