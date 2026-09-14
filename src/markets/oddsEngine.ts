import { integer, requireThat } from '../api/types.ts';
export { normalizeOdds, impliedProbability } from '../marketKinds.ts';
/** Deterministic weighted average of forecast inputs; not calibrated market odds. */
export function aggregateProbabilities(inputs: Array<{ probabilityBps: number; weight: number }>): number {
  requireThat(inputs.length > 0 && inputs.length <= 10000, 'FORECAST_INPUT', 'Provide 1-10000 forecasts.');
  let weighted = 0n, weights = 0n;
  for (const input of inputs) { integer(input.probabilityBps, 0, 10000, 'probabilityBps'); integer(input.weight, 1, 1000000, 'weight'); weighted += BigInt(input.probabilityBps) * BigInt(input.weight); weights += BigInt(input.weight); }
  return Number(weighted / weights);
}
