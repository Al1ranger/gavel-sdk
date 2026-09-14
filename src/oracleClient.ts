import { createClient } from 'genlayer-js';
import { TransactionHashVariant } from 'genlayer-js/types';
import { gavelChains, type Network, type Verdict } from './client.ts';

export type OracleEvidenceRecord = { source: string; available: boolean; content: string; error: string };
export type EvidenceBound = { specHash: `0x${string}`; evidenceDigest: `0x${string}`; evidence: OracleEvidenceRecord[]; observedAt: number };
export type AdjudicatedVerdict = Verdict & EvidenceBound & {
  confidenceBps: number;
  attempt: number;
  featuresApplied: Array<{ feature: string; satisfied: boolean; explanation: string }>;
};
export type ScalarObservation = EvidenceBound & {
  kind: 'SCALAR_OBSERVATION'; oracleId: string; status: 'OBSERVED'; valueScaled: number;
  longPayoutBps: number; shortPayoutBps: number; transfersExecuted: false;
};
export type OddsSnapshot = EvidenceBound & {
  kind: 'ODDS_JOURNAL'; oracleId: string; sequence: number; outcomes: string[];
  probabilitiesE8: number[]; overroundE8: number; coherent: boolean; settlementReady: false;
};

type GenLayerClient = ReturnType<typeof createClient>;
export type OracleClientConfig = {
  network: Network;
  contractAddress: `0x${string}`;
  expectedId: string;
  /** Bind reads to a spec hash independently verified at deployment. */
  expectedSpecHash: `0x${string}`;
  rpcUrl?: string;
  readClient?: Pick<GenLayerClient, 'readContract'>;
  /** Pass your configured GenLayer signer client; the SDK never creates a key. */
  signer?: Pick<GenLayerClient, 'writeContract'>;
};

/** A generated-oracle client, distinct from the shared registry/court client.
 * Reads default to finalized STATE, not a claimed receipt for a supplied tx hash.
 * Trust the configured RPC and deployment. This is not a cross-chain proof.
 */
export function createOracleClient(config: OracleClientConfig) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.contractAddress) || !/^0x[0-9a-fA-F]{64}$/.test(config.expectedSpecHash)) throw new Error('Valid contract address and independently verified spec hash are required.');
  if (!/^[A-Z0-9_-]{4,64}$/.test(config.expectedId) || !gavelChains[config.network]) throw new Error('Invalid oracle identity or network.');
  const client = config.readClient ?? createClient({ chain: gavelChains[config.network], endpoint: config.rpcUrl });
  async function read<T extends EvidenceBound & { marketId?: string; oracleId?: string }>(method: string, args: number[], provisional: boolean) {
    const raw = await client.readContract({ address: config.contractAddress, functionName: method, args,
      transactionHashVariant: provisional ? TransactionHashVariant.LATEST_NONFINAL : TransactionHashVariant.LATEST_FINAL });
    const value = JSON.parse(String(raw)) as T;
    if (!value || typeof value !== 'object' || (value.marketId ?? value.oracleId) !== config.expectedId || value.specHash !== config.expectedSpecHash) throw new Error('Oracle identity/spec hash mismatch.');
    if (!/^0x[0-9a-f]{64}$/.test(value.evidenceDigest) || !Array.isArray(value.evidence) || !value.evidence.length || !Number.isSafeInteger(value.observedAt)) throw new Error('Malformed evidence-bound oracle result.');
    return { value, state: provisional ? 'PROVISIONAL' as const : 'FINALIZED_STATE' as const, contractAddress: config.contractAddress };
  }
  return {
    async submit(action: 'resolve' | 'observe' | 'sample') {
      if (!['resolve', 'observe', 'sample'].includes(action)) throw new Error('Unsupported oracle action.');
      if (!config.signer) throw new Error('Configure your own signer for oracle writes.');
      const transactionHash = await config.signer.writeContract({ address: config.contractAddress, functionName: action, args: [], value: 0n });
      return { transactionHash, contractAddress: config.contractAddress, status: 'SUBMITTED' as const };
    },
    async verdict(options: { provisional?: boolean } = {}) {
      const result = await read<AdjudicatedVerdict>('get_verdict', [], options.provisional ?? false);
      const v = result.value;
      if (!['RESOLVED', 'UNRESOLVED'].includes(v.status) || !Number.isSafeInteger(v.winnerIndex) || !Number.isSafeInteger(v.confidenceBps) || v.confidenceBps < 0 || v.confidenceBps > 10000 || !Number.isSafeInteger(v.attempt) || v.attempt < 1 || (v.status === 'UNRESOLVED' ? v.winnerIndex !== -1 || v.outcomeId !== 'UNRESOLVED' : v.winnerIndex < 0 || !v.outcomeId || v.outcomeId === 'UNRESOLVED')) throw new Error('Malformed adjudicated verdict.');
      return result;
    },
    async scalar(options: { provisional?: boolean } = {}) {
      const result = await read<ScalarObservation>('get_result', [], options.provisional ?? false);
      const v = result.value;
      if (v.kind !== 'SCALAR_OBSERVATION' || v.status !== 'OBSERVED' || !Number.isSafeInteger(v.valueScaled) || ![v.longPayoutBps, v.shortPayoutBps].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 10000) || v.longPayoutBps + v.shortPayoutBps !== 10000 || v.transfersExecuted !== false) throw new Error('Malformed scalar observation.');
      return result;
    },
    async snapshot(index: number, options: { provisional?: boolean } = {}) {
      if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid snapshot index.');
      const result = await read<OddsSnapshot>('get_snapshot', [index], options.provisional ?? false);
      const v = result.value;
      if (v.kind !== 'ODDS_JOURNAL' || v.sequence !== index || v.settlementReady !== false || typeof v.coherent !== 'boolean' || !Array.isArray(v.outcomes) || v.outcomes.length < 2 || !Array.isArray(v.probabilitiesE8) || v.probabilitiesE8.length !== v.outcomes.length || !v.probabilitiesE8.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000) || v.overroundE8 !== v.probabilitiesE8.reduce((a, b) => a + b, 0) - 100000000) throw new Error('Malformed odds snapshot.');
      return result;
    },
  };
}
