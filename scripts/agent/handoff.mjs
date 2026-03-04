#!/usr/bin/env node
import { parseArgs, readBeadsIssueJson, runBdCommand, repoRoot } from './utils.mjs';

const root = repoRoot();
const args = parseArgs(process.argv.slice(2));

const issueId = typeof args['--issue'] === 'string' ? args['--issue'].trim() : '';
const from = typeof args['--from'] === 'string' ? args['--from'].trim() : '';
const to = typeof args['--to'] === 'string' ? args['--to'].trim() : '';
const note = typeof args['--note'] === 'string' ? args['--note'].trim() : '';
const asJson = Boolean(args['--json']);
const isDryRun = Boolean(args['--dry-run']);
const force = Boolean(args['--force']);

function buildHandoffBody(issue, toAgent, noteText, previousOwner) {
  const safeNote = noteText || 'handoff requested';
  const stamp = new Date().toISOString();
  const header = `## Handoff (${stamp})`;
  const details = [
    `- from: ${previousOwner || 'unknown/unclaimed'}`,
    `- to: ${toAgent}`,
    `- issue: ${issue.id}`,
    `- note: ${safeNote}`,
  ];
  const fragment = `${header}\n${details.join('\n')}`;
  const existing = String(issue.body || '').trim();
  return existing ? `${existing}\n\n${fragment}` : `${fragment}\n`;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function main() {
  if (!issueId) fail('Missing --issue <id>.');
  if (!to) fail('Missing --to "<agent>".');

  const issue = readBeadsIssueJson(root, issueId);
  if (!issue) fail(`Issue ${issueId} not found.`);
  if (issue.status && issue.status !== 'open') {
    fail(`Issue ${issueId} is ${issue.status} and cannot be handed off.`);
  }

  const previousOwner =
    typeof issue.claimedBy === 'string' && issue.claimedBy.trim() ? issue.claimedBy.trim() : '';
  if (previousOwner && !from && !force) {
    fail(
      `Issue ${issueId} is currently claimed by "${previousOwner}". Use --from "${previousOwner}" or --force.`,
    );
  }
  if (from && previousOwner && previousOwner !== from && !force) {
    fail(
      `Issue ${issueId} is claimed by "${previousOwner}", not "${from}". Use --force to override.`,
    );
  }

  if (isDryRun) {
    const out = {
      issueId,
      from: previousOwner || from || null,
      to,
      note,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }

  if (previousOwner) {
    runBdCommand(
      ['issue', 'unclaim', issueId, '--by', previousOwner, ...(force ? ['--force'] : [])],
      true,
      root,
    );
  }
  const claimed = runBdCommand(['issue', 'claim', issueId, '--by', to], true, root);
  const handoffBody = buildHandoffBody(claimed, to, note, previousOwner || from || null);
  const updated = runBdCommand(['issue', 'update', issueId, '--body', handoffBody], true, root);

  if (asJson) {
    process.stdout.write(JSON.stringify(updated, null, 2));
    process.stdout.write('\n');
    return;
  }

  process.stdout.write(`Handoff recorded: ${issueId} -> ${to}\n`);
  if (issueId !== updated.id) {
    process.stdout.write(`Warning: expected ${issueId}, got ${updated.id}\n`);
  }
}

main();
