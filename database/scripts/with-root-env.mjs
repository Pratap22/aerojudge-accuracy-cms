/**
 * Run a Node entry with monorepo-root `.env` when present.
 * Docker/CI builds have no `.env`; local dev still gets DATABASE_URL etc.
 *
 * Usage: node ./scripts/with-root-env.mjs [node-args…] <script> [script-args…]
 * Example: node ./scripts/with-root-env.mjs ../node_modules/prisma/build/index.js generate
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = resolve(databaseRoot, '..');
const envPath = resolve(monorepoRoot, '.env');
const forwarded = process.argv.slice(2);

if (forwarded.length === 0) {
  console.error('with-root-env: missing command');
  process.exit(1);
}

const nodeArgs = existsSync(envPath) ? [`--env-file=${envPath}`, ...forwarded] : forwarded;

const child = spawn(process.execPath, nodeArgs, {
  cwd: databaseRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
