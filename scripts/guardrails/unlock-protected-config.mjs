#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const reason = process.argv.slice(2).join(' ').trim();
if (!reason) {
  console.error('Usage: npm run guardrails:unlock -- "<reason>"');
  process.exit(1);
}

const gitDir = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
  encoding: 'utf8',
});

if (gitDir.status !== 0) {
  console.error('guardrails: unable to resolve .git directory.');
  process.exit(1);
}

const tokenPath = path.resolve(gitDir.stdout.trim(), 'vibe-ts', 'protected-config-edit.json');
fs.mkdirSync(path.dirname(tokenPath), { recursive: true });

const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const payload = {
  reason,
  createdAt: new Date().toISOString(),
  expiresAt,
};

fs.writeFileSync(tokenPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`guardrails: protected config edits unlocked until ${expiresAt}`);
console.log(`guardrails: reason: ${reason}`);
