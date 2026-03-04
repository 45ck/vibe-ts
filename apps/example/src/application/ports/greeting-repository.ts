import type { Greeting } from '../../domain/greeting/greeting.js';
import type { GreetingId } from '../../domain/primitives/index.js';

export interface GreetingRepository {
  save(greeting: Greeting): Promise<void>;
  findById(id: GreetingId): Promise<Greeting | undefined>;
}
