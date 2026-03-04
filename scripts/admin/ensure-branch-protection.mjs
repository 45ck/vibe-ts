#!/usr/bin/env node

const GH_API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const DEFAULT_CONTEXTS = ['quality', 'guardrails'];
const DEFAULT_APPROVALS = 1;

const args = parseArgs(process.argv.slice(2));
const repository = args.repo ?? process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const action = args.apply ? 'apply' : 'verify';
const contexts = parseContexts(args.contexts ?? process.env.BRANCH_PROTECTION_CONTEXTS);
const requiredApprovals = Number.parseInt(String(args.approvals ?? DEFAULT_APPROVALS), 10);
const shouldApply = Boolean(args.apply);

if (!repository || !repository.includes('/')) {
  console.error('Error: provide repository as --repo owner/repo or set GITHUB_REPOSITORY.');
  process.exit(1);
}

if (!token) {
  console.error('Error: GH_TOKEN or GITHUB_TOKEN is required.');
  process.exit(1);
}

if (!Number.isInteger(requiredApprovals) || requiredApprovals < 1) {
  console.error('Error: --approvals must be a positive integer.');
  process.exit(1);
}

const [owner, repo] = repository.split('/');

try {
  const repoInfo = await callGitHub(`/repos/${owner}/${repo}`);
  const branch = args.branch ?? repoInfo.default_branch;

  if (!branch) {
    console.error('Error: could not determine target branch.');
    process.exit(1);
  }

  let protection = await getProtection(owner, repo, branch);
  if (shouldApply) {
    const payload = buildPayload(contexts, requiredApprovals);
    const currentState = protection ? 'update' : 'create';
    console.log(`Applying branch-protection on ${owner}/${repo}@${branch} (${currentState})...`);
    await callGitHub(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`, {
      method: 'PUT',
      body: payload,
    });
    protection = await getProtection(owner, repo, branch);
    console.log(`Branch protection applied to ${owner}/${repo}@${branch}.`);
  }

  const failures = validateProtection(protection, contexts, requiredApprovals);
  if (failures.length === 0) {
    console.log(
      `${action} completed for ${owner}/${repo}@${branch}; policy matches expected baseline.`,
    );
    process.exit(0);
  }

  console.error(`${action} found ${failures.length} blocking issue(s):`);
  for (const item of failures) {
    console.error(` - ${item}`);
  }
  process.exit(1);
} catch (error) {
  if (error?.status === 404) {
    console.error('Could not load branch protection; this token may not have access.');
  } else if (error?.status === 403) {
    console.error(
      'GitHub token is not authorized for branch protection endpoints (administrator scope required).',
    );
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}

async function getProtection(owner, repo, branch) {
  try {
    return await callGitHub(
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`,
    );
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

function buildPayload(contexts, requiredApprovals) {
  return {
    required_status_checks: {
      strict: true,
      contexts,
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      required_approving_review_count: requiredApprovals,
      require_code_owner_reviews: true,
      dismiss_stale_reviews: true,
    },
    restrictions: null,
    required_linear_history: true,
    allow_force_pushes: false,
    allow_deletions: false,
    allow_fork_syncing: false,
  };
}

function validateProtection(protection, requiredContexts, requiredApprovals) {
  const failures = [];
  if (!protection) {
    failures.push('No branch protection configuration exists on target branch.');
    return failures;
  }

  const checks = protection.required_status_checks ?? {};
  if (!checks || typeof checks !== 'object') {
    failures.push('Required status checks are disabled.');
  }
  if (checks.strict !== true) {
    failures.push('Required status checks must run on branches up-to-date with default.');
  }

  const actualContexts = new Set(checks.contexts ?? []);
  const required = requiredContexts.length > 0 ? requiredContexts : DEFAULT_CONTEXTS;
  for (const context of required) {
    if (!actualContexts.has(context)) {
      failures.push(`Required status context '${context}' is missing.`);
    }
  }

  if ((isEnabledFlag(protection.allow_force_pushes) ?? true) !== false) {
    failures.push('Force pushes are allowed; they must be disabled.');
  }
  if ((isEnabledFlag(protection.allow_deletions) ?? true) !== false) {
    failures.push('Branch deletions are allowed; they must be disabled.');
  }

  const reviews = protection.required_pull_request_reviews;
  if (!reviews) {
    failures.push('Pull-request reviews are not required.');
  } else {
    if ((reviews.required_approving_review_count ?? 0) < requiredApprovals) {
      failures.push(
        `Required PR approvals is ${reviews.required_approving_review_count ?? 0}; require at least ${requiredApprovals}.`,
      );
    }
    if (reviews.dismiss_stale_reviews !== true) {
      failures.push('Stale review dismissal should be enabled.');
    }
    if (reviews.require_code_owner_reviews !== true) {
      failures.push('Code owner reviews should be required.');
    }
  }

  if ((isEnabledFlag(protection.required_linear_history) ?? false) !== true) {
    failures.push('Linear history requirement is disabled.');
  }

  if ((isEnabledFlag(protection.enforce_admins) ?? false) !== true) {
    failures.push('Admin branch-protection enforcement is disabled.');
  }

  return failures;
}

function isEnabledFlag(value) {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'enabled' in value) {
    return Boolean(value.enabled);
  }
  return null;
}

function parseArgs(argv) {
  const output = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      output[key] = value;
      i += 1;
    } else {
      output[key] = true;
    }
  }
  return output;
}

function parseContexts(raw) {
  if (!raw) return DEFAULT_CONTEXTS;
  const parsed = String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_CONTEXTS;
}

async function callGitHub(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'vibe-ts-branch-protection',
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const result = await fetch(`${GH_API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await result.text();
  const data = raw ? parseJson(raw) : null;

  if (!result.ok) {
    const error = new Error(data?.message ?? raw ?? result.statusText);
    error.status = result.status;
    throw error;
  }
  return data;
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
