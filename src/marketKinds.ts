/**
 * Market shapes and odds.
 *
 * Gavel judges what happened; it never prices anything. Odds live here only so
 * a host market can carry its own pricing alongside the spec and have the SDK
 * check that pricing is internally coherent before a dispute ever opens — a
 * market whose implied probabilities do not sum to one is a market whose
 * settlement will be argued about later.
 */

import type { Outcome } from './client.ts';

export const MARKET_KINDS = ['BINARY', 'CATEGORICAL', 'SCALAR'] as const;
export type MarketKind = (typeof MARKET_KINDS)[number];

export const ODDS_FORMATS = ['PROBABILITY', 'DECIMAL', 'FRACTIONAL', 'AMERICAN'] as const;
export type OddsFormat = (typeof ODDS_FORMATS)[number];

/** One outcome's price, in whichever convention the host market publishes. */
export type OutcomeOdds = {
  outcomeId: string;
  /** PROBABILITY 0-1 · DECIMAL ≥1 · FRACTIONAL "5/2" · AMERICAN ±100+ */
  value: number | string;
};

export type OddsBook = {
  format: OddsFormat;
  outcomes: OutcomeOdds[];
  /** Bookmaker margin as a fraction. 0 for a true prediction market. */
  overround?: number;
};

/**
 * A SCALAR market resolves a number, but a court can only pick a registered
 * outcome — so the range is bucketed and the buckets are the outcomes.
 */
export type ScalarRange = { min: number; max: number; unit: string; buckets: number };

export type MarketShape =
  | { kind: 'BINARY' }
  | { kind: 'CATEGORICAL' }
  | { kind: 'SCALAR'; range: ScalarRange };

/** Convert any supported convention to an implied probability in 0-1. */
export function impliedProbability(format: OddsFormat, value: number | string): number {
  if (!ODDS_FORMATS.includes(format)) throw new Error('Unknown odds format.');
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) throw new Error('Odds must be a nonempty number or numeric string.');
  if (format === 'PROBABILITY') {
    const probability = Number(value);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('A probability must fall between 0 and 1.');
    return probability;
  }

  if (format === 'DECIMAL') {
    const decimal = Number(value);
    if (!Number.isFinite(decimal) || decimal < 1) throw new Error('Decimal odds must be at least 1.');
    return 1 / decimal;
  }

  if (format === 'FRACTIONAL') {
    if (!/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(String(value))) throw new Error('Fractional odds must look like "5/2".');
    const [numerator, denominator] = String(value).split('/').map(Number);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) throw new Error('Fractional odds must look like "5/2".');
    return denominator / (numerator + denominator);
  }

  const american = Number(value);
  if (!Number.isFinite(american) || Math.abs(american) < 100) throw new Error('American odds must be at least +100 or at most -100.');
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

/**
 * Normalize a book to probabilities and report its overround.
 *
 * A book is rejected only when it cannot be interpreted at all. A book that
 * sums to something other than 1 is reported, not refused — real books carry
 * margin, and it is the host market's business how much.
 */
export function normalizeOdds(book: OddsBook, outcomes: Outcome[]): { probabilities: Array<{ outcomeId: string; probability: number }>; overround: number } {
  if (!book || typeof book !== 'object') throw new Error('An OddsBook object is required.');
  if (!ODDS_FORMATS.includes(book.format)) throw new Error(`Odds format must be one of ${ODDS_FORMATS.join(', ')}.`);
  if (!Array.isArray(book.outcomes) || book.outcomes.length !== outcomes.length) throw new Error('Price every registered outcome exactly once.');

  const registered = new Set(outcomes.map(outcome => outcome.id));
  const seen = new Set<string>();
  const probabilities = book.outcomes.map(entry => {
    const outcomeId = String(entry.outcomeId ?? '').trim().toUpperCase();
    if (!registered.has(outcomeId)) throw new Error(`Odds reference an unregistered outcome: ${outcomeId}.`);
    if (seen.has(outcomeId)) throw new Error(`Odds price ${outcomeId} more than once.`);
    seen.add(outcomeId);
    return { outcomeId, probability: impliedProbability(book.format, entry.value) };
  });

  const total = probabilities.reduce((sum, entry) => sum + entry.probability, 0);
  return { overround: total - 1, probabilities };
}

/** Outcomes for a scalar market, derived from its range so buckets are exact. */
export function scalarOutcomes(range: ScalarRange): Outcome[] {
  const { min, max, unit, buckets } = range;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) throw new Error('A scalar range needs max greater than min.');
  if (!Number.isSafeInteger(buckets) || buckets < 2 || buckets > 16) throw new Error('A scalar market needs 2-16 buckets.');

  const width = (max - min) / buckets;
  return Array.from({ length: buckets }, (_, index) => {
    const low = min + index * width;
    const high = index === buckets - 1 ? max : low + width;
    return {
      id: `B${index}`,
      index,
      // The last bucket is inclusive at the top so the range has no gap.
      label: `${low} to ${high}${index === buckets - 1 ? '' : ' (exclusive)'} ${unit}`.trim(),
    };
  });
}

/** Checks the outcome set actually matches the declared shape. */
export function validateShape(shape: MarketShape, outcomes: Outcome[]): void {
  if (!shape || !MARKET_KINDS.includes(shape.kind)) throw new Error(`Market kind must be one of ${MARKET_KINDS.join(', ')}.`);
  if (shape.kind === 'BINARY' && outcomes.length !== 2) throw new Error('A binary market registers exactly 2 outcomes.');
  if (shape.kind === 'CATEGORICAL' && outcomes.length < 2) throw new Error('A categorical market registers at least 2 outcomes.');
  if (shape.kind === 'SCALAR' && outcomes.length !== shape.range.buckets) throw new Error('A scalar market registers one outcome per bucket.');
}
