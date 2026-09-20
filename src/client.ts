import { createAccount, createClient } from 'genlayer-js';
import { localnet, studionet, testnetAsimov, testnetBradbury } from 'genlayer-js/chains';
import { TransactionHashVariant, TransactionStatus } from 'genlayer-js/types';
import type { Hash, Account, Address } from 'genlayer-js/types';
import type { Eip1193Provider } from './wallet.ts';

import { deriveProtocolState, isSettlementReady } from './status.ts';
import { normalizeMarketSpec } from './market.ts';


export type Outcome = { index: number; id: string; label: string };
export type MarketSpec = {
  marketId: string;
  question: string;
  outcomes: Outcome[];
  resolutionRules: string[];
  resolutionTime: number;
  approvedSources: string[];
  sourcePolicy: Record<string, unknown>;
  specHash?: `0x${string}`;
};
export type Verdict = {
  evidenceHash?: `0x${string}`;
  marketId: string;
  specHash: `0x${string}`;
  status: 'RESOLVED' | 'UNRESOLVED';
  winnerIndex: number;
  outcomeId: string;
  reasonCode: string;
  facts: Array<{ claim: string; source: string; supportsOutcome: string }>;
  rulesApplied: Array<{ rule: string; satisfied: boolean; explanation: string }>;
  conflicts: Array<{ description: string; sources: string[] }>;
  reasoningSummary: string;
};
export type FinalVerdict = Verdict & { transactionStatus: 'FINALIZED' };
export type MarketRecord = { creator: string; spec: MarketSpec };

export type Network = 'localnet' | 'studionet' | 'testnetAsimov' | 'testnetBradbury';

export const gavelChains = { localnet, studionet, testnetAsimov, testnetBradbury } as const;

export function createGavelClient(config: {
  network: Network;
  contractAddress: `0x${string}`;
  privateKey?: `0x${string}`;
  rpcUrl?: string;
  account?: Account | Address;
  provider?: Eip1193Provider;
}) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.contractAddress)) throw new Error('A valid resolver contract address is required.');
  const chain = gavelChains[config.network];
  if (!chain) throw new Error('Unsupported GenLayer network.');
  const readClient = createClient({ chain, endpoint: config.rpcUrl });
  const writeClient = config.privateKey
    ? createClient({ chain, endpoint: config.rpcUrl, account: createAccount(config.privateKey) })
    : config.provider && config.account ? createClient({ chain, endpoint: config.rpcUrl, account: config.account, provider: config.provider }) : undefined;

  const requireWriteClient = () => {
    if (!writeClient) throw new Error('A wallet account or agent signer is required for protocol writes.');
    return writeClient;
  };

  return {
    readClient,
    async registerMarket(spec: MarketSpec) {
      return requireWriteClient().writeContract({
        address: config.contractAddress,
        functionName: 'register_market',
        args: [JSON.stringify(normalizeMarketSpec(spec))],
        value: 0n,
      });
    },
    async resolveMarket(marketId: string) {
      return requireWriteClient().writeContract({
        address: config.contractAddress,
        functionName: 'resolve_market',
        args: [marketId],
        value: 0n,
      });
    },
    async listMarketIds(): Promise<string[]> {
      const raw = await readClient.readContract({
        address: config.contractAddress,
        functionName: 'list_market_ids',
        args: [],
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
      });
      return Array.isArray(raw) ? raw.map(String) : [];
    },
    async getMarket(marketId: string): Promise<MarketRecord> {
      const raw = await readClient.readContract({
        address: config.contractAddress,
        functionName: 'get_market',
        args: [marketId],
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
      });
      return JSON.parse(String(raw)) as MarketRecord;
    },
    async getVerdict(marketId: string): Promise<Verdict> {
      const raw = await readClient.readContract({
        address: config.contractAddress,
        functionName: 'get_verdict',
        args: [marketId],
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
      });
      return JSON.parse(String(raw)) as Verdict;
    },
    async getFinalVerdict(marketId: string, transactionHash: Hash): Promise<FinalVerdict> {
      const transaction = await readClient.waitForTransactionReceipt({
        hash: transactionHash,
        status: TransactionStatus.FINALIZED,
      });
      if (!isSettlementReady(transaction.statusName, transaction.txExecutionResultName)) {
        throw new Error(`Resolution transaction finalized without a successful verdict: ${transaction.txExecutionResultName ?? 'UNKNOWN'}`);
      }
      const raw = await readClient.readContract({
        address: config.contractAddress,
        functionName: 'get_verdict',
        args: [marketId],
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      });
      return { ...(JSON.parse(String(raw)) as Verdict), transactionStatus: 'FINALIZED' };
    },
    async getTransactionState(transactionHash: `0x${string}`) {
      const transaction = await readClient.getTransaction({ hash: transactionHash as Hash });
      const rawVotes = (transaction as unknown as { validatorVotes?: unknown }).validatorVotes;
      const validatorVotes = Array.isArray(rawVotes) ? rawVotes.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const value = entry as Record<string, unknown>;
        const address = typeof value.address === 'string' ? value.address : typeof value.validator === 'string' ? value.validator : null;
        if (!address) return [];
        return [{ address, vote: String(value.vote ?? value.result ?? 'RECORDED') }];
      }) : [];
      return {
        status: transaction.statusName,
        executionResult: transaction.txExecutionResultName,
        validatorVotes,
        ...deriveProtocolState(transaction.statusName, transaction.txExecutionResultName),
      };
    },
  };
}
