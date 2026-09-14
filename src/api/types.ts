export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export class GavelError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'GavelError'; }
}
export function requireThat(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new GavelError(code, message);
}
export function integer(value: number, min: number, max: number, name: string): number {
  requireThat(Number.isSafeInteger(value) && value >= min && value <= max, 'INVALID_INTEGER', `${name} must be an integer in ${min}..${max}.`);
  return value;
}
export function identifier(value: string): string {
  requireThat(typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value), 'INVALID_ID', 'Invalid identifier.');
  return value;
}
