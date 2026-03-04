# Project Rules

> Generated from `docs/src/CLAUDE-001.toon`

- **id**: CLAUDE-001
- **kind**: CLAUDE
- **status**: accepted
- **scope**: platform
- **owner**: AI Operations
- **date**: 2026-03-04
- **tags**: assistant, rules

## Sections

### Quick reference

Quality gate: `npm run ci` (run before claiming work complete).

### Tests

Run `npm run test` or `npm run test:watch` for feedback. Use `npm run test:coverage` before PR.

### Monorepo structure

This repo uses npm workspaces (`packages/*`, `apps/*`).

### Rules

- Domain code must have zero external dependencies (except shared primitives).
- Use branded primitives for IDs.
- No weakening of ESLint/Prettier/TypeScript/Vitest/dependency-cruiser rules.

### Architecture

Dependency flow is inward only.

- Domain depends only on `@repo/shared`.
- Application depends on domain and ports.
- Infrastructure implements ports.
- Presentation depends on application, domain, infrastructure.

### Testing

Use mutation testing and coverage thresholds in CI. Tests should validate behavior, not just line execution.

### Work tracking

Use `bd` and `agent` commands for work tracking and handoffs.

### Documentation

Keep `.toon` artifacts in `docs/src` authoritative; regenerate before opening PRs.
