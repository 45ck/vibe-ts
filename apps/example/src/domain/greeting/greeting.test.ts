import { describe, it, expect } from 'vitest';
import { createGreeting } from './greeting.js';
import { GreetingId, UserId } from '../primitives/index.js';

describe('createGreeting', () => {
  const id = GreetingId('g-1');
  const userId = UserId('u-1');

  it('should create a greeting with the correct message', () => {
    const greeting = createGreeting(id, userId, 'Alice');

    expect(greeting.id).toBe(id);
    expect(greeting.userId).toBe(userId);
    expect(greeting.message).toBe('Hello, Alice!');
    expect(greeting.createdAt).toBeInstanceOf(Date);
  });

  it('should trim whitespace from the name', () => {
    const greeting = createGreeting(id, userId, '  Bob  ');
    expect(greeting.message).toBe('Hello, Bob!');
  });

  it('should throw if the name is empty', () => {
    expect(() => createGreeting(id, userId, '')).toThrow('Name must not be empty.');
  });

  it('should throw if the name is only whitespace', () => {
    expect(() => createGreeting(id, userId, '   ')).toThrow('Name must not be empty.');
  });
});
