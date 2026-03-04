import type { Greeting } from '../../domain/greeting/greeting.js';
import type { GreetingId } from '../../domain/primitives/index.js';
import type { GreetingRepository } from '../../application/ports/greeting-repository.js';

export class InMemoryGreetingRepository implements GreetingRepository {
  private readonly store = new Map<string, Greeting>();

  async save(greeting: Greeting): Promise<void> {
    this.store.set(greeting.id, greeting);
  }

  async findById(id: GreetingId): Promise<Greeting | undefined> {
    return this.store.get(id);
  }
}
