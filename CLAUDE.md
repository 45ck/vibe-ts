# Project Rules

## Quick reference

- Quality gate: `npm run ci`
- Tests: `npm run test` or `npm run test:watch`
- Lint fix: `npm run lint:fix && npm run format`

## Non-negotiables

- Run `npm run ci` before claiming any work is done.
- Domain code (`src/domain/`) must have zero external dependencies.
  No HTTP, no database, no framework imports. Only other domain code.
- All domain identity types use branded primitives from `src/domain/primitives/`.
- No inline ESLint suppression (`// eslint-disable`). If a rule conflicts with
  your design, fix the code or add a project-level override in `eslint.config.mjs`
  with a comment explaining why.
- No `any` types. No `@ts-ignore` without a description of at least 5 characters.
- Every public API must have a boundary test (types + behaviour).

## Architecture layers (enforced by dependency-cruiser)

```
src/domain/          -- entities, value objects, domain events (no HTTP/DB)
src/application/     -- use cases, orchestration, ports (interfaces)
src/infrastructure/  -- adapters, external integrations, DB, queues
src/presentation/    -- HTTP handlers, CLI, UI
```

Dependencies flow inward only:

- domain depends on nothing
- application depends on domain
- infrastructure depends on domain + application
- presentation depends on domain + application + infrastructure

## How to add a feature

1. Start in `src/domain/` -- define the entity, value object, or aggregate.
   Use branded primitives for all IDs.
2. Define the port (interface) in `src/application/ports/`.
3. Write the use case in `src/application/` -- it depends only on ports and domain.
4. Implement the adapter in `src/infrastructure/adapters/`.
   Start with an in-memory implementation for testing.
5. Wire it in `src/presentation/` (HTTP route, CLI command, etc.).
6. Write tests at every layer. Domain logic should be exhaustively tested.

## Code quality caps (enforced by ESLint)

- Max complexity: 10
- Max depth: 4
- Max lines per function: 80 (excluding blanks/comments)
- Max lines per file: 350 (excluding blanks/comments)
- Max parameters: 4
- Max cognitive complexity: 15

If you hit these limits, decompose. Extract a helper, split the module,
or introduce a new abstraction. These limits exist to keep code reviewable
by both humans and AI.

## Naming conventions

- Commands (imperative): `CreateUser`, `ActivateSubscription`
- Events (past tense): `UserCreated`, `SubscriptionActivated`
- Domain primitives: branded types (`UserId`, `OrderId`, etc.)
- Use cases: `{verb}-{noun}-use-case.ts` (e.g., `create-user-use-case.ts`)
- Tests: colocated, same name with `.test.ts` suffix

## Testing strategy

- Unit tests: colocated `*.test.ts` files, run with Vitest
- Coverage thresholds enforced per architectural layer (see vitest.config.ts)
- Mutation testing: run `npm run mutation` (Stryker) for nightly/deep checks
- In-memory adapters for domain/application testing (no external dependencies)

## When working with AI assistants

- Always run `npm run ci` after implementing changes
- Prefer small, focused changes that pass all quality gates
- Do not bypass quality gates with `--no-verify` or `SKIP_CI`
- Do not modify ESLint/Prettier/TypeScript configs to weaken rules
- If a test is hard to write, the code is probably too complex -- refactor first
