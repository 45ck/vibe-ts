# Project Rules

## Quick reference

- Quality gate: `npm run ci` (run before claiming work is done)
- Tests: `npm run test` or `npm run test:watch`
- Lint fix: `npm run lint:fix && npm run format`

## Rules

- Domain code (`src/domain/`) must have zero external dependencies.
- All identity types use branded primitives from `src/domain/primitives/`.
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

Layers are created on demand -- not every project needs all four.
Dependency-cruiser enforces inward-only flow when layers exist.

| Layer          | Path                  | May depend on                       |
| -------------- | --------------------- | ----------------------------------- |
| Domain         | `src/domain/`         | nothing                             |
| Application    | `src/application/`    | domain                              |
| Infrastructure | `src/infrastructure/` | domain, application                 |
| Presentation   | `src/presentation/`   | domain, application, infrastructure |

## Adding a feature

1. Domain -- entity/value object with branded IDs
2. Port -- interface in `src/application/ports/`
3. Use case -- async function taking command + port(s)
4. Adapter -- in-memory first, in `src/infrastructure/adapters/`
5. Entry point -- wire in `src/presentation/`
6. Tests at every layer; run `npm run ci`

## Naming

- Commands: `CreateUser`, `ActivateSubscription` (imperative)
- Events: `UserCreated`, `SubscriptionActivated` (past tense)
- Primitives: branded types (`UserId`, `OrderId`)
- Use cases: `{verb}-{noun}-use-case.ts`
- Tests: colocated `*.test.ts`

## Testing

- Vitest, colocated tests, coverage thresholds per layer
- In-memory adapters for domain/application tests
- Mutation testing: `npm run mutation` (Stryker)

## Work tracking (Beads)

- Use `bd` for all work tracking; commit `.beads/issues.jsonl` with code changes.
- Autonomous loop: read `AGENT_LOOP.md` for the full pick -> claim -> implement -> finish cycle.
- Core commands:
  - `npm run bd -- issue next --json` -- show unblocked issues
  - `npm run bd -- issue start <id> --by "<name>"` -- claim + create worktree
  - `npm run bd -- issue finish <id>` -- merge + close + auto-push (from repo root)
- Do not modify `AGENT_LOOP.md` or `.beads/issues.jsonl` manually.
