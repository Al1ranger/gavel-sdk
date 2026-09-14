import { requireThat, integer } from '../api/types.ts';
import { contentHash } from './normalizer.ts';
import { provenanceId } from './provenance.ts';
import { publicEvidenceUrl } from '../contractEvidence.ts';
import type { EvidenceClaim } from './evidenceFetcher.ts';

export type EvidenceVerificationPolicy = { now: number; maxAgeMs: number; allowedOrigins: string[]; maxContentBytes?: number };
/** Verifies integrity/age only. Authenticate the collector or re-fetch for truth claims. */
export function verifyEvidence(claim: EvidenceClaim, policy: EvidenceVerificationPolicy): true {
  integer(policy.now, 0, Number.MAX_SAFE_INTEGER, 'now'); integer(policy.maxAgeMs, 0, Number.MAX_SAFE_INTEGER, 'maxAgeMs');
  requireThat(claim && typeof claim.content === 'string', 'INVALID_EVIDENCE', 'Malformed evidence.');
  integer(claim.timestamp, 0, policy.now, 'timestamp');
  integer(claim.credibilityScore, 0, 10000, 'credibilityScore');
  requireThat(policy.now - claim.timestamp <= policy.maxAgeMs, 'STALE_EVIDENCE', 'Evidence has expired.');
  const url = publicEvidenceUrl(claim.source);
  requireThat(policy.allowedOrigins.includes(new URL(url).origin), 'SOURCE_DENIED', 'Evidence origin is not approved.');
  requireThat(Buffer.byteLength(claim.content) <= (policy.maxContentBytes ?? 1048576), 'EVIDENCE_SIZE', 'Evidence exceeds size limit.');
  requireThat(contentHash(claim.content) === claim.contentHash, 'EVIDENCE_CHANGED', 'Evidence content hash mismatch.');
  requireThat(claim.provenance?.source === claim.source && claim.provenance.fetchedAt === claim.timestamp && claim.provenance.contentHash === claim.contentHash && claim.provenance.method === 'HTTPS_GET' && provenanceId(claim.provenance) === claim.id, 'PROVENANCE_MISMATCH', 'Evidence provenance mismatch.');
  requireThat(Array.isArray(claim.relatedClaims) && new Set(claim.relatedClaims).size === claim.relatedClaims.length && claim.relatedClaims.every(id => typeof id === 'string' && id !== claim.id), 'INVALID_RELATIONS', 'Invalid evidence relations.');
  return true;
}
