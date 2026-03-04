#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { parseArgs, repoRoot } from '../agent/utils.mjs';

const root = repoRoot();
const args = parseArgs(process.argv.slice(2));
const shouldWrite = Boolean(args['--write']);
const shouldCheck = Boolean(args['--check']);
const sourceDir = path.resolve(
  root,
  typeof args['--source-dir'] === 'string' ? args['--source-dir'] : 'docs/src',
);
const outRoot = path.resolve(
  root,
  typeof args['--out-dir'] === 'string' ? args['--out-dir'] : 'docs',
);

const ROOT_DOCS = new Set(['README', 'CLAUDE', 'AGENTS']);
const KIND_TARGETS = {
  README: 'README.md',
  CLAUDE: 'CLAUDE.md',
  AGENTS: 'AGENTS.md',
};

if (!shouldWrite && !shouldCheck) {
  console.error(
    'Usage: node scripts/docs/sync-docs.mjs --check | --write [--source-dir path] [--out-dir path]',
  );
  process.exit(1);
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Missing source directory: ${path.relative(root, sourceDir)}`);
  process.exit(1);
}

function normalizeText(raw) {
  return raw.replace(/\r\n/g, '\n').trimEnd();
}

function listToonFiles(baseDir) {
  const items = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const resolved = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      items.push(...listToonFiles(resolved));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.toon')) {
      items.push(resolved);
    }
  }
  return items;
}

function splitCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function decodeValue(value) {
  return value.replace(/\\n/g, '\n');
}

function stripOptionalQuotes(raw) {
  const value = decodeValue(raw).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function assignKeyValue(doc, key, value) {
  const existing = doc[key];
  if (!existing) {
    doc[key] = value;
    return;
  }

  if (Array.isArray(existing)) {
    doc[key] = [...existing, value];
  } else {
    doc[key] = [existing, value];
  }
}

function parseNestedBlock(lines, start, indent) {
  const nested = {};
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const currentIndent = line.match(/^\s*/)?.[0]?.length ?? 0;
    if (currentIndent <= indent) {
      break;
    }

    const trimmed = line.trim();
    const arrMatch = trimmed.match(/^([A-Za-z0-9_]+)\[(\d+)\]:\s*(.*)$/);
    if (arrMatch) {
      nested[arrMatch[1]] = splitCsv(arrMatch[3]);
    } else {
      const valueMatch = trimmed.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (valueMatch) {
        nested[valueMatch[1]] = stripOptionalQuotes(valueMatch[2]);
      }
    }
    i += 1;
  }
  return { value: nested, nextIndex: i - 1 };
}

function parseToon(text) {
  const lines = text.split(/\r?\n/);
  const doc = {
    id: '',
    kind: '',
    title: '',
    sections: [],
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    if (line.trimStart() !== line) {
      continue;
    }

    const sectionMatch = line.match(/^([A-Za-z0-9_]+)\[(\d+)\]\{([^}]*)\}:\s*$/);
    if (sectionMatch) {
      const key = sectionMatch[1];
      const rawColumns = sectionMatch[3]
        .split(',')
        .map((column) => column.trim())
        .filter(Boolean);
      const usesTitleBody =
        rawColumns[0]?.toLowerCase?.() === 'title' && rawColumns[1]?.toLowerCase?.() === 'body';
      if (usesTitleBody) {
        i += 1;
        while (i < lines.length) {
          const sectionLine = lines[i];
          if (sectionLine.trim() === '') {
            i += 1;
            continue;
          }
          const sectionIndent = sectionLine.match(/^\s*/)?.[0]?.length ?? 0;
          if (sectionIndent === 0) break;

          const trimmedSectionLine = sectionLine.trim();
          const commaIndex = trimmedSectionLine.indexOf(',');
          if (commaIndex < 0) {
            doc[key].push({
              title: stripOptionalQuotes(trimmedSectionLine),
              body: '',
            });
          } else {
            doc[key].push({
              title: stripOptionalQuotes(trimmedSectionLine.slice(0, commaIndex)),
              body: stripOptionalQuotes(trimmedSectionLine.slice(commaIndex + 1).trim()),
            });
          }
          i += 1;
        }
        i -= 1;
        continue;
      }

      continue;
    }

    const arrMatch = line.match(/^([A-Za-z0-9_]+)\[(\d+)\]:\s*(.*)$/);
    if (arrMatch) {
      const key = arrMatch[1];
      doc[key] = splitCsv(arrMatch[3]);
      continue;
    }

    const blockMatch = line.match(/^([A-Za-z0-9_]+):\s*$/);
    if (blockMatch) {
      const key = blockMatch[1];
      const indent = line.match(/^\s*/)?.[0]?.length ?? 0;
      const parsed = parseNestedBlock(lines, i, indent);
      if (Object.keys(parsed.value).length > 0) {
        doc[key] = parsed.value;
        i = parsed.nextIndex;
      }
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = stripOptionalQuotes(kvMatch[2]);
      const existing = doc[key];
      if (existing) {
        assignKeyValue(doc, key, value);
      } else {
        doc[key] = value;
      }
      continue;
    }
  }

  return doc;
}

function renderMarkdown(doc, sourcePath) {
  const title = String(doc.title || 'Untitled');
  const relativeSource = path.relative(root, sourcePath).replace(/\\/g, '/');
  const lines = [`# ${title}`, '', `> Generated from \`${relativeSource}\``];
  const metadataKeys = [
    'id',
    'kind',
    'status',
    'scope',
    'owner',
    'date',
    'canonicalKey',
    'tags',
    'implements',
    'dependsOn',
    'references',
    'supersedes',
    'supersededBy',
    'conflictsWith',
  ];

  lines.push('');
  for (const key of metadataKeys) {
    const value = doc[key];
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      lines.push(`- **${key}**: ${value.join(', ')}`);
      continue;
    }
    lines.push(`- **${key}**: ${value}`);
  }

  if (Array.isArray(doc.sections) && doc.sections.length > 0) {
    lines.push('', '## Sections');
    for (const section of doc.sections) {
      lines.push('', `### ${section.title || 'Untitled'}`, '');
      lines.push(section.body || '');
    }
  }

  lines.push('', '');
  return `${lines.join('\n')}\n`;
}

function outputPathForDoc(doc, sourcePath) {
  const kind = String(doc.kind || '')
    .trim()
    .toUpperCase();
  const explicitTarget = typeof doc.target === 'string' ? doc.target.trim() : '';
  if (explicitTarget.length > 0) {
    return path.resolve(root, explicitTarget);
  }
  if (ROOT_DOCS.has(kind)) {
    return path.resolve(root, KIND_TARGETS[kind]);
  }
  const relativeSource = path.relative(sourceDir, sourcePath);
  const parsed = path.parse(relativeSource);
  const stem = `${parsed.name}.md`;
  const outDir = path.join(outRoot, parsed.dir);
  return path.join(outDir, stem);
}

function buildGenerationSet() {
  const files = listToonFiles(sourceDir);
  const generated = new Map();
  const errors = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = parseToon(raw);
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    if (!id) {
      errors.push(`Missing id in ${path.relative(root, file)}`);
      continue;
    }
    const target = outputPathForDoc(parsed, file);
    const content = renderMarkdown(parsed, file);
    generated.set(target, { content, source: file });
  }

  return { errors, generated };
}

function runCheck(generated) {
  let failed = false;
  for (const [target, data] of generated) {
    const next = normalizeText(data.content);
    const existing = fs.existsSync(target) ? normalizeText(fs.readFileSync(target, 'utf8')) : '';
    if (next !== existing) {
      console.error(`Outdated generated file: ${path.relative(root, target)}`);
      failed = true;
    }
  }
  return failed;
}

function runWrite(generated) {
  for (const [target, data] of generated) {
    const parent = path.dirname(target);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(target, data.content, 'utf8');
    process.stdout.write(`Wrote ${path.relative(root, target)}\n`);
  }
}

function main() {
  const { errors, generated } = buildGenerationSet();
  if (errors.length > 0) {
    console.error('Doc sync failed:');
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  if (shouldCheck && runCheck(generated)) {
    process.exit(1);
  }

  if (shouldWrite) {
    runWrite(generated);
    process.exit(0);
  }

  process.stdout.write('Docs sync check passed.\n');
}

main();
