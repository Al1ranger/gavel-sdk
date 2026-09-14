import { integer } from '../api/types.ts';
export function confidenceBps(value: number): number { return integer(value, 0, 10000, 'confidenceBps'); }
export function confidenceAgrees(a: number, b: number, threshold: number, tolerance = 0): boolean {
  [a, b, threshold, tolerance].forEach(confidenceBps);
  return (a >= threshold) === (b >= threshold) && Math.abs(a - b) <= tolerance;
}
