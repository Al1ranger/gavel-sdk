import { integer, requireThat } from '../api/types.ts';
import { evaluateConsensus, type ConsensusPolicy } from '../oracle/consensus.ts';
import type { JudgeDecision } from '../oracle/validator.ts';
export type SimulationRound = { timestamp: number; votes: JudgeDecision[]; actualOutcome?: string; probabilityBps?: number };
export type SimulationInput = { rounds: SimulationRound[]; policy: ConsensusPolicy };
/** Replay supplied scenarios; never invent expected accuracy for future markets. */
export function simulateMarket(input: SimulationInput) {
  requireThat(input.rounds.length > 0 && input.rounds.length <= 100000, 'SIMULATION_SIZE', 'Provide 1-100000 rounds.');
  let previous = -1;
  const rounds = input.rounds.map(round => {
    integer(round.timestamp, 0, Number.MAX_SAFE_INTEGER, 'timestamp');
    requireThat(round.timestamp > previous, 'SIMULATION_ORDER', 'Round timestamps must increase.'); previous = round.timestamp;
    if (round.probabilityBps !== undefined) integer(round.probabilityBps, 0, 10000, 'probabilityBps');
    return { timestamp: round.timestamp, probabilityBps: round.probabilityBps ?? null, ...evaluateConsensus(round.votes, input.policy), actualOutcome: round.actualOutcome ?? null };
  });
  const labelled = rounds.filter(r => r.actualOutcome !== null);
  return { mode: 'OFFCHAIN_REPLAY' as const, rounds, roundsRun: rounds.length,
    observedAccuracy: labelled.length ? labelled.filter(r => r.reached && r.decision === r.actualOutcome).length / labelled.length : null,
    consensusStability: rounds.filter(r => r.reached).length / rounds.length,
    predictionGuarantee: false, note: 'Accuracy is measured only on supplied labelled scenarios. Synthetic judges do not establish real validator independence.' };
}
