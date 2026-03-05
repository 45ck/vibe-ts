#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const [workspace, mode, outputTo] = process.argv.slice(2);

if (!workspace || !mode) {
  console.error(
    'Usage: node scripts/quality/run-workspace-depcruise.mjs <workspace> <validate|graph> [outputTo]',
  );
  process.exit(1);
}

const configPath = `${workspace}/.dependency-cruiser.cjs`;
const sourcePath = `${workspace}/src`;
const args =
  mode === 'validate'
    ? [
        'dependency-cruiser',
        '--config',
        configPath,
        '--validate',
        '--output-type',
        'err',
        sourcePath,
      ]
    : mode === 'graph'
      ? [
          'dependency-cruiser',
          '--config',
          configPath,
          '--output-type',
          'mermaid',
          sourcePath,
          '--output-to',
          outputTo ?? `reports/${path.basename(workspace)}-dependency-graph.mmd`,
        ]
      : null;

if (!args) {
  console.error(`Unknown mode '${mode}'. Expected 'validate' or 'graph'.`);
  process.exit(1);
}

const result = spawnSync('npx', ['--no-install', ...args], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
