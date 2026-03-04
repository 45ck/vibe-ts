# Domain Layer

Zero external dependencies except `@repo/shared` -- no HTTP, DB, or framework imports.

## Conventions

- Foundation types (`Branded`, `brand`, `unbrand`, `DomainEvent`, `createDomainEvent`) come from `@repo/shared`
- App-specific identity types use branded primitives from `primitives/` (`UserId`, `GreetingId`)
- Entities and value objects are `Readonly<{...}>` types with factory functions
- Domain events via `createDomainEvent(type, payload)` from `events/` (re-exported from `@repo/shared`)
- Tests colocated as `*.test.ts` -- domain logic should be exhaustively tested
- Export everything through `index.ts` barrel

## Reference: greeting entity

- Type: `src/domain/greeting/greeting.ts` (readonly type + `createGreeting` factory)
- Primitives: `src/domain/primitives/index.ts` (branded `GreetingId`, `UserId` using `@repo/shared`)
- Events: `src/domain/events/domain-event.ts` (re-exports from `@repo/shared`)
