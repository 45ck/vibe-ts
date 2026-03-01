import { createGreeting } from '../../domain/greeting/greeting.js';
import type { GreetingId, UserId } from '../../domain/primitives/index.js';
import type { GreetingRepository } from '../ports/greeting-repository.js';

export type GreetCommand = Readonly<{
  id: GreetingId;
  userId: UserId;
  name: string;
}>;

export async function greet(command: GreetCommand, repository: GreetingRepository): Promise<void> {
  const greeting = createGreeting(command.id, command.userId, command.name);
  await repository.save(greeting);
}
