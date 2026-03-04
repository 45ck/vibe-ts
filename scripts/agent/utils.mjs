#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function hasRepositoryMarker(candidate) {
  const gitPath = path.join(candidate, '.git');
  const packagePath = path.join(candidate, 'package.json');
  const beadsPath = path.join(candidate, '.beads');
  return fs.existsSync(gitPath) && fs.existsSync(packagePath) && fs.existsSync(beadsPath);
}

function detectRoot() {
  let current = process.cwd();
  while (true) {
    if (hasRepositoryMarker(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return DEFAULT_ROOT;
}

const ROOT = detectRoot();
const BD_SCRIPT = path.join(ROOT, 'scripts', 'beads', 'bd.mjs');

const PRIORITY_WEIGHT = { P0: 0, P1: 1, P2: 2, P3: 3, 0: 0, 1: 1, 2: 2, 3: 3 };

export function repoRoot() {
  return ROOT;
}

export function parseArgs(argv) {
  const output = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      output[token] = next;
      i += 1;
    } else {
      output[token] = true;
    }
  }
  return output;
}

export function parseCsvList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePriority(priority) {
  if (priority === undefined || priority === null) return undefined;
  const upper = String(priority).toUpperCase();
  if (/^[0-3]$/.test(upper)) return `P${upper}`;
  return upper;
}

export function sortByPriority(issues) {
  return [...issues].sort((a, b) => {
    const aPriority = PRIORITY_WEIGHT[normalizePriority(a.priority)] ?? 4;
    const bPriority = PRIORITY_WEIGHT[normalizePriority(b.priority)] ?? 4;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}

export function readIssuesFromFile(root = ROOT) {
  const filePath = path.join(root, '.beads', 'issues.jsonl');
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON in .beads/issues.jsonl at line ${index + 1}.`);
    }
  });
}

export function isBlocked(issue, closedIds) {
  if (!Array.isArray(issue.blockedBy) || issue.blockedBy.length === 0) return false;
  return issue.blockedBy.some((id) => !closedIds.has(id));
}

export function isClaimed(issue) {
  return typeof issue?.claimedBy === 'string' && issue.claimedBy.trim().length > 0;
}

export function readyIssues(issues) {
  const closedIds = new Set(
    issues.filter((issue) => issue?.status === 'closed').map((issue) => issue.id),
  );
  return sortByPriority(
    issues.filter((issue) => issue?.status === 'open' && !isBlocked(issue, closedIds)),
  );
}

export function readBeadsIssueJson(root = ROOT, issueId) {
  const issues = readIssuesFromFile(root);
  return issues.find((issue) => issue.id === issueId) ?? null;
}

export function runNodeScript(scriptPath, args, cwd = ROOT) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: node ${scriptPath} ${args.join(' ')}\n${result.stderr?.trim() || ''}`,
    );
  }
  return { stdout: result.stdout?.trim() ?? '', stderr: result.stderr?.trim() ?? '' };
}

export function runBdCommand(args, jsonExpected = false, cwd = ROOT) {
  const normalizedArgs = [...args];
  if (jsonExpected && !normalizedArgs.includes('--json')) normalizedArgs.push('--json');
  const { stdout } = runNodeScript(BD_SCRIPT, normalizedArgs, cwd);
  if (!jsonExpected && !normalizedArgs.includes('--json')) {
    return stdout;
  }
  if (!stdout) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse JSON from bd output: ${stdout.slice(0, 200)}`);
  }
}

export function gitCommand(args, cwd = ROOT) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  };
}
