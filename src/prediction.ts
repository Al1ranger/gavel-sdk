import type { MarketSpec, Verdict } from './client.ts';
import { normalizeOdds, type OddsBook } from './marketKinds.ts';
import { isSettlementReady } from './status.ts';

/** Formats verified contract data; does not authenticate caller-supplied data. */
export function predictionResult(spec: MarketSpec, verdict: Verdict, transaction: { status?: string; executionResult?: string }, odds?: OddsBook) {
  if (!spec.specHash || spec.specHash !== verdict.specHash || spec.marketId !== verdict.marketId) throw new Error('Verdict does not match the registered market and specification hash.');
  const final = isSettlementReady(transaction.status, transaction.executionResult);
  if (!['RESOLVED', 'UNRESOLVED'].includes(verdict.status)) throw new Error('Invalid verdict status.');
  const winner = spec.outcomes.find(outcome => outcome.index === verdict.winnerIndex && outcome.id === verdict.outcomeId);
  if (verdict.status === 'RESOLVED' && !winner) throw new Error('Verdict winner is not a registered outcome.');
  if (verdict.status === 'UNRESOLVED' && (verdict.winnerIndex !== -1 || verdict.outcomeId !== 'UNRESOLVED')) throw new Error('Invalid unresolved verdict.');
  const settlementReady = final && verdict.status === 'RESOLVED';
  return {
    marketId: spec.marketId, status: verdict.status, finalized: final, settlementReady,
    winnerId: settlementReady ? winner!.id : null,
    /** Payout weights are terminal settlement values, not forecasts or tradable odds. */
    payoutWeights: settlementReady ? spec.outcomes.map(outcome => ({ outcomeId: outcome.id, weight: outcome.id === winner!.id ? 1 : 0 })) : null,
    quotedOdds: odds ? normalizeOdds(odds, spec.outcomes) : null,
    reasoning: verdict.reasoningSummary,
  };
}
