import { requireThat, identifier } from '../api/types.ts';
import { confidenceBps } from './confidence.ts';
import type { EvidenceClaim } from '../evidence/evidenceFetcher.ts';

export const JUDGE_ROLES = ['researcher', 'critic', 'forecaster', 'auditor'] as const;
export type JudgeRole = typeof JUDGE_ROLES[number];
export type JudgeDecision = { judgeId: string; decision: string; confidenceBps: number; evidence: string[]; reasoningHash: string; criteria: Record<string, boolean> };
export type JudgeContext = { question: string; outcomes: string[]; evidence: EvidenceClaim[]; requiredCriteria: string[] };
export function validateJudge(value: unknown, expectedId: string, context: JudgeContext): JudgeDecision {
  identifier(expectedId);
  requireThat(value && typeof value === 'object', 'JUDGE_SCHEMA', 'Judge response must be an object.');
  const v = value as JudgeDecision;
  requireThat(v.judgeId === expectedId && [...context.outcomes, 'UNRESOLVED'].includes(v.decision), 'JUDGE_IDENTITY', 'Judge identity or outcome mismatch.');
  confidenceBps(v.confidenceBps);
  requireThat(Array.isArray(v.evidence) && v.evidence.length > 0 && new Set(v.evidence).size === v.evidence.length && v.evidence.every(id => context.evidence.some(e => e.id === id)), 'JUDGE_CITATION', 'Judge must cite acquired evidence.');
  requireThat(typeof v.reasoningHash === 'string' && /^0x[0-9a-f]{64}$/.test(v.reasoningHash), 'JUDGE_REASONING', 'Invalid reasoning commitment.');
  requireThat(v.criteria && typeof v.criteria === 'object' && !Array.isArray(v.criteria) && Object.values(v.criteria).every(v => typeof v === 'boolean') && context.requiredCriteria.every(key => Object.hasOwn(v.criteria, key)), 'JUDGE_CRITERIA', 'Required criterion decisions are missing or malformed.');
  return structuredClone(v);
}
