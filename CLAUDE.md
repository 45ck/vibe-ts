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
