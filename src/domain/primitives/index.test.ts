import { describe, it, expect } from 'vitest';
import { brand, unbrand, UserId, GreetingId } from './index.js';

describe('branded primitives', () => {
  describe('brand / unbrand', () => {
    it('should round-trip a value through brand and unbrand', () => {
      const raw = 'test-value';
      const branded = brand<string, 'Test'>(raw);
      expect(unbrand(branded)).toBe(raw);
    });

    it('should preserve the underlying value', () => {
      const branded = brand<number, 'Count'>(42);
      expect(unbrand(branded)).toBe(42);
    });
  });

  describe('UserId', () => {
    it('should create a branded UserId', () => {
      const id = UserId('user-123');
      expect(unbrand(id)).toBe('user-123');
    });
  });

  describe('GreetingId', () => {
    it('should create a branded GreetingId', () => {
      const id = GreetingId('greeting-456');
      expect(unbrand(id)).toBe('greeting-456');
    });
  });
});
