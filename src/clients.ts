/** RPC boundary. Signers are supplied by the application. */
export { createOracleClient } from './oracleClient.ts';
export type { OracleClientConfig, AdjudicatedVerdict, ScalarObservation, OddsSnapshot, EvidenceBound, OracleEvidenceRecord } from './oracleClient.ts';
export { createGavelClient } from './client.ts';
export type { MarketSpec, Verdict, Network } from './client.ts';
