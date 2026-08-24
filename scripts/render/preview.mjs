#!/usr/bin/env node
/**
 * Preview mode: start server and open browser with ?auto=1 for manual inspection.
 *
 * Usage: node scripts/render/preview.mjs
 */

import { startServer, killProcess } from './start-server.mjs';
import { execFile } from 'child_process';

async function main() {
  let serverProcess = null;
  try {
    const { serverProcess: proc, port } = await startServer({ build: false });
    serverProcess = proc;

    const url = `http://127.0.0.1:${port}/?auto=1`;
    console.log(`\n✓ Auto mode preview: ${url}\n`);
    console.log('Press Ctrl+C to stop server.\n');

    // Try to open browser
    try {
      if (process.platform === 'win32') {
        execFile('cmd', ['/c', 'start', url], { detached: true });
      } else if (process.platform === 'darwin') {
        execFile('open', [url], { detached: true });
      } else {
        execFile('xdg-open', [url], { detached: true });
      }
    } catch {
      console.log(`Open manually: ${url}`);
    }

    // Wait for Ctrl+C
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      killProcess(serverProcess);
      process.exit(0);
    });

    // Keep alive
    process.stdin.resume();
  } catch (err) {
    console.error('Preview failed:', err.message);
    if (serverProcess) killProcess(serverProcess);
    process.exit(1);
  }
}

main();