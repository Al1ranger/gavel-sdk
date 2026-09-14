/** Contract compilation only; no RPC clients or signing dependencies. */
export { generateIntelligentContract } from './generate.ts';
export type { GenerateInput, GeneratedContract, MarketFeature } from './generate.ts';
export { generateScalarOracle, generateOddsJournal } from './oracles.ts';
export type { ScalarOracleInput, OddsJournalInput } from './oracles.ts';
export { earthquakeDemoContract, weatherDemoContract, polymarketJournalContract } from './recipes.ts';
