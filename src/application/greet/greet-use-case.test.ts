import { describe, it, expect } from 'vitest';
import { greet } from './greet-use-case.js';
import { GreetingId, UserId } from '../../domain/primitives/index.js';
import { InMemoryGreetingRepository } from '../../infrastructure/adapters/in-memory-greeting-repository.js';

describe('greet use case', () => {
  it('should save a greeting via the repository', async () => {
    const repository = new InMemoryGreetingRepository();
    const command = {
      id: GreetingId('g-1'),
      userId: UserId('u-1'),
      name: 'Alice',
    };

    await greet(command, repository);

    const saved = await repository.findById(command.id);
    expect(saved).toBeDefined();
    expect(saved?.message).toBe('Hello, Alice!');
    expect(saved?.userId).toBe(command.userId);
  });

  it('should propagate domain validation errors', async () => {
    const repository = new InMemoryGreetingRepository();
    const command = {
      id: GreetingId('g-2'),
      userId: UserId('u-1'),
      name: '',
    };

    await expect(greet(command, repository)).rejects.toThrow('Name must not be empty.');
  });
});
