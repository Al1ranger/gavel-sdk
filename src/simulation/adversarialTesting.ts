import { evaluateConsensus, type ConsensusPolicy } from '../oracle/consensus.ts';
import type { JudgeDecision } from '../oracle/validator.ts';
/** Deterministic quorum attacks against a caller-supplied fixture. */
export function adversarialScenarios(votes: JudgeDecision[], policy: ConsensusPolicy) {
  const rejected = (action: () => unknown) => { try { action(); return false; } catch { return true; } };
  return {
    duplicateVoteRejected: votes.length ? rejected(() => evaluateConsensus([...votes, votes[0]], policy)) : null,
    missingVotesUnresolved: !evaluateConsensus([], policy).reached,
    lowConfidenceUnresolved: !evaluateConsensus(votes.map(v => ({ ...v, confidenceBps: 0 })), { ...policy, minimumConfidenceBps: Math.max(1, policy.minimumConfidenceBps) }).reached,
    mode: 'LOCAL_TEST' as const, securityCertified: false,
  };
}
