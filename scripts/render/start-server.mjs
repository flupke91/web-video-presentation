#!/usr/bin/env node
/**
 * Start HTTP server for the web video presentation.
 * Uses Vite dev server or preview server.
 *
 * Returns: { serverProcess, port }
 * On fail: exit with SERVER_START_FAILED
 */

import { spawn, execFileSync } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Get a free port starting from the given port
 */
function getPort(start = 4173) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(start, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(getPort(start + 1));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Wait for server to be ready
 */
function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > timeout) {
        return reject(new Error('Server health check timeout'));
      }
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        setTimeout(check, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, 500);
      });
    };
    check();
  });
}

/**
 * Start the server
 * @param {object} [options]
 * @param {number} [options.port] - preferred port (default 5173 for dev, 4174 for preview)
 * @param {boolean} [options.build=false] - if true, build then preview
 * @param {number} [options.timeout=30000]
 * @returns {Promise<{ serverProcess: import('child_process').ChildProcess, port: number }>}
 */
export async function startServer(options = {}) {
  const build = options.build === true;
  const timeout = options.timeout || 30000;
  const preferredPort = options.port || (build ? 4173 : 5173);

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  if (build) {
    console.log('  Building production bundle...');
    execFileSync(npmCmd, ['run', 'build'], { cwd: PROJECT_ROOT, stdio: 'inherit', timeout: 120000 });
  }

  const port = await getPort(preferredPort);
  const args = build
    ? ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort']
    : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];

  console.log(`→ Starting server${build ? ' (build+preview)' : ' (dev)'} on port ${port}`);

  const serverProcess = spawn(npmCmd, args, {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`  [server] ${msg}`);
    }
  });
  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`  [server] ${msg}`);
    }
  });

  serverProcess.on('error', (err) => {
    console.error('Server spawn error:', err.message);
  });

  try {
    await waitForServer(port, timeout);
    console.log(`✓ Server ready at http://127.0.0.1:${port}`);
    return { serverProcess, port };
  } catch {
    if (!serverProcess.killed) {
      killProcess(serverProcess);
    }
    throw new Error('SERVER_START_FAILED: Could not start server on selected port');
  }
}

/**
 * Kill a process and its children
 */
export function killProcess(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      // Use taskkill on Windows
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t']);
    } else {
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 2000);
    }
  } catch (err) {
    console.error('Failed to kill server:', err.message);
  }
}

// If called directly, start server and output port
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().then(({ port }) => {
    console.log(`PORT=${port}`);
  }).catch(err => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}