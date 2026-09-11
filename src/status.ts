export type ProtocolFinality = 'PENDING' | 'PROVISIONAL' | 'FINAL';

export function isSettlementReady(
  status: string | undefined,
  executionResult?: string,
): boolean {
  return status === 'FINALIZED' && executionResult === 'FINISHED_WITH_RETURN';
}

export function deriveProtocolState(
  status: string | undefined,
  executionResult?: string,
): { finality: ProtocolFinality; settlementReady: boolean } {
  if (status === 'FINALIZED') {
    return {
      finality: 'FINAL',
      settlementReady: isSettlementReady(status, executionResult),
    };
  }
  if (status === 'ACCEPTED') {
    return { finality: 'PROVISIONAL', settlementReady: false };
  }
  return { finality: 'PENDING', settlementReady: false };
}
