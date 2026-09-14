import { identifier, integer, requireThat } from '../api/types.ts';
export type ReputationObservation = { id: string; validatorId: string; correct: boolean; disputed: boolean; evidenceQualityBps: number };
/** Local statistics from externally authenticated ground truth, not Sybil resistance. */
export class ValidatorReputation {
  private readonly records = new Map<string, ReputationObservation>();
  constructor(private readonly authenticate: (record: ReputationObservation) => boolean) {}
  record(observation: ReputationObservation): void {
    identifier(observation.id); identifier(observation.validatorId); integer(observation.evidenceQualityBps, 0, 10000, 'evidenceQualityBps');
    requireThat(typeof observation.correct === 'boolean' && typeof observation.disputed === 'boolean' && this.authenticate(structuredClone(observation)), 'UNAUTHENTICATED_HISTORY', 'Reputation needs authenticated outcome history.');
    requireThat(!this.records.has(observation.id), 'REPLAYED_HISTORY', 'Observation already recorded.');
    this.records.set(observation.id, structuredClone(observation));
  }
  rank() {
    const ids = new Set([...this.records.values()].map(r => r.validatorId));
    return [...ids].map(id => {
      const rows = [...this.records.values()].filter(r => r.validatorId === id);
      const accuracyBps = Math.floor(rows.filter(r => r.correct).length * 10000 / rows.length);
      const disputeRateBps = Math.floor(rows.filter(r => r.disputed).length * 10000 / rows.length);
      const evidenceQualityBps = Math.floor(rows.reduce((s, r) => s + r.evidenceQualityBps, 0) / rows.length);
      return { id, observations: rows.length, accuracyBps, disputeRateBps, evidenceQualityBps, trustScoreBps: Math.floor((accuracyBps + evidenceQualityBps + 10000 - disputeRateBps) / 3) };
    }).sort((a, b) => b.trustScoreBps - a.trustScoreBps || a.id.localeCompare(b.id));
  }
}
