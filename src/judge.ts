/**
 * Judge interfaces and consensus primitives.
 *
 * On GenLayer the judges are the validators themselves: each independently
 * reruns the investigation inside the contract's nondeterministic block, and
 * the protocol compares results. Nothing in this file adjudicates in
 * production — it exists so applications can type against a judge, and so
 * tests can run the full case lifecycle offline without a node.
 */

import type { Verdict } from './client.ts';
import type { CaseRecord } from './case.ts';
import type { CourtSpec } from './court.ts';
import { tierThresholdBps } from './court.ts';

/** Everything a judge is allowed to see. Deliberately excludes party identity
 * beyond the record itself, so a judge cannot be prompted to favour a party. */
export type JudgeCaseData = {
  court: Pick<CourtSpec, 'id' | 'name' | 'jurisdiction' | 'rules'>;
  case: CaseRecord['case'];
  evidence: CaseRecord['evidence'];
  arguments: CaseRecord['arguments'];
  tier: number;
  /** Present on appeal. A higher court re-decides; it does not defer. */
  priorVerdict?: Verdict | null;
};

export interface GenLayerJudge {
  readonly id: string;
  evaluate(caseData: JudgeCaseData): Promise<Verdict>;
}

/** One validator's ruling, as returned by the protocol. */
export type JudgeVote = { judgeId: string; verdict: Verdict };

/**
 * Consensus is decided on stable fields only. Two validators writing different
 * prose about the same outcome agree; the protocol must not treat wording
 * differences as disagreement or no case would ever finalize.
 */
export function stableVerdictKey(verdict: Verdict): string {
  return `${verdict.status}:${verdict.winnerIndex}:${verdict.outcomeId}`;
}

export function verdictsAgree(left: Verdict, right: Verdict): boolean {
  return stableVerdictKey(left) === stableVerdictKey(right);
}

export type ConsensusOutcome = {
  reached: boolean;
  /** Winning verdict, or null when no group cleared the threshold. */
  verdict: Verdict | null;
  agreementBps: number;
  thresholdBps: number;
  tally: Array<{ key: string; votes: number }>;
};

/**
 * Tally validator votes against the tier's threshold. Mirrors what GenLayer
 * enforces on-chain; exposed so a client can show why a case did or did not
 * settle without re-deriving the rule.
 */
export function tallyConsensus(votes: JudgeVote[], tier: number): ConsensusOutcome {
  const thresholdBps = tierThresholdBps(tier);
  if (!votes.length) return { agreementBps: 0, reached: false, tally: [], thresholdBps, verdict: null };

  const groups = new Map<string, JudgeVote[]>();
  for (const vote of votes) {
    const key = stableVerdictKey(vote.verdict);
    const group = groups.get(key);
    if (group) group.push(vote); else groups.set(key, [vote]);
  }

  const tally = [...groups.entries()].map(([key, group]) => ({ key, votes: group.length })).sort((left, right) => right.votes - left.votes);
  const [leading] = tally;
  const agreementBps = Math.floor((leading.votes * 10000) / votes.length);
  const reached = agreementBps >= thresholdBps;
  return {
    agreementBps,
    reached,
    tally,
    thresholdBps,
    verdict: reached ? groups.get(leading.key)![0].verdict : null,
  };
}

/**
 * Offline judge for tests and local development.
 *
 * It decides by counting admissible evidence weight per outcome, which is
 * deterministic and therefore reproducible across runs. It is NOT a model and
 * must never stand in for validator adjudication in production.
 */
export function createMockJudge(id: string): GenLayerJudge {
  return {
    id,
    async evaluate(caseData: JudgeCaseData): Promise<Verdict> {
      const approved = caseData.case.approvedSources;
      const weights = new Map<string, number>();

      // Party arguments only direct attention; the weight comes from the
      // evidence they cite, never from the assertion itself.
      for (const argument of caseData.arguments) {
        for (const index of argument.citesEvidence) {
          const record = caseData.evidence[index];
          if (!record) continue;
          const admissible = record.type !== 'URL' && record.type !== 'API' || approved.includes(record.source);
          if (!admissible) continue;
          weights.set(argument.claimsOutcome, (weights.get(argument.claimsOutcome) ?? 0) + record.credibilityScore);
        }
      }

      const ranked = [...weights.entries()].sort((left, right) => right[1] - left[1]);
      const [leading, runnerUp] = ranked;

      // Insufficient or tied record resolves to UNRESOLVED rather than guessing.
      const decisive = leading && leading[1] > 0 && (!runnerUp || leading[1] > runnerUp[1]);
      const winner = decisive ? caseData.case.outcomes.find(outcome => outcome.id === leading[0]) : undefined;

      const base = {
        conflicts: runnerUp && leading && runnerUp[1] === leading[1]
          ? [{ description: 'Evidence weight tied between outcomes.', sources: approved }]
          : [],
        facts: [],
        marketId: caseData.case.marketId,
        reasoningSummary: decisive
          ? `Admissible evidence weight favours ${leading[0]}.`
          : 'Admissible evidence was insufficient or evenly split.',
        rulesApplied: [],
        specHash: caseData.case.caseHash,
      };

      return winner
        ? { ...base, outcomeId: winner.id, reasonCode: 'EVIDENCE_WEIGHT', status: 'RESOLVED', winnerIndex: winner.index }
        : { ...base, outcomeId: 'UNRESOLVED', reasonCode: 'INSUFFICIENT_EVIDENCE', status: 'UNRESOLVED', winnerIndex: -1 };
    },
  };
}
