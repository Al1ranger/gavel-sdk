/**
 * Gavel facade — the surface most applications should use.
 *
 * Two contracts sit behind it. The resolver settles undisputed markets from
 * approved sources; the court hears disputes with parties, evidence, arguments
 * and appeals. Court methods are available only when a court address is
 * configured, so an application that never disputes anything can deploy the
 * resolver alone.
 */

import type { Hash } from 'genlayer-js/types';

import { createGavelClient, type MarketSpec, type Verdict } from './client.ts';
import { createCourtClient, type Settlement } from './courtClient.ts';
import type { CourtSpec } from './court.ts';
import type { ArgumentSubmission, CaseSpec } from './case.ts';
import type { EvidenceSubmission } from './evidence.ts';

export type GavelConfig = Parameters<typeof createGavelClient>[0] & { courtAddress?: `0x${string}` };

/** Every write returns the submitted hash; nothing is settled until finalized. */
export type Submitted<T extends Record<string, unknown> = Record<string, never>> = T & {
  transactionHash: `0x${string}`;
  status: 'SUBMITTED';
};

export class Gavel {
  readonly client: ReturnType<typeof createGavelClient>;
  private readonly courtClient?: ReturnType<typeof createCourtClient>;

  constructor(config: GavelConfig) {
    this.client = createGavelClient(config);
    if (config.courtAddress) {
      this.courtClient = createCourtClient({
        account: config.account,
        courtAddress: config.courtAddress,
        network: config.network,
        privateKey: config.privateKey,
        provider: config.provider,
        rpcUrl: config.rpcUrl,
      });
    }
  }

  /** Court access, with a clear error rather than an undefined dereference. */
  get court() {
    if (!this.courtClient) throw new Error('Configure `courtAddress` to use Gavel court features.');
    return this.courtClient;
  }

  get hasCourt(): boolean {
    return Boolean(this.courtClient);
  }

  // --- markets --------------------------------------------------------

  async createMarket(spec: MarketSpec): Promise<Submitted<{ id: string }>> {
    const transactionHash = await this.client.registerMarket(spec);
    return { id: spec.marketId.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  async resolve(marketId: string): Promise<Submitted<{ marketId: string }>> {
    const transactionHash = await this.client.resolveMarket(marketId.trim().toUpperCase());
    return { marketId: marketId.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  getMarket(marketId: string) { return this.client.getMarket(marketId); }
  getVerdict(marketId: string) { return this.client.getVerdict(marketId); }
  getFinalVerdict(marketId: string, transactionHash: Hash) { return this.client.getFinalVerdict(marketId, transactionHash); }
  getTransactionState(transactionHash: `0x${string}`) { return this.client.getTransactionState(transactionHash); }

  // --- courts ---------------------------------------------------------

  async createCourt(spec: CourtSpec): Promise<Submitted<{ courtId: string }>> {
    const transactionHash = await this.court.createCourt(spec);
    return { courtId: spec.id.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  getCourt(courtId: string) { return this.court.getCourt(courtId); }
  listCourts() { return this.court.listCourtIds(); }

  // --- cases ----------------------------------------------------------

  async createCase(spec: CaseSpec): Promise<Submitted<{ caseId: string }>> {
    const transactionHash = await this.court.openCase(spec);
    return { caseId: spec.id.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  getCase(caseId: string) { return this.court.getCase(caseId); }
  listCases() { return this.court.listCaseIds(); }

  /**
   * Submit evidence. The case's own approved-source list is fetched first so
   * credibility is scored against the same list the contract will use.
   */
  async submitEvidence(caseId: string, evidence: EvidenceSubmission): Promise<Submitted<{ caseId: string }>> {
    const record = await this.court.getCase(caseId);
    const transactionHash = await this.court.submitEvidence(caseId, evidence, record.case.approvedSources);
    return { caseId: caseId.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  async submitArgument(caseId: string, argument: ArgumentSubmission): Promise<Submitted<{ caseId: string }>> {
    const record = await this.court.getCase(caseId);
    const transactionHash = await this.court.submitArgument(caseId, argument, record.case);
    return { caseId: caseId.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  async requestVerdict(caseId: string): Promise<Submitted<{ caseId: string }>> {
    const transactionHash = await this.court.requestVerdict(caseId);
    return { caseId: caseId.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  async appealVerdict(caseId: string, appeal: Parameters<ReturnType<typeof createCourtClient>['appealVerdict']>[1]): Promise<Submitted<{ caseId: string }>> {
    const transactionHash = await this.court.appealVerdict(caseId, appeal);
    return { caseId: caseId.trim().toUpperCase(), status: 'SUBMITTED', transactionHash };
  }

  getCaseVerdict(caseId: string): Promise<Verdict> { return this.court.getCaseVerdict(caseId); }
  getSettlement(caseId: string): Promise<Settlement> { return this.court.getSettlement(caseId); }

  // --- settlement -----------------------------------------------------

  /**
   * Settle a market from a court ruling.
   *
   * Refuses anything that is not binding — a ruling still inside its appeal
   * window, or one whose case never reached a verdict. Callers get the
   * settlement record back so they can pay out against `winnerIndex`.
   */
  async resolveMarket(caseId: string): Promise<Settlement> {
    const settlement = await this.court.getSettlement(caseId);
    if (!settlement.binding) throw new Error(`Case ${settlement.caseId} is not binding yet: ${settlement.reason}.`);
    if (settlement.status !== 'RESOLVED') throw new Error(`Case ${settlement.caseId} finalized as UNRESOLVED and cannot settle a market.`);
    return settlement;
  }
}
