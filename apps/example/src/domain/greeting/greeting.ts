import type { GreetingId, UserId } from '../primitives/index.js';

export type Greeting = Readonly<{
  id: GreetingId;
  userId: UserId;
  message: string;
  createdAt: Date;
}>;

export function createGreeting(id: GreetingId, userId: UserId, name: string): Greeting {
  if (name.trim().length === 0) {
    throw new Error('Name must not be empty.');
  }
  return {
    id,
    userId,
    message: `Hello, ${name.trim()}!`,
    createdAt: new Date(),
  };
}
