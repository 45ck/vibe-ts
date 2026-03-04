# Quality gate enforcement policy

> Generated from `docs/src/POLICY-001.toon`

- **id**: POLICY-001
- **kind**: POLICY
- **status**: accepted
- **scope**: engineering
- **owner**: Engineering
- **date**: 2026-03-01
- **canonicalKey**: vibe-ts-policy-quality-gates
- **tags**: policy, quality, enforcement
- **dependsOn**: ADR-001, ADR-002
- **supersedes**:
- **supersededBy**:
- **conflictsWith**:

## Sections

### Scope

This policy applies to all agents and humans contributing to vibe-ts. No exceptions unless a Beads issue with explicit user approval exists.

### Protected Files

The following files define non-negotiable quality thresholds and must never be modified by agents without explicit user instruction: eslint.config.mjs vitest.config.ts .dependency-cruiser.cjs tsconfig.json tsconfig.build.json .prettierrc cspell.json. Modification is blocked at the hook layer the CI layer and the Claude settings layer. This list is authoritative and must be kept in sync with .claude/hooks/pre-tool-use.sh and .github/workflows/guardrails.yml.

### Gate Authority

CI is the authority on gate results. Local hooks are a convenience only. Passing locally does not mean passing in CI. Agents must never claim a task complete until CI passes.

### Bypass Prohibition

The flags --no-verify --force [skip ci] and SKIP_CI are unconditionally forbidden. Any attempt to use these patterns will be blocked by the pre-tool-use hook and the commit-msg hook.

### Conventional Commits

All commits must follow Conventional Commits format: type(scope): description. Valid types are feat fix docs style refactor perf test chore ci build revert. This is enforced by the commit-msg hook.
