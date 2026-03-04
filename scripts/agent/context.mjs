#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  readIssuesFromFile,
  readyIssues,
  repoRoot,
  parseArgs,
  parseCsvList,
  gitCommand,
} from './utils.mjs';

const root = repoRoot();

const args = parseArgs(process.argv.slice(2));
const asJson = Boolean(args['--json']);
const issueId = typeof args['--issue'] === 'string' ? args['--issue'].trim() : '';
const agentNames = parseCsvList(String(args['--agents'] || ''));
const showReadyLimit = Number(args['--ready'] || 12);

function readDocs() {
  const docsRoot = path.join(root, 'docs');
  if (!fs.existsSync(docsRoot)) return [];
  return fs
    .readdirSync(docsRoot)
    .filter((name) => name.endsWith('.toon'))
    .sort((a, b) => a.localeCompare(b));
}

function readAgents() {
  const dir = path.join(root, '.claude', 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/i, ''))
    .sort((a, b) => a.localeCompare(b));
}

function commandLine() {
  const agents =
    agentNames.length > 0 ? agentNames : ['agent-alpha', 'agent-bravo', 'agent-charlie'];
  const joinAgents = agents.map((name, index) => `  ${index + 1}) ${name}`).join('\n');
  return `
Ready agent workflow (copy this for each terminal):

${joinAgents}

For assignment:
  npm run agent:spawn -- --agents "<agents>"
  # explicit
  npm run agent:spawn -- --assign --agents "<agents>"
For manual commands (no auto-start):
  npm run agent:spawn -- --no-assign --agents "<agents>"
or, manual from existing unblocked bead:
  npm run bd -- issue next --json
  npm run bd -- issue start <id> --by "<agent-name>"
Note: claim and publish steps target the repository's default remote branch ('origin/HEAD').
`;
}

function getBranchName() {
  const result = gitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  return result.code === 0 && result.stdout ? result.stdout : 'unknown';
}

function getPrimaryBranchName() {
  const symbolic = gitCommand(['symbolic-ref', 'refs/remotes/origin/HEAD'], root);
  if (symbolic.code === 0) {
    const raw = symbolic.stdout.trim();
    if (raw) {
      return raw.replace('refs/remotes/origin/', '');
    }
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

  process.stderr.write(
    `warning: unable to resolve primary publish branch from origin/HEAD, current branch, defaultBranch, or local branches.\n`,
  );
  return 'unknown';
}

function getRemoteOrigin() {
  const result = gitCommand(['config', '--get', 'remote.origin.url'], root);
  return result.code === 0 ? result.stdout : null;
}

function buildSummary() {
  const issues = readIssuesFromFile(root);
  const ready = readyIssues(issues, root);
  const readyCount = ready.length;
  const counts = {
    total: issues.length,
    open: issues.filter((i) => i.status === 'open' || !i.status).length,
    closed: issues.filter((i) => i.status === 'closed').length,
    unclaimed: ready.filter((i) => !i.claimedBy).length,
    claimed: ready.filter((i) => typeof i.claimedBy === 'string' && i.claimedBy.length > 0).length,
  };

  const byPhase = new Map();
  for (const issue of issues) {
    const phase = issue.phase ?? 'unscoped';
    byPhase.set(phase, (byPhase.get(phase) ?? 0) + 1);
  }

  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0, unknown: 0 };
  for (const issue of ready) {
    if (issue.priority && byPriority[issue.priority] !== undefined) {
      byPriority[issue.priority] += 1;
    } else {
      byPriority.unknown += 1;
    }
  }

  return {
    repository: root,
    branch: getBranchName(),
    primaryBranch: getPrimaryBranchName(),
    remoteOrigin: getRemoteOrigin(),
    generatedAt: new Date().toISOString(),
    issueCounts: counts,
    issueCountsByPhase: Object.fromEntries(byPhase.entries()),
    issueCountsByPriorityReady: byPriority,
    readyIssues: ready.slice(0, Number.isFinite(showReadyLimit) ? Math.max(1, showReadyLimit) : 12),
    readyIssueCount: readyCount,
    docs: readDocs(),
    agents: readAgents(),
  };
}

function printText(summary) {
  const top =
    summary.readyIssues
      .slice(0, 8)
      .map(
        (issue) =>
          `${issue.id} ${issue.priority || '--'} [${issue.phase ?? 'unscoped'}] ${issue.title}`,
      )
      .join('\n') || ' (none)';

  process.stdout.write(`Repository: ${summary.repository}\n`);
  process.stdout.write(`Branch: ${summary.branch}\n`);
  process.stdout.write(`Primary remote publish branch: ${summary.primaryBranch}\n`);
  if (summary.remoteOrigin) process.stdout.write(`Remote: ${summary.remoteOrigin}\n`);
  process.stdout.write('\n');
  process.stdout.write(
    `Issues total/open/closed: ${summary.issueCounts.total}/${summary.issueCounts.open}/${summary.issueCounts.closed}\n`,
  );
  process.stdout.write(`Ready open issues: ${summary.readyIssueCount}\n`);
  process.stdout.write(
    `Claimed ready / unclaimed ready: ${summary.issueCounts.claimed} / ${summary.issueCounts.unclaimed}\n`,
  );
  process.stdout.write('\n');
  process.stdout.write(`Top ready issues:\n${top}\n`);
  process.stdout.write('\n');
  process.stdout.write(`Agent prompts available: ${summary.agents.join(', ') || '(none)'}\n`);
  process.stdout.write(`Docs (${summary.docs.length}): ${summary.docs.slice(0, 6).join(', ')}\n`);
  process.stdout.write('\n');
  process.stdout.write(`Suggested boot command:\n${commandLine(summary.primaryBranch)}\n`);
}

function printIssue(issue) {
  if (!issue) {
    process.stderr.write('Issue not found.\n');
    process.exit(1);
  }
  process.stdout.write(`\nID: ${issue.id}\n`);
  process.stdout.write(`Title: ${issue.title}\n`);
  process.stdout.write(`Status: ${issue.status ?? 'open'}\n`);
  process.stdout.write(`Priority: ${issue.priority ?? 'unset'}\n`);
  process.stdout.write(`Phase: ${issue.phase ?? 'unset'}\n`);
  process.stdout.write(`BlockedBy: ${(issue.blockedBy ?? []).join(', ') || '(none)'}\n`);
  process.stdout.write(`ClaimedBy: ${issue.claimedBy ?? '(none)'}\n`);
  process.stdout.write(`Created: ${issue.createdAt ?? '(unknown)'}\n`);
  process.stdout.write(`Updated: ${issue.updatedAt ?? '(unknown)'}\n`);
  process.stdout.write('\n');
  process.stdout.write(`${issue.body ?? '(no body)'}\n`);
}

function main() {
  const summary = buildSummary();

  if (asJson) {
    if (issueId) {
      const issue =
        summary.readyIssues.find((item) => item.id === issueId) ??
        summary.readyIssues.concat([]).find((item) => !issueId || item.id === issueId);
      if (issue && issue.id === issueId) {
        process.stdout.write(JSON.stringify({ ...summary, issue }, null, 2));
        process.stdout.write('\n');
      } else {
        const allIssues = readIssuesFromFile(root);
        const exact = allIssues.find((item) => item.id === issueId);
        process.stdout.write(JSON.stringify({ ...summary, issue: exact ?? null }, null, 2));
        process.stdout.write('\n');
      }
    } else {
      process.stdout.write(JSON.stringify(summary, null, 2));
      process.stdout.write('\n');
    }
    return;
  }

  if (issueId) {
    const allIssues = readIssuesFromFile(root);
    printIssue(allIssues.find((issue) => issue.id === issueId));
    return;
  }

  printText(summary);
}

main();
