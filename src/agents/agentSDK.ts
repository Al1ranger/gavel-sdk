import { ContractEngine, type ContractPlanner } from '../core/contractEngine.ts';
import { fetchEvidence, type FetchEvidenceOptions } from '../evidence/evidenceFetcher.ts';
import { runJudgeNetwork, type JudgeAdapter } from '../oracle/judgeNetwork.ts';
import type { ConsensusPolicy } from '../oracle/consensus.ts';
import { simulateMarket, type SimulationInput } from '../simulation/simulator.ts';
import { scanContract } from '../security/contractAuditor.ts';
import { ValidatorReputation, type ReputationObservation } from '../oracle/reputation.ts';
import { requireThat } from '../api/types.ts';

export class AgentSDK extends ContractEngine {
  readonly security = { scan: scanContract };
  readonly validators: ValidatorReputation;
  constructor(config: { planner?: ContractPlanner; authenticateHistory?: (record: ReputationObservation) => boolean } = {}) {
    super(config.planner); this.validators = new ValidatorReputation(config.authenticateHistory ?? (() => false));
  }
  async judge(input: { question: string; outcomes: string[]; sources: string[]; agents: JudgeAdapter[]; evidence: FetchEvidenceOptions; policy: Omit<ConsensusPolicy, 'eligibleJudgeIds'>; timeoutMs?: number }) {
    requireThat(input.question.length >= 10 && input.sources.length > 0 && input.sources.length <= 8 && input.outcomes.length >= 2 && new Set(input.outcomes).size === input.outcomes.length, 'JUDGE_REQUEST', 'Provide a question, outcomes and 1-8 sources.');
    // Every adapter gets independently acquired source bodies, never another judge's answer.
    // A fixed observation time makes IDs comparable for identical fetched content.
    const now = (input.evidence.now ?? Date.now)();
    const agents = input.agents.map(agent => ({ ...agent, evaluate: async (_context: unknown, signal: AbortSignal) => {
      const evidence = await Promise.all(input.sources.map(url => fetchEvidence(url, { ...input.evidence, now: () => now })));
      return agent.evaluate({ question: input.question, outcomes: input.outcomes, requiredCriteria: input.policy.requiredCriteria, evidence }, signal);
    } }));
    const evidence = await Promise.all(input.sources.map(url => fetchEvidence(url, { ...input.evidence, now: () => now })));
    return runJudgeNetwork({ question: input.question, outcomes: input.outcomes, evidence, requiredCriteria: input.policy.requiredCriteria }, agents, input.policy, input.timeoutMs);
  }
  simulate(input: SimulationInput) { return simulateMarket(input); }
}
