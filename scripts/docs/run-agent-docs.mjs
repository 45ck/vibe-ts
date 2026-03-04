#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { repoRoot } from '../agent/utils.mjs';

const root = repoRoot();
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/docs/run-agent-docs.mjs <subcommand> [args...]');
  process.exit(1);
}

const localBinaries = [
  path.join(root, 'node_modules', '.bin', 'agent-docs'),
  path.join(root, 'node_modules', '.bin', 'agent-docs.cmd'),
];
const localBinary = localBinaries.find((binary) => fs.existsSync(binary));

const localResult = localBinary
  ? spawnSync(localBinary, args, { stdio: 'inherit', shell: true })
  : null;

if (localResult && localResult.status === 0) {
  process.exit(0);
}

if (localResult) {
  process.exit(localResult.status ?? 1);
}

const npxResult = spawnSync('npx', ['--yes', '--quiet', 'agent-docs', ...args], {
  stdio: 'inherit',
  shell: false,
});

if (npxResult.status === 0) {
  process.exit(0);
}

process.exit(npxResult.status ?? 1);
