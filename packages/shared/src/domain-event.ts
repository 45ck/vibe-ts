export type DomainEvent<T extends string = string, P = unknown> = Readonly<{
  type: T;
  occurredAt: Date;
  payload: P;
}>;

export function createDomainEvent<T extends string, P>(type: T, payload: P): DomainEvent<T, P> {
  return { type, occurredAt: new Date(), payload };
}
