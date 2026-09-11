/**
 * Evidence framework.
 *
 * Source contents remain untrusted throughout. The SDK never fetches a source
 * and passes the body to the contract — the contract fetches independently
 * inside its nondeterministic block so every validator sees the page itself
 * rather than whatever a submitter claims the page said.
 *
 * Credibility is scored deterministically and identically here and in
 * `contracts/gavel_court.py::_credibility_score`. No model ranks evidence.
 */

import type { MarketSpec, Verdict } from './client.ts';

export const EVIDENCE_TYPES = ['URL', 'CHAIN_PROOF', 'DOCUMENT', 'API', 'USER_STATEMENT'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/**
 * Base credibility by kind. A chain proof is self-verifying, so it outranks a
 * fetched page; an unverifiable party statement ranks lowest and can never
 * carry a verdict on its own.
 */
export const EVIDENCE_BASE_SCORE: Record<EvidenceType, number> = {
  API: 70,
  CHAIN_PROOF: 90,
  DOCUMENT: 45,
  URL: 60,
  USER_STATEMENT: 20,
};

export type EvidenceSubmission = {
  type: EvidenceType;
  source: string;
  /** Party-supplied context. Persisted verbatim, treated strictly as data. */
  description?: string;
};

export type EvidenceRecord = {
  index: number;
  type: EvidenceType;
  source: string;
  description: string;
  submitter: string;
  timestamp: number;
  credibilityScore: number;
  hash: `0x${string}`;
};

/**
 * Deterministic 0-100 score. Approved sources gain; unapproved URL and API
 * submissions are penalised hard because adjudication excludes them outright —
 * they stay on the record for auditability, not for influence.
 */
export function credibilityScore(type: EvidenceType, source: string, approvedSources: string[]): number {
  let score = EVIDENCE_BASE_SCORE[type];
  if (type === 'URL' || type === 'API') score += approvedSources.includes(source) ? 30 : -40;
  if (type === 'CHAIN_PROOF' && source.startsWith('0x')) score += 10;
  return Math.max(0, Math.min(100, score));
}

/** Evidence the court will actually weigh, in the contract's own order. */
export function admissibleEvidence(records: EvidenceRecord[], approvedSources: string[]): EvidenceRecord[] {
  return records.filter(record => record.type !== 'URL' && record.type !== 'API' || approvedSources.includes(record.source));
}

export function normalizeEvidence(input: EvidenceSubmission, approvedSources: string[]): EvidenceSubmission & { credibilityScore: number } {
  if (!input || typeof input !== 'object') throw new Error('An EvidenceSubmission object is required.');
  const type = String(input.type ?? '').trim().toUpperCase() as EvidenceType;
  if (!EVIDENCE_TYPES.includes(type)) throw new Error(`Evidence type must be one of ${EVIDENCE_TYPES.join(', ')}.`);

  const source = String(input.source ?? '').trim();
  if (!source || source.length > 2048) throw new Error('Evidence source must contain 1-2048 characters.');
  if (type === 'URL' || type === 'API') {
    let url: URL;
    try { url = new URL(source); } catch { throw new Error('URL and API evidence must cite a valid HTTPS URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('URL and API evidence must use HTTPS without credentials.');
  }

  const description = String(input.description ?? '').trim().slice(0, 2000);
  return { credibilityScore: credibilityScore(type, source, approvedSources), description, source, type };
}

/** Facts a finalized verdict drew from one source. */
export function evidenceForSource(verdict: Verdict | null, source: string) {
  return verdict?.facts.filter(fact => fact.source === source) ?? [];
}

export function validateEvidenceSources(spec: MarketSpec, sources: string[]): void {
  if (sources.some(source => !spec.approvedSources.includes(source))) throw new Error('Evidence references an unapproved source.');
}
