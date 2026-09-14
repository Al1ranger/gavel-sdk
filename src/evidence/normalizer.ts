import { createHash } from 'node:crypto';
import { requireThat } from '../api/types.ts';

/** Gavel JSON v1: finite JSON numbers, sorted keys, no implicit coercion. */
export function canonicalJSON(value: unknown, depth = 0): string {
  requireThat(depth <= 32, 'JSON_DEPTH', 'JSON exceeds depth limit.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { requireThat(Number.isFinite(value), 'JSON_NUMBER', 'Nonfinite JSON number.'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${Array.from(value, item => canonicalJSON(item, depth + 1)).join(',')}]`;
  requireThat(value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'JSON_TYPE', 'Only plain JSON objects are supported.');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON((value as Record<string, unknown>)[key], depth + 1)}`).join(',')}}`;
}
export function contentHash(content: string): string { return `0x${createHash('sha256').update(content, 'utf8').digest('hex')}`; }
export function hashJSON(value: unknown): string { return contentHash(canonicalJSON(value)); }
export function normalizeContent(value: unknown): string { return canonicalJSON(value); }
