/** Pure market validation and output formatting; no authoritative adjudication. */
export { normalizeMarketSpec, serializeMarketSpec } from './market.ts';
export { normalizeOdds, impliedProbability, scalarOutcomes, validateShape } from './marketKinds.ts';
export type { MarketShape, OddsBook, OddsFormat, ScalarRange } from './marketKinds.ts';
export { predictionResult } from './prediction.ts';
