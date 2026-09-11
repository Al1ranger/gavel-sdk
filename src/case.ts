/**
 * Case definitions and lifecycle.
 *
 * A case is one prediction-market dispute in front of one court. Validation
 * mirrors `contracts/gavel_court.py::open_case`; the phase machine mirrors the
 * deadline checks the contract enforces on every write.
 */

import { normalizeIdentifier, normalizeSources, type CourtSpec } from './court.ts';
import type { Outcome, Verdict } from './client.ts';
import type { EvidenceRecord } from './evidence.ts';

/**
 * Case lifecycle. A case moves forward only. APPEALED is transient: granting an
 * appeal returns the case to EVIDENCE_PHASE one tier higher, which is why a
 * successful appeal clears the live verdict instead of replacing it.
 */
export const CASE_STATUSES = [
  'OPEN',
  'EVIDENCE_PHASE',
  'ARGUMENT_PHASE',
  'UNDER_REVIEW',
  'VERDICT_PENDING',
  'RESOLVED',
  'APPEALED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export type ArgumentRecord = {
  index: number;
  party: string;
  claimsOutcome: string;
  statement: string;
  citesEvidence: number[];
  submitter: string;
  timestamp: number;
  hash: `0x${string}`;
};

export type CaseSpec = {
  id: string;
  courtId: string;
  marketId: string;
  question: string;
  plaintiff: string;
  defendant: string;
  outcomes: Outcome[];
  resolutionRules: string[];
  /** Optional narrowing of the court's source list. Never a widening. */
  approvedSources?: string[];
  evidenceDeadline: number;
  argumentDeadline: number;
};

export type CaseState = {
  id: string;
  courtId: string;
  marketId: string;
  question: string;
  plaintiff: string;
  defendant: string;
  outcomes: Outcome[];
  resolutionRules: string[];
  approvedSources: string[];
  status: CaseStatus;
  tier: number;
  appealCount: number;
  createdAt: number;
  evidenceDeadline: number;
  argumentDeadline: number;
  verdictFinalizedAt: number;
  caseHash: `0x${string}`;
};

export type CaseRecord = {
  case: CaseState;
  filer: string;
  evidence: EvidenceRecord[];
  arguments: ArgumentRecord[];
  verdict: Verdict | null;
  verdictHistory: Verdict[];
};

export type ArgumentSubmission = {
  party: string;
  claimsOutcome: string;
  statement: string;
  citesEvidence?: number[];
};

/** Which write the contract will currently accept for a case. */
export function currentPhase(state: CaseState, now = Math.floor(Date.now() / 1000)): CaseStatus {
  if (state.status === 'RESOLVED' || state.status === 'APPEALED') return state.status;
  if (now <= state.evidenceDeadline) return 'EVIDENCE_PHASE';
  if (now <= state.argumentDeadline) return 'ARGUMENT_PHASE';
  return 'UNDER_REVIEW';
}

export function canSubmitEvidence(state: CaseState, now?: number): boolean {
  return currentPhase(state, now) === 'EVIDENCE_PHASE';
}

export function canSubmitArgument(state: CaseState, now?: number): boolean {
  return currentPhase(state, now) === 'ARGUMENT_PHASE';
}

export function canRequestVerdict(state: CaseState, now?: number): boolean {
  return currentPhase(state, now) === 'UNDER_REVIEW';
}

/** Appeals are open only on a resolved case, inside the court's appeal window. */
export function canAppeal(state: CaseState, court: CourtSpec, now = Math.floor(Date.now() / 1000)): boolean {
  if (state.status !== 'RESOLVED') return false;
  if (state.tier >= court.maxTier) return false;
  return now <= state.verdictFinalizedAt + court.appealPeriodSeconds;
}

export function normalizeCaseSpec(input: CaseSpec): CaseSpec {
  if (!input || typeof input !== 'object') throw new Error('A CaseSpec object is required.');
  const id = normalizeIdentifier(input.id, 'Case ID');
  const courtId = normalizeIdentifier(input.courtId, 'Court ID');
  const marketId = normalizeIdentifier(input.marketId, 'Market ID');

  const question = String(input.question ?? '').trim();
  if (question.length < 10 || question.length > 500) throw new Error('Question must contain 10-500 characters.');

  const plaintiff = String(input.plaintiff ?? '').trim();
  const defendant = String(input.defendant ?? '').trim();
  if (!plaintiff || !defendant) throw new Error('A case needs both a plaintiff and a defendant.');
  if (plaintiff === defendant) throw new Error('Plaintiff and defendant must differ.');

  if (!Array.isArray(input.outcomes) || input.outcomes.length < 2 || input.outcomes.length > 16) throw new Error('Register 2-16 outcomes.');
  const outcomes = input.outcomes.map((item, index) => {
    const outcomeId = String(item.id ?? '').trim().toUpperCase();
    const label = String(item.label ?? '').trim();
    if (item.index !== index || !outcomeId || !label || outcomeId === 'UNRESOLVED') throw new Error('Outcomes need contiguous indexes and labels. UNRESOLVED is reserved.');
    return { id: outcomeId, index, label };
  });
  if (new Set(outcomes.map(item => item.id)).size !== outcomes.length) throw new Error('Outcome IDs must be unique.');

  if (!Array.isArray(input.resolutionRules) || !input.resolutionRules.length || input.resolutionRules.length > 32) throw new Error('Register 1-32 resolution rules.');
  const resolutionRules = input.resolutionRules.map(rule => String(rule).trim());
  if (resolutionRules.some(rule => !rule)) throw new Error('Rules cannot be empty.');

  const evidenceDeadline = Number(input.evidenceDeadline);
  const argumentDeadline = Number(input.argumentDeadline);
  if (!Number.isSafeInteger(evidenceDeadline) || evidenceDeadline <= 0) throw new Error('Evidence deadline must be positive Unix seconds.');
  if (!Number.isSafeInteger(argumentDeadline) || argumentDeadline <= evidenceDeadline) throw new Error('Argument deadline must fall after the evidence deadline.');

  const spec: CaseSpec = { argumentDeadline, courtId, defendant, evidenceDeadline, id, marketId, outcomes, plaintiff, question, resolutionRules };
  if (input.approvedSources !== undefined) spec.approvedSources = normalizeSources(input.approvedSources);
  return spec;
}

export function normalizeArgument(input: ArgumentSubmission, state: Pick<CaseState, 'plaintiff' | 'defendant' | 'outcomes'>): ArgumentSubmission {
  if (!input || typeof input !== 'object') throw new Error('An ArgumentSubmission object is required.');
  const party = String(input.party ?? '').trim();
  if (party !== state.plaintiff && party !== state.defendant) throw new Error('Only a party on the case may argue.');

  const claimsOutcome = String(input.claimsOutcome ?? '').trim().toUpperCase();
  if (!state.outcomes.some(outcome => outcome.id === claimsOutcome)) throw new Error('An argument must claim a registered outcome.');

  const statement = String(input.statement ?? '').trim();
  if (statement.length < 10 || statement.length > 4000) throw new Error('Argument statement must contain 10-4000 characters.');

  const cites = input.citesEvidence ?? [];
  if (!Array.isArray(cites) || cites.length > 32) throw new Error('Cite at most 32 evidence records.');
  const citesEvidence = [...new Set(cites.map(index => {
    const value = Number(index);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Evidence citations must be non-negative indexes.');
    return value;
  }))].sort((left, right) => left - right);

  return { citesEvidence, claimsOutcome, party, statement };
}
