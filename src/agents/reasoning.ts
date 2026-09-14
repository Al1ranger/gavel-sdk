import { contentHash } from '../evidence/normalizer.ts';
/** Commit a concise public rationale. Do not request or store hidden chain-of-thought. */
export function reasoningHash(publicRationale: string): string { return contentHash(publicRationale); }
