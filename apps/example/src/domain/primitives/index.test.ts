import { describe, it, expect } from 'vitest';
import { unbrand, UserId, GreetingId } from './index.js';

describe('app-specific branded primitives', () => {
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
