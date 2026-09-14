import { integer, requireThat } from '../api/types.ts';
import { canonicalJSON } from '../evidence/normalizer.ts';
import { confidenceBps } from './confidence.ts';
import type { JudgeDecision } from './validator.ts';

export type ConsensusPolicy = { quorumBps: number; minimumConfidenceBps: number; eligibleJudgeIds: string[]; requiredCriteria: string[] };
export type ConsensusReport = { reached: boolean; decision: string; agreementBps: number; voters: string[]; eligible: number; authoritative: false };
/** Off-chain diagnostic quorum; not a replacement for GenLayer consensus. */
export function evaluateConsensus(votes: JudgeDecision[], policy: ConsensusPolicy): ConsensusReport {
  integer(policy.quorumBps, 5001, 10000, 'quorumBps'); confidenceBps(policy.minimumConfidenceBps);
  requireThat(policy.eligibleJudgeIds.length > 0 && new Set(policy.eligibleJudgeIds).size === policy.eligibleJudgeIds.length, 'INVALID_ELECTORATE', 'Electorate must be nonempty and unique.');
  requireThat(new Set(votes.map(v => v.judgeId)).size === votes.length && votes.every(v => policy.eligibleJudgeIds.includes(v.judgeId)), 'DUPLICATE_VOTE', 'Duplicate or unregistered judge vote.');
  const groups = new Map<string, JudgeDecision[]>();
  for (const vote of votes) {
    confidenceBps(vote.confidenceBps);
    if (vote.confidenceBps < policy.minimumConfidenceBps || vote.decision === 'UNRESOLVED' || !policy.requiredCriteria.every(k => vote.criteria[k] === true)) continue;
    const key = canonicalJSON({ decision: vote.decision, criteria: vote.criteria, evidence: [...vote.evidence].sort() });
    groups.set(key, [...(groups.get(key) ?? []), vote]);
  }
  const winner = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  // Missing, failed and abstaining judges remain in the denominator.
  const reached = winner.length * 10000 >= policy.quorumBps * policy.eligibleJudgeIds.length;
  return { reached, decision: reached ? winner[0].decision : 'UNRESOLVED', agreementBps: Math.floor(winner.length * 10000 / policy.eligibleJudgeIds.length), voters: winner.map(v => v.judgeId), eligible: policy.eligibleJudgeIds.length, authoritative: false };
}
