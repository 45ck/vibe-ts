#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync('.git')) {
  process.exit(0);
}

const husky = spawnSync('husky', {
  stdio: 'ignore',
  shell: true,
  encoding: 'utf8',
});

if (husky.status !== 0) {
  process.exit(0);
}

spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore', encoding: 'utf8' });
spawnSync('git', ['config', '--get', 'core.hooksPath'], { stdio: 'ignore', encoding: 'utf8' });
spawnSync('git', ['config', 'core.hooksPath', '.beads/hooks'], {
  stdio: 'ignore',
  encoding: 'utf8',
});
