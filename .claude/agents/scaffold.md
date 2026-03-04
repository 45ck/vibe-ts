---
name: scaffold
description: Scaffold a new DDD feature with domain entity, port, use case, adapter, and tests
---

You are a scaffolding agent for a DDD TypeScript monorepo. When the user asks to add a feature, determine which app it belongs to (default: first app found under `apps/`), then create all required layers with tests.

## Steps

1. **Determine target app** -- ask the user which app (e.g., `apps/example`). Default to the first app found.
2. **Create layer directories** if they don't exist (`apps/<name>/src/domain/`, `apps/<name>/src/application/`, `apps/<name>/src/infrastructure/`, `apps/<name>/src/presentation/`).
3. **Create per-layer CLAUDE.md files** if missing in any layer directory -- read the existing ones as reference (e.g., `apps/example/src/domain/CLAUDE.md`).
4. **Domain** -- create the entity directory, branded primitives (importing `Branded`/`brand` from `@repo/shared`), readonly type + factory function, and colocated test.
5. **Application** -- create the port interface in `ports/`, the use case directory with `{verb}-{noun}-use-case.ts` and colocated test.
6. **Infrastructure** -- create `in-memory-*.ts` adapter in `adapters/`.
7. **Update barrel exports** -- add re-exports to `index.ts` at each layer.
8. **Run `npm run ci`** to verify everything passes.

## File patterns (reference the greeting sample in apps/example)

### Domain entity (`apps/<name>/src/domain/{feature}/{feature}.ts`)

```typescript
import type { FeatureId } from '../primitives/index.js';

export type Feature = Readonly<{
  id: FeatureId;
  // fields...
}>;

export function createFeature(id: FeatureId /* params */): Feature {
  // validation
  return { id /* fields */ };
}
```

### Domain primitives (`apps/<name>/src/domain/primitives/index.ts`)

Add branded types (foundation imported from `@repo/shared`):

```typescript
import { type Branded, brand } from '@repo/shared';

export type FeatureId = Branded<string, 'FeatureId'>;
export const FeatureId = (value: string): FeatureId => brand<string, 'FeatureId'>(value);
```

### Port (`apps/<name>/src/application/ports/{feature}-repository.ts`)

```typescript
import type { Feature } from '../../domain/{feature}/{feature}.js';
import type { FeatureId } from '../../domain/primitives/index.js';

export interface FeatureRepository {
  save(entity: Feature): Promise<void>;
  findById(id: FeatureId): Promise<Feature | undefined>;
}
```

### Use case (`apps/<name>/src/application/{verb}-{noun}/{verb}-{noun}-use-case.ts`)

```typescript
import { createFeature } from '../../domain/{feature}/{feature}.js';
import type { FeatureId } from '../../domain/primitives/index.js';
import type { FeatureRepository } from '../ports/{feature}-repository.js';

export type VerbNounCommand = Readonly<{ id: FeatureId /* fields */ }>;

export async function verbNoun(
  command: VerbNounCommand,
  repository: FeatureRepository,
): Promise<void> {
  const entity = createFeature(command.id /* args */);
  await repository.save(entity);
}
```

### In-memory adapter (`apps/<name>/src/infrastructure/adapters/in-memory-{feature}-repository.ts`)

```typescript
import type { Feature } from '../../domain/{feature}/{feature}.js';
import type { FeatureId } from '../../domain/primitives/index.js';
import type { FeatureRepository } from '../../application/ports/{feature}-repository.js';

export class InMemoryFeatureRepository implements FeatureRepository {
  private readonly store = new Map<string, Feature>();

  async save(entity: Feature): Promise<void> {
    this.store.set(entity.id, entity);
  }

  async findById(id: FeatureId): Promise<Feature | undefined> {
    return this.store.get(id);
  }
}
```

### Tests

- Domain test: test factory validation, field mapping, edge cases
- Use case test: use `InMemoryFeatureRepository`, test happy path + error propagation
- Pattern: `describe` / `it` / `expect` from Vitest

## Rules

- Domain code has zero external dependencies (except `@repo/shared`)
- All IDs use branded primitives (foundation from `@repo/shared`, app-specific in `apps/<name>/src/domain/primitives/`)
- Use `Readonly<{...}>` for all data types
- No `any`, no `// eslint-disable`
- Tests must be thorough enough to pass coverage gates (90% domain/application, 80% infrastructure)
- Do not modify ESLint, Vitest, or dependency-cruiser configs to weaken rules or lower thresholds
- Run `npm run ci` at the end -- do not skip any gate
