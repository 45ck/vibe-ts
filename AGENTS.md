# AGENTS Instructions Source

> Generated from `docs/src/AGENTS-001.toon`

- **id**: AGENTS-001
- **kind**: AGENTS
- **status**: accepted
- **scope**: platform
- **owner**: Repository Governance
- **date**: 2026-03-04
- **tags**: agents, governance

## Sections

### Purpose

Define repository governance for AI agents and autonomous workflows.

### Core principles

- Preserve architecture boundaries.
- Keep generated documentation in sync.
- Prefer deterministic, checkable changes.

### Required workflow

1. Read current task context.
2. Confirm docs source changes with `docs/src`.
3. Run `npm run docs:generate`.
4. Ensure CI checks pass before merging.

### Security posture

Do not allow hook bypasses (`SKIP_CI`, `--no-verify`, `HUSKY=0`, `HUSKY_SKIP_HOOKS`, `--force` etc.).

### Quality contract

Pull requests must pass `npm run ci`, `npm run quality`, and `npm run docs:check`.
CI is the authority.

### Human handoff

For ambiguous or high-risk policy changes, require explicit user consent and include a clear summary in issue notes.
