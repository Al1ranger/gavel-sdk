import type { Hash } from 'genlayer-js/types';

import type { Gavel } from './gavel.ts';
/** A coordinator submits eligible markets; only GenLayer adjudicates. */
export class ResolverAgent {
  private readonly gavel: Gavel;
  constructor(gavel: Gavel) { this.gavel = gavel; }
  async resolve(marketId: string) {
    const { spec } = await this.gavel.getMarket(marketId);
    if (spec.resolutionTime > Math.floor(Date.now() / 1000)) throw new Error('Resolution deadline has not passed.');
    return this.gavel.resolve(spec.marketId);
  }
  async inspect(marketId: string, transactionHash: Hash) {
    const transaction = await this.gavel.getTransactionState(transactionHash);
    const verdict = transaction.settlementReady
      ? await this.gavel.getFinalVerdict(marketId, transactionHash)
      : transaction.finality === 'PROVISIONAL' ? await this.gavel.getVerdict(marketId) : null;
    return { transaction, verdict };
  }
}
