# Project Rules

## Quick reference

- Quality gate: `npm run ci` (run before claiming work is done)
- Tests: `npm run test` or `npm run test:watch`
- Lint fix: `npm run lint:fix && npm run format`

## Monorepo structure

This is an npm workspaces monorepo. All packages use the `@repo/` scope.

| Directory   | Purpose                                                  |
| ----------- | -------------------------------------------------------- |
| `packages/` | Shared libraries consumed by apps (`@repo/shared`, etc.) |
| `apps/`     | Deployable applications (`@repo/example`, etc.)          |

- `packages/shared` exports branded primitives (`Branded`, `brand`, `unbrand`) and domain events (`DomainEvent`, `createDomainEvent`).
- Apps import shared code via `@repo/shared`. App-specific branded IDs (e.g., `UserId`, `GreetingId`) live in `apps/<name>/src/domain/primitives/`.
- `tsc --build` uses project references to compile in dependency order.
- Vitest runs in workspace mode via `vitest.workspace.ts`.
- `depcruise` and `mutation` run per-workspace via `--workspaces --if-present`.

## Rules

- Domain code (`apps/<name>/src/domain/`) must have zero external dependencies (except `@repo/shared`).
- All identity types use branded primitives from `@repo/shared` (foundation) and `apps/<name>/src/domain/primitives/` (app-specific IDs).
- No inline `// eslint-disable`. Override in `eslint.config.mjs` with a comment.
- No `any`. No `@ts-ignore` without a 5+ char description.
- Every public API must have a boundary test.
- Do not modify ESLint, Prettier, TypeScript, Vitest, or dependency-cruiser configs to weaken rules.

## Enforced caps (ESLint)

- Complexity: 10 | Cognitive complexity: 15
- Max depth: 4 | Max params: 4
- Max lines/function: 80 | Max lines/file: 350
- Coverage: 90% statements/functions/lines global, 85% branches

## Architecture (DDD, layers optional)

Layers are created on demand -- not every app needs all four.
Dependency-cruiser enforces inward-only flow when layers exist (per-app).

| Layer          | Path                              | May depend on                       |
| -------------- | --------------------------------- | ----------------------------------- |
| Domain         | `apps/<name>/src/domain/`         | `@repo/shared` only                 |
| Application    | `apps/<name>/src/application/`    | domain                              |
| Infrastructure | `apps/<name>/src/infrastructure/` | domain, application                 |
| Presentation   | `apps/<name>/src/presentation/`   | domain, application, infrastructure |

## Adding a feature

1. Choose which app (e.g., `apps/example`)
2. Domain -- entity/value object with branded IDs in `apps/<name>/src/domain/`
3. Port -- interface in `apps/<name>/src/application/ports/`
4. Use case -- async function taking command + port(s)
5. Adapter -- in-memory first, in `apps/<name>/src/infrastructure/adapters/`
6. Entry point -- wire in `apps/<name>/src/presentation/`
7. Tests at every layer; run `npm run ci`

## Naming

- Commands: `CreateUser`, `ActivateSubscription` (imperative)
- Events: `UserCreated`, `SubscriptionActivated` (past tense)
- Primitives: branded types (`UserId`, `OrderId`)
- Use cases: `{verb}-{noun}-use-case.ts`
- Tests: colocated `*.test.ts`

## Testing

- Vitest, colocated tests, coverage thresholds per layer
- In-memory adapters for domain/application tests
- Mutation testing: `npm run mutation` (Stryker, per-app)

## Work tracking (Beads)

- Use `bd` for all work tracking; commit `.beads/issues.jsonl` with code changes.
- Autonomous loop: read `AGENT_LOOP.md` for the full pick -> claim -> implement -> finish cycle.
- Core commands:
  - `npm run bd -- issue next --json` -- show unblocked issues
  - `npm run bd -- issue start <id> --by "<name>"` -- claim + create worktree
  - `npm run bd -- issue finish <id>` -- merge + close + auto-push (from repo root)
- Do not modify `AGENT_LOOP.md` or `.beads/issues.jsonl` manually.

Agent swarm helpers:

- `npm run agent:context` -- summarize current issue state, branch/agent/docs info.
- `npm run agent:seed-issues` -- bootstrap default plan issues from `scripts/agent/bootstrap-plan.json`.
- `npm run agent:spawn -- --agents "agent-alpha,agent-beta"` -- spawn a parallel team plan (defaults to auto-start).
- `npm run agent:handoff -- --issue <id> --to <agent> --note "<message>"` -- transfer ownership.

## Planning artifacts (agent-docs)

- Every feature or architectural decision must have a validated TOON artifact in `docs/` before implementation starts.
- **Spec-first rule**: if a Beads issue has a `specRef` field, find and read that artifact before writing any code.
- Check artifact validity: `npm run docs:check`
- After changing artifacts: `npm run docs:generate`
- Artifact kinds in `docs/`: ADR (decisions), PRD (product requirements), SRD (system requirements), POLICY (rules), DOMAINTREE (domain model), JOURNEY (user flows)
- If no `specRef` exists and requirements are unclear, stop and ask the user to create an artifact rather than guessing.

## Issue creation (with spec reference)

When creating a Beads issue for a feature, always include a `specRef` pointing to the relevant artifact id:

```
npm run bd -- issue create --title "feat: add user auth" --specRef ADR-003
```

If the artifact does not exist yet, create it in `docs/` first, run the check, then create the issue.
