#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseArgs,
  parseCsvList,
  readyIssues,
  readIssuesFromFile,
  runBdCommand,
  repoRoot,
  gitCommand,
} from './utils.mjs';

const root = repoRoot();
const args = parseArgs(process.argv.slice(2));
const asJson = Boolean(args['--json']);
const explicitNoAssign = Object.prototype.hasOwnProperty.call(args, '--no-assign');
const autoAssign = !explicitNoAssign;
const seedIfEmpty = !args['--no-seed'];
const runSeedNow = Boolean(args['--seed']);
const isDryRun = Boolean(args['--dry-run']);
const requestedPlanPath = typeof args['--plan'] === 'string' ? args['--plan'].trim() : '';
const countArg = Number.parseInt(typeof args['--count'] === 'string' ? args['--count'] : '', 10);
const providedAgents = parseCsvList(typeof args['--agents'] === 'string' ? args['--agents'] : '');
const assignmentsToCreate =
  Number.isFinite(countArg) && countArg > 0
    ? countArg
    : providedAgents.length > 0
      ? providedAgents.length
      : 3;
const defaultAgents = [
  'agent-alpha',
  'agent-bravo',
  'agent-charlie',
  'agent-delta',
  'agent-echo',
  'agent-foxtrot',
];
const seedScript = path.join(root, 'scripts', 'agent', 'seed-issues.mjs');
const bootstrapPlanPath =
  requestedPlanPath || path.join(root, 'scripts', 'agent', 'bootstrap-plan.json');
const issueFilePath = path.join('.beads', 'issues.jsonl');
const PRIMARY_BRANCH_CACHE = detectPrimaryBranch();

function runNode(script, scriptArgs) {
  const result = spawnSync('node', [script, ...scriptArgs], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `Failed: node ${path.basename(script)} ${scriptArgs.join(' ')}\n${result.stderr?.trim() || ''}`,
    );
  }
  return result.stdout?.trim() || '';
}

function getReadyIssues() {
  return readyIssues(readIssuesFromFile(root), root);
}

function buildAgentNames(count) {
  if (providedAgents.length > 0) {
    if (count <= providedAgents.length) {
      return providedAgents.slice(0, count);
    }
    const extra = [];
    for (let i = 0; i < count - providedAgents.length; i++) {
      extra.push(`agent-${i + providedAgents.length + 1}`);
    }
    return [...providedAgents, ...extra];
  }
  if (count <= defaultAgents.length) return defaultAgents.slice(0, count);
  const extra = [];
  for (let i = 0; i < count - defaultAgents.length; i++) {
    extra.push(`agent-${i + defaultAgents.length + 1}`);
  }
  return [...defaultAgents, ...extra];
}

function seedIssueBacklog(shouldSeed) {
  const seedArgs = ['--json', '--plan', bootstrapPlanPath];
  if (shouldSeed) {
    if (isDryRun) {
      seedArgs.unshift('--dry-run');
    }
    const out = runNode(seedScript, seedArgs);
    if (!out) return null;
    return JSON.parse(out);
  }
  return null;
}

function listIssues(items, limit = 8) {
  return (
    items
      .slice(0, limit)
      .map((item) => item.id)
      .join(', ') || '(none)'
  );
}

function isUnclaimed(issue) {
  return !(typeof issue.claimedBy === 'string' && issue.claimedBy.trim().length > 0);
}

function detectPrimaryBranch() {
  const symbolic = gitCommand(['symbolic-ref', 'refs/remotes/origin/HEAD'], root);
  if (symbolic.code === 0 && symbolic.stdout) {
    const raw = symbolic.stdout.trim();
    return raw.replace('refs/remotes/origin/', '');
  }

  const fallbackReason = symbolic.stderr || symbolic.stdout || 'origin/HEAD is unavailable';

  const head = gitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  const headBranch = head.code === 0 ? head.stdout.trim() : '';
  if (headBranch && headBranch !== 'HEAD') {
    process.stderr.write(
      `warning: origin/HEAD unresolved (${fallbackReason}); using current branch '${headBranch}' for publish.\n`,
    );
    return headBranch;
  }

  const initDefault = gitCommand(['config', '--get', 'init.defaultBranch'], root);
  const initDefaultBranch = initDefault.code === 0 ? initDefault.stdout.trim() : '';
  if (initDefaultBranch) {
    process.stderr.write(
      `warning: origin/HEAD unresolved (${fallbackReason}); using init.defaultBranch '${initDefaultBranch}' for publish.\n`,
    );
    return initDefaultBranch;
  }

  const branchList = gitCommand(['branch', '--list', '--format=%(refname:short)'], root);
  const firstBranch =
    branchList.code === 0
      ? branchList.stdout.split('\n').find((line) => line.trim().length > 0)
      : '';
  if (firstBranch) {
    const branch = firstBranch.trim();
    process.stderr.write(
      `warning: origin/HEAD unresolved (${fallbackReason}); using first local branch '${branch}' for publish.\n`,
    );
    return branch;
  }
  throw new Error(
    `Unable to resolve primary publish branch from origin/HEAD, current branch, defaultBranch, or local refs. Configure origin/HEAD explicitly.`,
  );
}

function commitClaim(issueId, agentName) {
  const addResult = gitCommand(['add', issueFilePath], root);
  if (addResult.code !== 0) {
    return {
      status: 'error',
      reason: addResult.stderr || addResult.stdout || 'Failed to stage .beads/issues.jsonl',
    };
  }

  const commitMessage = `chore: start ${issueId} by ${agentName}`;
  const commitResult = gitCommand(['commit', '-m', commitMessage], root);
  if (commitResult.code !== 0) {
    const output = `${commitResult.stderr} ${commitResult.stdout}`.trim();
    return {
      status: 'error',
      reason: output || 'Failed to commit issue claim',
    };
  }

  const pushResult = gitCommand(['push', 'origin', PRIMARY_BRANCH_CACHE], root);
  let pushStatus = pushResult.code === 0 ? 'published' : 'pending';
  let pushReason = null;

  if (pushStatus !== 'published') {
    const pullResult = gitCommand(['pull', '--rebase', 'origin', PRIMARY_BRANCH_CACHE], root);
    if (pullResult.code === 0) {
      const retryPush = gitCommand(['push', 'origin', PRIMARY_BRANCH_CACHE], root);
      if (retryPush.code === 0) {
        pushStatus = 'published';
      } else {
        pushReason = `Commit created, but push did not complete: ${retryPush.stderr || retryPush.stdout || 'unknown error'}`;
      }
    } else {
      pushReason = `Commit created, but push did not complete: ${pullResult.stderr || pullResult.stdout || 'unknown error'}`;
    }
  }

  const current = runBdCommand(['issue', 'view', issueId, '--json'], true, root);
  if (!current || current.claimedBy !== agentName) {
    return {
      status: 'error',
      reason: `Claim mismatch after commit for ${issueId}.`,
    };
  }

  if (pushStatus === 'published') return { status: 'published' };
  return { status: 'warn', reason: pushReason ?? 'Claim committed, but push did not complete.' };
}

function main() {
  const readyBefore = getReadyIssues();
  const summary = {
    generatedAt: new Date().toISOString(),
    repoRoot: root,
    autoAssign,
    dryRun: isDryRun,
    beforeReadyCount: readyBefore.length,
    seeded: false,
  };

  const shouldSeed = runSeedNow || (seedIfEmpty && readyBefore.length === 0);
  const seedResult = seedIssueBacklog(shouldSeed);
  if (seedResult) {
    summary.seeded = true;
    summary.seedResult = {
      planFile: seedResult.planFile,
      created: seedResult.created,
      skipped: seedResult.skipped,
      dryRun: seedResult.dryRun,
    };
  }

  const readyAfterSeed = seedResult && !isDryRun ? getReadyIssues() : readyBefore;
  const ready = readyAfterSeed.length > 0 ? readyAfterSeed : getReadyIssues();
  summary.afterSeedReadyCount = ready.length;

  if (ready.length === 0) {
    summary.assignments = [];
    summary.totalAssignments = 0;
    summary.failures = [];
    if (asJson) {
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      return;
    }
    process.stdout.write('No ready beads available to spawn.\n');
    process.stdout.write('Seed source empty or all beads blocked.\n');
    return;
  }

  const candidates = autoAssign ? ready.filter(isUnclaimed) : ready;
  const assignmentLimit = autoAssign
    ? Math.min(candidates.length, assignmentsToCreate)
    : Math.min(ready.length, assignmentsToCreate);
  const names = buildAgentNames(assignmentLimit);
  const assignments = [];
  const failures = [];
  let attempted = 0;

  while (assignments.length < assignmentLimit && attempted < candidates.length) {
    const issue = candidates[attempted];
    const agentName = names[attempted];
    attempted += 1;

    if (!autoAssign || isDryRun) {
      assignments.push({
        issueId: issue.id,
        agent: agentName,
        mode: autoAssign ? 'planned-dry-run' : 'manual',
        command: `npm run bd -- issue start ${issue.id} --by "${agentName}"`,
      });
      continue;
    }

    try {
      const started = runBdCommand(['issue', 'start', issue.id, '--by', agentName], true, root);
      const issueId = started.id || issue.id;
      const publish = commitClaim(issueId, agentName);
      if (publish.status === 'error') {
        failures.push({
          issueId,
          agent: agentName,
          publishBranch: PRIMARY_BRANCH_CACHE,
          reason: publish.reason,
        });
        continue;
      }
      assignments.push({
        issueId,
        agent: agentName,
        mode: 'started',
        worktree: `.trees/${issueId}`,
        nextStep: `cd .trees/${issueId} && npm install && npm run ci`,
        finishStep: `npm run bd -- issue finish ${issueId}`,
        publishStatus: publish.status,
        publishReason: publish.reason,
        publishBranch: PRIMARY_BRANCH_CACHE,
      });
    } catch (error) {
      failures.push({
        issueId: issue.id,
        agent: agentName,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  summary.attemptedCandidates = attempted;
  summary.skippedUnassigned = assignmentLimit - assignments.length;
  summary.assignments = assignments;
  summary.totalAssignments = assignments.length;
  summary.failures = failures;
  summary.publishBranch = PRIMARY_BRANCH_CACHE;

  if (asJson) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    return;
  }

  process.stdout.write(`Spawn plan: ${assignments.length} assignment(s)\n`);
  process.stdout.write(`Mode: ${autoAssign ? 'auto-start worktrees' : 'manual handoff plan'}\n`);
  if (summary.seeded) {
    process.stdout.write(
      `Seed plan applied: ${summary.seedResult?.created ?? 0} created, ${summary.seedResult?.skipped ?? 0} skipped.\n`,
    );
  }
  process.stdout.write('Ready issue list: ');
  process.stdout.write(`${listIssues(ready)}\n`);
  process.stdout.write('\n');
  for (const assignment of assignments) {
    process.stdout.write(`- ${assignment.agent}: ${assignment.issueId}\n`);
    if (assignment.mode === 'started') {
      process.stdout.write(`  worktree: ${assignment.worktree}\n`);
      process.stdout.write(`  next: ${assignment.nextStep}\n`);
      process.stdout.write(`  finish from repo root: ${assignment.finishStep}\n`);
      if (assignment.publishStatus && assignment.publishStatus !== 'published') {
        process.stdout.write(`  publish: ${assignment.publishStatus}\n`);
        process.stdout.write(`  publish reason: ${assignment.publishReason}\n`);
      }
    } else if (assignment.mode === 'planned-dry-run') {
      process.stdout.write(`  dry-run: ${assignment.command}\n`);
    } else {
      process.stdout.write(`  command: ${assignment.command}\n`);
    }
    process.stdout.write('\n');
  }
  if (summary.failures.length > 0) {
    process.stdout.write('Issues skipped due to failures:\n');
    for (const failure of summary.failures) {
      process.stdout.write(`- ${failure.issueId}: ${failure.reason}\n`);
    }
    process.stdout.write('\n');
  }
  if (attempted < candidates.length) {
    process.stdout.write(`Note: processed ${attempted} candidate(s) in this batch.\n`);
  }
  if (summary.skippedUnassigned > 0) {
    const remaining = autoAssign
      ? candidates.length - assignments.length
      : ready.length - assignments.length;
    if (remaining > 0) {
      process.stdout.write(`Remaining ready beads: ${remaining}\n`);
      process.stdout.write(
        `Tip: run this command again with --count <n> for additional batches.\n`,
      );
    }
  }
  process.stdout.write('Open README and AGENT_LOOP.md for full loop rules.\n');
}

main();
