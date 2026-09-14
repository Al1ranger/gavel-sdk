import { integer, requireThat } from '../api/types.ts';
export type ProbabilityUpdate = { timestamp: number; probabilityBps: number; evidenceHash: string };
/** Local append-only forecast series. Does not settle the underlying event. */
export class ContinuousMarket {
  private readonly rows: ProbabilityUpdate[] = [];
  constructor(readonly intervalMs: number) { integer(intervalMs, 1, 86400000, 'intervalMs'); }
  updateOdds(update: ProbabilityUpdate): void {
    integer(update.timestamp, 0, Number.MAX_SAFE_INTEGER, 'timestamp'); integer(update.probabilityBps, 0, 10000, 'probabilityBps');
    requireThat(/^0x[0-9a-f]{64}$/.test(update.evidenceHash), 'EVIDENCE_HASH', 'Evidence commitment required.');
    requireThat(!this.rows.length || update.timestamp >= this.rows.at(-1)!.timestamp + this.intervalMs, 'UPDATE_TOO_EARLY', 'Odds update violates sampling interval.');
    this.rows.push(structuredClone(update));
  }
  history(): ProbabilityUpdate[] { return structuredClone(this.rows); }
}
