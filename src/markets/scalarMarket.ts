import { integer, requireThat } from '../api/types.ts';
export { generateScalarOracle } from '../oracles.ts';
/** Exact integer units; inputs must already use the same declared scale. */
export function scalarPayout(value: bigint, lower: bigint, upper: bigint): { longBps: number; shortBps: number } {
  requireThat(typeof value === 'bigint' && typeof lower === 'bigint' && typeof upper === 'bigint' && upper > lower, 'SCALAR_RANGE', 'Scalar values must be bigint with ordered bounds.');
  const clamped = value < lower ? lower : value > upper ? upper : value;
  const longBps = Number((clamped - lower) * 10000n / (upper - lower));
  integer(longBps, 0, 10000, 'longBps'); return { longBps, shortBps: 10000 - longBps };
}
