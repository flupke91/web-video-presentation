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

import { execFileSync, execSync } from 'child_process';
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
  const exe = process.platform === 'win32' ? `${program}.exe` : program;
  if (process.platform === 'win32') {
    try {
      execFileSync(exe, ['-version'], { stdio: 'ignore' });
      return exe;
    } catch {
      const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\fengzheng\\AppData\\Local';
      const wingetDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      if (fs.existsSync(wingetDir)) {
        for (const entry of fs.readdirSync(wingetDir)) {
          if (entry.toLowerCase().includes('ffmpeg')) {
            const candidate1 = path.join(wingetDir, entry, 'ffmpeg-9.0.2-full_build', 'bin', exe);
            if (fs.existsSync(candidate1)) return candidate1;
            const candidate2 = path.join(wingetDir, entry, 'bin', exe);
            if (fs.existsSync(candidate2)) return candidate2;
          }
        }
      }
    }
  }
  return exe;
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
  try {
    const v = execSync(process.platform === 'win32' ? 'npm.cmd -v' : 'npm -v', { encoding: 'utf-8', timeout: 5000 }).trim();
    return { ok: true, message: `v${v}` };
  } catch {
    return { ok: false, message: 'npm not found in PATH' };
  }
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

check('Playwright / Chrome', async () => {
  try {
    const { chromium } = await import('playwright');
    let browser = null;
    let browserDesc = '';

    for (const channel of ['chrome', 'msedge']) {
      try {
        browser = await chromium.launch({
          channel,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        browserDesc = `Local ${channel.toUpperCase()} (${browser.version()})`;
        break;
      } catch {
        // try next channel
      }
    }

    if (!browser) {
      try {
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        browserDesc = `Chromium (${browser.version()})`;
      } catch (err) {
        return { ok: false, message: `No browser found: ${err.message}` };
      }
    }

    const page = await browser.newPage();
    await page.setContent('<html><body>ok</body></html>');
    await page.close();
    await browser.close();
    return { ok: true, message: `${browserDesc} (launch ok)` };
  } catch (err) {
    return { ok: false, message: `Playwright package check failed: ${err.message}` };
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