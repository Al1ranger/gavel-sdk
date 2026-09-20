/**
 * GenLayer client for the court contract.
 *
 * The court deploys separately from the resolver, so it gets its own client
 * rather than overloading `createGavelClient`. Both share the same account and
 * chain configuration; an application that only settles undisputed markets can
 * deploy the resolver alone and never touch this module.
 */

import { createAccount, createClient } from 'genlayer-js';
import { TransactionHashVariant, TransactionStatus } from 'genlayer-js/types';
import type { Hash, Account, Address } from 'genlayer-js/types';
import type { Eip1193Provider } from './wallet.ts';

import { gavelChains, type Network, type Verdict } from './client.ts';
import { deriveProtocolState, isSettlementReady } from './status.ts';
import { normalizeCourtSpec, type CourtRecord, type CourtSpec } from './court.ts';
import { normalizeArgument, normalizeCaseSpec, type ArgumentSubmission, type CaseRecord, type CaseSpec } from './case.ts';
import { normalizeEvidence, type EvidenceSubmission } from './evidence.ts';

/** What a market needs to know before paying out. */
export type Settlement = {
  binding: boolean;
  caseId: string;
  reason: string;
  marketId?: string;
  outcomeId?: string;
  winnerIndex?: number;
  status?: 'RESOLVED' | 'UNRESOLVED';
  verdictHash?: `0x${string}`;
  appealDeadline?: number;
  appealsExhausted?: boolean;
};

export type CourtClientConfig = {
  network: Network;
  courtAddress: `0x${string}`;
  privateKey?: `0x${string}`;
  rpcUrl?: string;
  account?: Account | Address;
  provider?: Eip1193Provider;
};

export function createCourtClient(config: CourtClientConfig) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.courtAddress)) throw new Error('A valid court contract address is required.');
  const chain = gavelChains[config.network];
  if (!chain) throw new Error('Unsupported GenLayer network.');

  const readClient = createClient({ chain, endpoint: config.rpcUrl });
  const writeClient = config.privateKey
    ? createClient({ chain, endpoint: config.rpcUrl, account: createAccount(config.privateKey) })
    : config.provider && config.account
      ? createClient({ chain, endpoint: config.rpcUrl, account: config.account, provider: config.provider })
      : undefined;

  const requireWriteClient = () => {
    if (!writeClient) throw new Error('A wallet account or agent signer is required for court writes.');
    return writeClient;
  };

  const write = (functionName: string, args: string[]) =>
    requireWriteClient().writeContract({ address: config.courtAddress, functionName, args, value: 0n });

  /** Views read the latest non-final state so a UI can show a pending case. */
  const read = async (functionName: string, args: string[], final = false) =>
    readClient.readContract({
      address: config.courtAddress,
      functionName,
      args,
      transactionHashVariant: final ? TransactionHashVariant.LATEST_FINAL : TransactionHashVariant.LATEST_NONFINAL,
    });

  return {
    readClient,

    // --- courts -------------------------------------------------------
    async createCourt(spec: CourtSpec) {
      return write('create_court', [JSON.stringify(normalizeCourtSpec(spec))]);
    },
    /** Amend a court. Rejected on-chain while the court has unresolved cases. */
    async configureCourt(courtId: string, spec: CourtSpec) {
      return write('configure_court', [courtId.trim().toUpperCase(), JSON.stringify(normalizeCourtSpec(spec))]);
    },
    async getCourt(courtId: string): Promise<CourtRecord> {
      return JSON.parse(String(await read('get_court', [courtId.trim().toUpperCase()]))) as CourtRecord;
    },
    async listCourtIds(): Promise<string[]> {
      const raw = await read('list_court_ids', []);
      return Array.isArray(raw) ? raw.map(String) : [];
    },

    // --- cases --------------------------------------------------------
    async openCase(spec: CaseSpec) {
      return write('open_case', [JSON.stringify(normalizeCaseSpec(spec))]);
    },
    async getCase(caseId: string): Promise<CaseRecord> {
      return JSON.parse(String(await read('get_case', [caseId.trim().toUpperCase()]))) as CaseRecord;
    },
    async listCaseIds(): Promise<string[]> {
      const raw = await read('list_case_ids', []);
      return Array.isArray(raw) ? raw.map(String) : [];
    },

    // --- submissions --------------------------------------------------
    /**
     * Validated against the case's own approved sources, which the caller must
     * supply. Passing the court's wider list would let unadmissible evidence
     * through local validation only to be down-scored on-chain.
     */
    async submitEvidence(caseId: string, evidence: EvidenceSubmission, approvedSources: string[]) {
      const normalized = normalizeEvidence(evidence, approvedSources);
      return write('submit_evidence', [
        caseId.trim().toUpperCase(),
        JSON.stringify({ description: normalized.description, source: normalized.source, type: normalized.type }),
      ]);
    },
    async submitArgument(caseId: string, argument: ArgumentSubmission, state: Parameters<typeof normalizeArgument>[1]) {
      return write('submit_argument', [caseId.trim().toUpperCase(), JSON.stringify(normalizeArgument(argument, state))]);
    },

    // --- adjudication -------------------------------------------------
    async requestVerdict(caseId: string) {
      return write('request_verdict', [caseId.trim().toUpperCase()]);
    },
    async getCaseVerdict(caseId: string): Promise<Verdict> {
      return JSON.parse(String(await read('get_verdict', [caseId.trim().toUpperCase()]))) as Verdict;
    },
    /**
     * Verdict read at finalized state, after confirming the transaction both
     * finalized AND executed successfully. Lifecycle status alone does not
     * prove execution succeeded, so both are checked before settlement.
     */
    async getFinalCaseVerdict(caseId: string, transactionHash: Hash): Promise<Verdict & { transactionStatus: 'FINALIZED' }> {
      const transaction = await readClient.waitForTransactionReceipt({ hash: transactionHash, status: TransactionStatus.FINALIZED });
      if (!isSettlementReady(transaction.statusName, transaction.txExecutionResultName)) {
        throw new Error(`Verdict transaction finalized without a successful ruling: ${transaction.txExecutionResultName ?? 'UNKNOWN'}`);
      }
      const raw = await read('get_verdict', [caseId.trim().toUpperCase()], true);
      return { ...(JSON.parse(String(raw)) as Verdict), transactionStatus: 'FINALIZED' };
    },

    // --- appeals ------------------------------------------------------
    async appealVerdict(caseId: string, appeal: { party: string; grounds: string; evidenceWindowSeconds?: number; argumentWindowSeconds?: number }) {
      const grounds = String(appeal.grounds ?? '').trim();
      if (grounds.length < 20 || grounds.length > 4000) throw new Error('Appeal grounds must contain 20-4000 characters.');
      const evidenceWindowSeconds = appeal.evidenceWindowSeconds ?? 86400;
      const argumentWindowSeconds = appeal.argumentWindowSeconds ?? 86400;
      if (evidenceWindowSeconds < 3600 || argumentWindowSeconds < 3600) throw new Error('Appeal windows must be at least one hour.');
      return write('appeal_verdict', [
        caseId.trim().toUpperCase(),
        JSON.stringify({ argumentWindowSeconds, evidenceWindowSeconds, grounds, party: String(appeal.party ?? '').trim() }),
      ]);
    },

    // --- settlement ---------------------------------------------------
    /** Binding only once the appeal window closes or the ladder is exhausted. */
    async getSettlement(caseId: string): Promise<Settlement> {
      return JSON.parse(String(await read('get_settlement', [caseId.trim().toUpperCase()]))) as Settlement;
    },

    async getTransactionState(transactionHash: `0x${string}`) {
      const transaction = await readClient.getTransaction({ hash: transactionHash as Hash });
      return {
        status: transaction.statusName,
        executionResult: transaction.txExecutionResultName,
        ...deriveProtocolState(transaction.statusName, transaction.txExecutionResultName),
      };
    },
  };
}
