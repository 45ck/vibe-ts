#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, parseCsvList, readIssuesFromFile, runBdCommand, repoRoot } from './utils.mjs';

const root = repoRoot();
const defaultPlanPath = path.join(root, 'scripts', 'agent', 'bootstrap-plan.json');

const args = parseArgs(process.argv.slice(2));
const asJson = Boolean(args['--json']);
const isDryRun = Boolean(args['--dry-run']);
const force = Boolean(args['--force']);
const planPath = typeof args['--plan'] === 'string' ? args['--plan'].trim() : '';
const filterTags = parseCsvList(args['--tags']);

function loadPlan(filePath) {
  const resolvedPath = path.resolve(root, filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Plan file not found: ${resolvedPath}`);
  }
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.issues)) {
    throw new Error('Seed plan must expose an "issues" array.');
  }
  return parsed.issues;
}

function isDuplicate(existingIssues, title) {
  const needle = title.toLowerCase();
  return existingIssues.some((issue) => String(issue.title || '').toLowerCase() === needle);
}

function buildBody(entry) {
  const header = `Plan ID: ${entry.id ? `[${entry.id}] ` : ''}${entry.title}`;
  const lines = [];
  if (entry.body && entry.body.trim().length > 0) lines.push(entry.body.trim());
  if (entry.phase) lines.push(`Phase: ${entry.phase}`);
  if (entry.tags?.length) lines.push(`Tags: ${entry.tags.join(', ')}`);
  if (entry.kind) lines.push(`Kind: ${entry.kind}`);
  return `${header}\n\n${lines.join('\n')}`;
}

function createIssue(entry) {
  const title = String(entry.title || '').trim();
  if (!title) throw new Error('Issue title is required in plan file.');
  const priority = String(entry.priority || 'P2').toUpperCase();
  const phase = typeof entry.phase === 'string' ? entry.phase.trim() : '';
  const blockedBy = Array.isArray(entry.blockedBy) ? entry.blockedBy : [];

  const args = [
    'issue',
    'create',
    '--title',
    title,
    '--priority',
    priority,
    '--body',
    buildBody(entry),
  ];
  if (phase) args.push('--phase', phase);
  if (blockedBy.length) args.push('--blocked-by', blockedBy.join(','));

  return runBdCommand(args, true, root);
}

function matchesTagFilter(entry) {
  if (filterTags.length === 0) return true;
  if (!Array.isArray(entry.tags)) return false;
  const lower = new Set(entry.tags.map((tag) => String(tag).toLowerCase()));
  return filterTags.some((tag) => lower.has(tag.toLowerCase()));
}

function main() {
  const planFile = planPath || defaultPlanPath;
  const entries = loadPlan(planFile).filter(matchesTagFilter);
  const existing = readIssuesFromFile(root);
  const created = [];
  const skipped = [];

  for (const entry of entries) {
    const title = String(entry.title || '').trim();
    if (!title) continue;
    if (!force && isDuplicate(existing, title)) {
      skipped.push({ reason: 'duplicate_title', title });
      continue;
    }
    if (isDryRun) {
      skipped.push({ reason: 'dry_run', title });
      continue;
    }
    const createdIssue = createIssue(entry);
    if (createdIssue) {
      created.push(createdIssue);
      existing.push(createdIssue);
    }
  }

  const result = {
    planned: entries.length,
    created: created.length,
    skipped: skipped.length,
    createdIssueIds: created.map((issue) => issue.id),
    skippedReasons: skipped,
    planFile: path.resolve(root, planFile),
    dryRun: isDryRun,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
    return;
  }

  if (created.length === 0 && skipped.length === 0) {
    process.stdout.write(`No issues found in ${path.basename(planFile)}.\n`);
    return;
  }
  process.stdout.write(
    `Seed complete from ${path.basename(planFile)}: ` +
      `${result.created} created, ${result.skipped} skipped.\n`,
  );
  if (created.length > 0) {
    process.stdout.write(`Created: ${created.map((issue) => issue.id).join(', ')}\n`);
  }
  if (skipped.length > 0) {
    process.stdout.write('Skipped:\n');
    for (const item of skipped) {
      process.stdout.write(`- ${item.reason}: ${item.title}\n`);
    }
  }
}

main();
