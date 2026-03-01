declare const __brand: unique symbol;

export type Branded<T, B extends string> = T & { readonly [__brand]: B };

export function brand<T, B extends string>(value: T): Branded<T, B> {
  return value as Branded<T, B>;
}

export function unbrand<T>(branded: Branded<T, string>): T {
  return branded as T;
}

// -- Example domain primitives (replace with your own) --

export type UserId = Branded<string, 'UserId'>;
export const UserId = (value: string): UserId => brand<string, 'UserId'>(value);

export type GreetingId = Branded<string, 'GreetingId'>;
export const GreetingId = (value: string): GreetingId => brand<string, 'GreetingId'>(value);
