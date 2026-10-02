#!/usr/bin/env node
/**
 * Environment check for Phase 4 rendering
 *
 * Check:
 * - Node.js
 * - npm
 * - ffmpeg
 * - ffprobe
 * - Playwright
 * - Chromium
 * - Fonts (required CJK)
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHECKS = [];

function check(name, fn) {
  CHECKS.push({ name, fn });
}

function tryExec(cmd, args, timeout = 10000) {
  try {
    execFileSync(cmd, args, { encoding: 'utf-8', timeout });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function resolveExe(program) {
  if (process.platform === 'win32') return `${program}.exe`;
  return program;
}

check('Node.js', () => {
  const v = process.version;
  const major = parseInt(v.split('.')[0].replace('v', ''));
  if (major < 16) {
    return { ok: false, message: `Node.js >= 16 required, current: ${v}` };
  }
  return { ok: true, message: v };
});

check('npm', () => {
  const result = tryExec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version']);
  if (result.ok) {
    return { ok: true, message: execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim() };
  }
  return { ok: false, message: 'npm not found in PATH' };
});

check('ffmpeg', () => {
  const result = tryExec(resolveExe('ffmpeg'), ['-version']);
  if (result.ok) {
    const v = execFileSync(resolveExe('ffmpeg'), ['-version'], { encoding: 'utf-8', timeout: 5000 }).split('\n')[0];
    return { ok: true, message: v };
  }
  return { ok: false, message: 'ffmpeg not found. Install FFmpeg and add to PATH.' };
});

check('ffprobe', () => {
  const result = tryExec(resolveExe('ffprobe'), ['-version']);
  if (result.ok) {
    const v = execFileSync(resolveExe('ffprobe'), ['-version'], { encoding: 'utf-8', timeout: 5000 }).split('\n')[0];
    return { ok: true, message: v };
  }
  return { ok: false, message: 'ffprobe not found. Install FFmpeg and add to PATH.' };
});

check('Playwright', async () => {
  try {
    const { chromium } = await import('playwright');
    const executablePath = chromium.executablePath();
    if (!executablePath) {
      return { ok: false, message: 'Playwright browsers not installed. Run: npx playwright install chromium' };
    }

    let browser = null;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent('<html><body>ok</body></html>');
      await page.close();
      return { ok: true, message: `${executablePath} (launch ok)` };
    } catch (err) {
      return { ok: false, message: `Playwright launch failed: ${err.message}` };
    } finally {
      if (browser) await browser.close();
    }
  } catch {
    return { ok: false, message: 'Playwright package not installed. Run: npm install playwright' };
  }
});

check('Fonts (CJK)', () => {
  try {
    if (process.platform === 'win32') {
      const fontDirs = [];
      if (process.env.WINDIR) fontDirs.push(path.join(process.env.WINDIR, 'Fonts'));
      if (process.env.SystemRoot) fontDirs.push(path.join(process.env.SystemRoot, 'Fonts'));
      const candidateFonts = ['msyh.ttc', 'msyhbd.ttc', 'simhei.ttf', 'simsun.ttc', 'Deng.ttf'];
      for (const dir of fontDirs) {
        for (const font of candidateFonts) {
          if (dir && fs.existsSync(path.join(dir, font))) {
            return { ok: true, message: `${font} found` };
          }
        }
      }
      return { ok: false, message: 'No CJK font found in Windows Fonts (try installing Microsoft YaHei or SimHei)' };
    }

    // Linux / macOS: try fc-list
    try {
      const stdout = execFileSync('fc-list', [':lang=zh'], { encoding: 'utf-8', timeout: 5000 });
      if (stdout.trim().length > 0) {
        return { ok: true, message: `CJK fonts found (${stdout.split('\n').length} entries)` };
      }
      return { ok: false, message: 'No CJK fonts found via fc-list' };
    } catch {
      return { ok: false, message: 'Cannot verify CJK fonts; install a Chinese font' };
    }
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

async function runChecks() {
  console.log('\n=== Phase 4 Rendering Environment Check ===\n');
  let allOk = true;

  for (const c of CHECKS) {
    process.stdout.write(`  ${c.name} ... `);
    try {
      const result = await c.fn();
      if (result.ok) {
        console.log('✓', result.message);
      } else {
        console.log('✗');
        console.log(`    ${result.message}`);
        allOk = false;
      }
    } catch (err) {
      console.log('✗');
      console.log(`    ${err.message}`);
      allOk = false;
    }
  }

  console.log(allOk ? '\n✓ All checks passed' : '\n✗ Some checks failed');
  process.exit(allOk ? 0 : 1);
}

runChecks();