#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const protectedFile = process.argv[2] ?? 'a protected config file';
const tokenPath = getTokenPath();
const token = readToken(tokenPath);

if (!token) {
  deny(`Protected config edit blocked for ${protectedFile}.`);
}

const expiresAt = Date.parse(token.expiresAt);
if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
  safeUnlink(tokenPath);
  deny(`Protected config edit token expired for ${protectedFile}.`);
}

console.log(
  `guardrails: allowing protected config edit for ${protectedFile} until ${new Date(expiresAt).toISOString()} (${token.reason})`,
);

function getTokenPath() {
  const gitDir = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
  });

  if (gitDir.status !== 0) {
    deny('Unable to resolve .git directory for protected config edit check.');
  }

  return path.resolve(gitDir.stdout.trim(), 'vibe-ts', 'protected-config-edit.json');
}

function readToken(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Ignore missing token cleanup failures.
  }
}

function deny(message) {
  console.error(`guardrails: ${message}`);
  console.error(
    'guardrails: run `npm run guardrails:unlock -- "<reason>"` for a short-lived maintainer override.',
  );
  process.exit(1);
}
