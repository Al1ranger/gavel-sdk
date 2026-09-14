import { hashJSON } from './normalizer.ts';
import { identifier, integer } from '../api/types.ts';

export type Provenance = { collectorId: string; fetchedAt: number; source: string; contentHash: string; method: 'HTTPS_GET' };
export function provenanceId(value: Provenance): string {
  identifier(value.collectorId); integer(value.fetchedAt, 0, Number.MAX_SAFE_INTEGER, 'fetchedAt');
  return hashJSON(value);
}
