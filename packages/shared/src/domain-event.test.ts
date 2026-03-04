import { describe, it, expect } from 'vitest';
import { createDomainEvent } from './domain-event.js';

describe('createDomainEvent', () => {
  it('should create a domain event with the correct type and payload', () => {
    const event = createDomainEvent('UserCreated', { userId: 'u-1' });

    expect(event.type).toBe('UserCreated');
    expect(event.payload).toEqual({ userId: 'u-1' });
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('should set occurredAt to the current time', () => {
    const before = new Date();
    const event = createDomainEvent('TestEvent', null);
    const after = new Date();

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
