import { integer, requireThat } from '../api/types.ts';
import { appendEvent, type LifecycleEvent } from './events.ts';

export type MarketPhase = 'OPEN' | 'PROPOSED' | 'CHALLENGED' | 'FINALIZED';
export type ResolutionProposal = { decision: string; evidenceHash: string; proofId: string; validatorIds: string[] };
export type LifecycleConfig = { id: string; outcomes: string[]; closesAt: number; challengeMs: number; now?: () => number; verifyProposal: (proposal: ResolutionProposal, appeal: boolean) => boolean };
/** In-memory application state machine. No funds, network finality or durable storage implied. */
export class MarketLifecycle {
  private phase: MarketPhase = 'OPEN';
  private proposal: ResolutionProposal | null = null;
  private deadline = 0;
  private readonly events: LifecycleEvent[] = [];
  private readonly proofs = new Set<string>();
  private readonly config: LifecycleConfig;
  constructor(config: LifecycleConfig) {
    requireThat(config.outcomes.length >= 2 && new Set(config.outcomes).size === config.outcomes.length && config.outcomes.every(v => typeof v === 'string' && v.length > 0 && v !== 'UNRESOLVED'), 'OUTCOMES', 'Provide distinct nonempty outcomes.');
    integer(config.closesAt, 0, Number.MAX_SAFE_INTEGER, 'closesAt'); integer(config.challengeMs, 1, 604800000, 'challengeMs');
    this.config = { ...config, outcomes: [...config.outcomes] };
  }
  private now(): number {
    const now = integer((this.config.now ?? Date.now)(), 0, Number.MAX_SAFE_INTEGER, 'now');
    requireThat(now >= (this.events.at(-1)?.timestamp ?? 0), 'CLOCK_REGRESSION', 'Clock moved backwards.'); return now;
  }
  private accept(proposal: ResolutionProposal, appeal: boolean): ResolutionProposal {
    const copy = structuredClone(proposal);
    requireThat(this.config.outcomes.includes(copy.decision) && /^0x[0-9a-f]{64}$/.test(copy.evidenceHash) && typeof copy.proofId === 'string' && copy.proofId.length > 0 && Array.isArray(copy.validatorIds) && copy.validatorIds.length >= 2 && new Set(copy.validatorIds).size === copy.validatorIds.length, 'PROPOSAL', 'Malformed proposal.');
    requireThat(!this.proofs.has(copy.proofId), 'PROOF_REPLAY', 'Resolution proof already used.');
    requireThat(this.config.verifyProposal(structuredClone(copy), appeal) === true, 'UNVERIFIED_PROPOSAL', 'Application must authenticate the resolution proof.');
    return copy;
  }
  resolve(proposal: ResolutionProposal): void {
    const now = this.now();
    requireThat(this.phase === 'OPEN' && now >= this.config.closesAt, 'PHASE', 'Resolution not open.');
    const copy = this.accept(proposal, false);
    this.proposal = copy; this.proofs.add(copy.proofId); this.phase = 'PROPOSED'; this.deadline = now + this.config.challengeMs;
    this.events.push(appendEvent(this.events, 'PROPOSED', now, copy));
  }
  challenge(input: { reason: string; evidence: string[] }): void {
    const now = this.now();
    requireThat(this.phase === 'PROPOSED' && now < this.deadline, 'PHASE', 'Challenge window is closed.');
    requireThat(typeof input.reason === 'string' && input.reason.trim().length >= 10 && input.reason.length <= 2000 && Array.isArray(input.evidence) && input.evidence.length > 0 && input.evidence.every(hash => /^0x[0-9a-f]{64}$/.test(hash)), 'CHALLENGE', 'Provide a reason and evidence commitments.');
    this.phase = 'CHALLENGED'; this.events.push(appendEvent(this.events, 'CHALLENGED', now, input));
  }
  appeal(proposal: ResolutionProposal): void {
    const now = this.now(); requireThat(this.phase === 'CHALLENGED', 'PHASE', 'Market is not challenged.');
    const copy = this.accept(proposal, true);
    requireThat(copy.validatorIds.every(id => !this.proposal!.validatorIds.includes(id)), 'APPEAL_INDEPENDENCE', 'Appeal requires a disjoint validator panel.');
    this.proposal = copy; this.proofs.add(copy.proofId); this.phase = 'PROPOSED'; this.deadline = now + this.config.challengeMs;
    this.events.push(appendEvent(this.events, 'APPEALED', now, copy));
  }
  finalize(): ResolutionProposal {
    const now = this.now(); requireThat(this.phase === 'PROPOSED' && now >= this.deadline, 'PHASE', 'Finalization requires an expired, unchallenged window.');
    this.phase = 'FINALIZED'; this.events.push(appendEvent(this.events, 'FINALIZED', now, this.proposal));
    return structuredClone(this.proposal!);
  }
  snapshot() { return { id: this.config.id, phase: this.phase, deadline: this.deadline, proposal: structuredClone(this.proposal), events: structuredClone(this.events), transfersExecuted: false as const }; }
}
