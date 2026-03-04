import { type Branded, brand } from '@repo/shared';

export { type Branded, brand, unbrand } from '@repo/shared';

// -- Example domain primitives (replace with your own) --

export type UserId = Branded<string, 'UserId'>;
export const UserId = (value: string): UserId => brand<string, 'UserId'>(value);

export type GreetingId = Branded<string, 'GreetingId'>;
export const GreetingId = (value: string): GreetingId => brand<string, 'GreetingId'>(value);
