import { describe, it, expect } from 'vitest';
import { brand, unbrand } from './branded.js';

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
});
