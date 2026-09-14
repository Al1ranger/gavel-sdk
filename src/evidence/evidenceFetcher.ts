import { readApi } from '../api.ts';
import { publicEvidenceUrl } from '../contractEvidence.ts';
import { integer, requireThat } from '../api/types.ts';
import { contentHash, normalizeContent } from './normalizer.ts';
import { provenanceId, type Provenance } from './provenance.ts';

export type EvidenceClaim = { id: string; source: string; timestamp: number; content: string; contentHash: string; credibilityScore: number; relatedClaims: string[]; provenance: Provenance };
export type FetchEvidenceOptions = { allowedOrigins: string[]; collectorId: string; now?: () => number; maxBytes?: number; timeoutMs?: number; fetch?: typeof fetch; credibilityScore?: number };
/** Source credibility is operator policy, not a fact proven by hashing. */
export async function fetchEvidence(url: string, options: FetchEvidenceOptions): Promise<EvidenceClaim> {
  const source = publicEvidenceUrl(url);
  const value = await readApi({ url: source }, options);
  const content = normalizeContent(value);
  requireThat(content.length > 0, 'EMPTY_EVIDENCE', 'Empty normalized evidence.');
  const timestamp = integer((options.now ?? Date.now)(), 0, Number.MAX_SAFE_INTEGER, 'timestamp');
  const hash = contentHash(content);
  const provenance: Provenance = { collectorId: options.collectorId, fetchedAt: timestamp, source, contentHash: hash, method: 'HTTPS_GET' };
  return { id: provenanceId(provenance), source, timestamp, content, contentHash: hash,
    credibilityScore: integer(options.credibilityScore ?? 0, 0, 10000, 'credibilityScore'), relatedClaims: [], provenance };
}
