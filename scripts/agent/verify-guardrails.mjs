#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const failures = [];

function readText(relativePath) {
  try {
    return fs.readFileSync(relativePath, 'utf8');
  } catch {
    failures.push(`Missing required file: ${relativePath}`);
    return '';
  }
}

const settingsText = readText('.claude/settings.json');
if (settingsText) {
  try {
    const settings = JSON.parse(settingsText);
    const deny = new Set(settings?.permissions?.deny ?? []);
    const allow = new Set(settings?.permissions?.allow ?? []);
    const requiredDeny = [
      'Bash(*--no-verify*)',
      'Bash(git commit -n*)',
      'Bash(git push --force*)',
      'Bash(git push -f*)',
      'Bash(git reset --hard*)',
      'Bash(*HUSKY=0*)',
      'Bash(*HUSKY_SKIP_HOOKS=*)',
      'Bash(*SKIP_CI=*)',
      'Bash(*core.hooksPath*)',
    ];
    for (const rule of requiredDeny) {
      if (!deny.has(rule)) {
        failures.push(`Missing deny rule in .claude/settings.json: ${rule}`);
      }
    }

    const requiredAllow = [
      'Bash(bun install *)',
      'Bash(bun run *)',
      'Bash(bun x *)',
      'Bash(bun *)',
    ];
    for (const rule of requiredAllow) {
      if (deny.has(rule)) {
        failures.push(`Invalid bun rule in deny list in .claude/settings.json: ${rule}`);
      }
      if (!allow.has(rule)) {
        failures.push(`Missing bun allow rule in .claude/settings.json: ${rule}`);
      }
    }

    const protectedDeny = [
      'Edit(.beads/hooks/**)',
      'Edit(.github/workflows/**)',
      'Edit(.claude/settings.json)',
      'Edit(.claude/hooks/**)',
      'Edit(.agent-docs/**)',
      'Edit(tsconfig.base.json)',
      'Write(.beads/hooks/**)',
      'Write(.github/workflows/**)',
      'Write(.claude/settings.json)',
      'Write(.claude/hooks/**)',
      'Write(.agent-docs/**)',
      'Write(tsconfig.base.json)',
    ];
    for (const rule of protectedDeny) {
      if (!deny.has(rule)) {
        failures.push(`Missing deny rule in .claude/settings.json: ${rule}`);
      }
    }
  } catch {
    failures.push('Invalid JSON in .claude/settings.json');
  }
}

const preTool = readText('.claude/hooks/pre-tool-use.sh');
if (preTool) {
  const requiredSnippets = [
    '--no-verify',
    'SKIP_CI',
    'HUSKY=0',
    'HUSKY_SKIP_HOOKS',
    'core.hooksPath',
    'eslint',
    'git push --force',
    'git push -f',
    'git reset --hard',
  ];
  for (const snippet of requiredSnippets) {
    if (!preTool.includes(snippet)) {
      failures.push(`Missing pattern in .claude/hooks/pre-tool-use.sh: ${snippet}`);
    }
  }
}

const preCommit = readText('.beads/hooks/pre-commit');
if (preCommit) {
  if (!preCommit.includes('.beads/issues.jsonl')) {
    failures.push('pre-commit hook should explicitly allowlist .beads/issues.jsonl');
  }
  if (!preCommit.includes('.beads/hooks')) {
    failures.push('pre-commit hook should still protect .beads/hooks');
  }
  if (!preCommit.includes('SKIP_CI')) {
    failures.push('pre-commit hook should block SKIP_CI bypass attempts');
  }
  const hasHuskyBypassBlock =
    preCommit.includes('HUSKY=0') ||
    preCommit.includes('HUSKY:-') ||
    preCommit.includes('HUSKY_SKIP_HOOKS');
  if (!hasHuskyBypassBlock) {
    failures.push('pre-commit hook should block husky bypass environment variables');
  }
  if (!preCommit.includes('check-protected-config-edit.mjs')) {
    failures.push(
      'pre-commit hook should route protected config edits through the maintainer unlock check',
    );
  }
}

const prePush = readText('.beads/hooks/pre-push');
if (prePush) {
  if (!prePush.includes('SKIP_CI')) {
    failures.push('pre-push hook should block SKIP_CI bypass attempts');
  }
  const hasHuskyBypassBlock =
    prePush.includes('HUSKY=0') ||
    prePush.includes('HUSKY:-') ||
    prePush.includes('HUSKY_SKIP_HOOKS');
  if (!hasHuskyBypassBlock) {
    failures.push('pre-push hook should block husky bypass environment variables');
  }
}

function runHookSmoke() {
  const bashCheck = spawnSync('bash', ['-lc', 'true'], { encoding: 'utf8' });
  if (bashCheck.status !== 0) {
    console.log('Guardrail verification: skipping hook smoke tests because bash is unavailable.');
    return;
  }

  const checks = [
    { name: 'no-verify', input: 'git commit --no-verify', expectError: true },
    { name: 'commit-short', input: 'git commit -n', expectError: true },
    { name: 'skip-ci-env', input: 'echo SKIP_CI=true', expectError: true },
    { name: 'skip-ci-assign', input: 'SKIP_CI=1 npm run ci', expectError: true },
    {
      name: 'disable-hooks',
      input: 'git -c core.hooksPath=/tmp/hooks commit --message "bypass"',
      expectError: true,
    },
    { name: 'skip-husky', input: 'HUSKY=0 git commit --message "skip test"', expectError: true },
    {
      name: 'skip-husky-hooks',
      input: 'HUSKY_SKIP_HOOKS=1 git commit --message "skip test"',
      expectError: true,
    },
    { name: 'skip-ci-flag', input: 'git commit --message "[skip ci] test"', expectError: true },
    { name: 'force-push', input: 'git push --force origin main', expectError: true },
    { name: 'force-push-short', input: 'git push -f origin main', expectError: true },
    { name: 'hard-reset', input: 'git reset --hard HEAD~1', expectError: true },
    { name: 'eslint-direct', input: 'eslint src/index.ts', expectError: true },
    {
      name: 'protected-tsconfig-base',
      input: 'Edit(tsconfig.base.json)',
      expectError: true,
      tool: 'Edit',
    },
    { name: 'codex-safe-shell', input: 'echo codex status', expectError: false },
    { name: 'codex-no-verify', input: 'codex "git commit --no-verify -m test"', expectError: true },
    { name: 'safe', input: 'git status', expectError: false },
  ];

  const hook = '.claude/hooks/pre-tool-use.sh';
  for (const check of checks) {
    let code = 1;
    try {
      const toolPrefix = check.tool ? `CLAUDE_TOOL_NAME="${check.tool}" ` : '';
      const result = spawnSync(
        'bash',
        ['-lc', `${toolPrefix}CLAUDE_TOOL_INPUT=${JSON.stringify(check.input)} bash ${hook}`],
        { encoding: 'utf8' },
      );
      code = result.status ?? 1;
    } catch {
      code = 1;
    }
    if (check.expectError && code === 0) {
      failures.push(`Hook smoke failure (${check.name}): expected non-zero exit`);
    }
    if (!check.expectError && code !== 0) {
      failures.push(`Hook smoke failure (${check.name}): expected command to be allowed`);
    }
  }
}

runHookSmoke();

if (failures.length > 0) {
  console.error('Guardrail verification failed:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('Guardrail verification passed.');
}
