#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'coverage',
  '.nyc_output',
  'dist',
  '.tsbuildinfo',
]);

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      parsed._.push(token);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      parsed[token] = next;
      i += 1;
    } else {
      parsed[token] = true;
    }
  }
  return parsed;
}

function normalizePackageName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function normalizeScope(raw) {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  if (!normalized) return '@template';
  return normalized.startsWith('@') ? normalized : `@${normalized}`;
}

function parseJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const value = JSON.parse(raw);
  return value;
}

function writeJson(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, text, 'utf8');
}

function shouldSkipCopy(entryName, relativePath) {
  if (!relativePath || relativePath === '') return false;
  const parts = relativePath.split(/[\\/]/);
  return parts.some((part) => SKIP_DIRS.has(part));
}

function copyTemplate(srcRoot, destRoot) {
  fs.cpSync(srcRoot, destRoot, {
    recursive: true,
    preserveTimestamps: false,
    filter(source) {
      const rel = path.relative(srcRoot, source);
      const normalized = rel.split(path.sep).join('/');
      if (!normalized || normalized === '.') return true;
      return !shouldSkipCopy(path.basename(source), normalized);
    },
  });
}

function walkTextFiles(root, callback) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walkTextFiles(current, callback);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const okExt = new Set(['.md', '.json', '.ts', '.mts', '.mjs', '.js', '.yml', '.yaml', '.txt']);
    if (!okExt.has(ext)) continue;
    callback(current);
  }
}

function rewriteTextFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  for (const [search, replacement] of replacements) {
    content = content.split(search).join(replacement);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function updateWorkspacePackages(root, projectName, scopeName, skipTextRewrite = false) {
  const sharedScope = `${scopeName}/shared`;
  const exampleScope = `${scopeName}/example`;

  const rootPackagePath = path.join(root, 'package.json');
  if (fs.existsSync(rootPackagePath)) {
    const rootPackage = parseJson(rootPackagePath);
    rootPackage.name = projectName || rootPackage.name;
    writeJson(rootPackagePath, rootPackage);
  }

  const sharedPackagePath = path.join(root, 'packages', 'shared', 'package.json');
  if (fs.existsSync(sharedPackagePath)) {
    const sharedPackage = parseJson(sharedPackagePath);
    sharedPackage.name = sharedScope;
    sharedPackage.exports = {
      '.': {
        import: './dist/index.js',
        types: './dist/index.d.ts',
      },
    };
    sharedPackage.main = './dist/index.js';
    sharedPackage.types = './dist/index.d.ts';
    sharedPackage.files = ['dist', 'package.json'];
    writeJson(sharedPackagePath, sharedPackage);
  }

  const examplePackagePath = path.join(root, 'apps', 'example', 'package.json');
  if (fs.existsSync(examplePackagePath)) {
    const examplePackage = parseJson(examplePackagePath);
    examplePackage.name = exampleScope;
    if (examplePackage.dependencies && examplePackage.dependencies['@repo/shared']) {
      examplePackage.dependencies[sharedScope] = examplePackage.dependencies['@repo/shared'];
      delete examplePackage.dependencies['@repo/shared'];
    }
    writeJson(examplePackagePath, examplePackage);
  }

  if (skipTextRewrite) return;

  const replacements = [
    ['vibe-ts', projectName],
    ['@repo/shared', sharedScope],
    ['@repo/example', exampleScope],
  ];

  walkTextFiles(root, (filePath) => rewriteTextFile(filePath, replacements));
}

function runInstall(targetDir, shouldInstall) {
  if (!shouldInstall) return;
  const result = spawnSync('npm', ['install', '--ignore-scripts'], {
    cwd: targetDir,
    stdio: 'inherit',
    shell: true,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `Template install failed while running npm install (exit ${result.status ?? 'unknown'}).`,
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const shouldSkipInstall = Boolean(args['--no-install'] || args['--skip-install']);
  const targetArg = args._[0];
  if (!targetArg) {
    process.stderr.write(
      'Usage: vibe-ts <target-directory> [--name <name>] [--scope <scope>] [--no-install]\n' +
        'Usage: npm run template:create -- <target-directory> [--name <name>] [--scope <scope>] [--no-install]\n',
    );
    process.exitCode = 1;
    return;
  }

  const targetDir = path.resolve(String(targetArg));
  if (fs.existsSync(targetDir)) {
    process.stderr.write(`Target directory already exists: ${targetDir}\n`);
    process.exitCode = 1;
    return;
  }

  const templateRoot = args['--from']
    ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', args['--from'])
    : TEMPLATE_ROOT;

  const projectName = normalizePackageName(args['--name'] || path.basename(targetDir));
  const scopeName = normalizeScope(args['--scope'] || projectName);

  if (!fs.existsSync(path.join(templateRoot, 'package.json'))) {
    process.stderr.write(`Invalid template root: ${templateRoot}\n`);
    process.exitCode = 1;
    return;
  }

  copyTemplate(templateRoot, targetDir);
  updateWorkspacePackages(targetDir, projectName, scopeName, false);
  runInstall(targetDir, !shouldSkipInstall);

  process.stdout.write(`Created template in ${targetDir}\n`);
}

main();
