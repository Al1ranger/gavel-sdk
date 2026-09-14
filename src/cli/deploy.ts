import { contentHash } from '../evidence/normalizer.ts';
import { scanContract } from '../security/contractAuditor.ts';
import { requireThat } from '../api/types.ts';
export type DeploymentAdapter = { deploy: (source: string, network: string) => Promise<{ transactionHash: string }> };
/** Adapter owns signing and receipt handling. No automatic public deployment. */
export async function deployContract(source: string, network: string, approvedSourceHash: string, adapter: DeploymentAdapter) {
  requireThat(['localnet', 'studionet', 'testnetBradbury'].includes(network), 'DEPLOY_NETWORK', 'Only explicit development networks are supported.');
  requireThat(contentHash(source) === approvedSourceHash, 'DEPLOY_APPROVAL', 'Deployment requires approval of the exact source hash.');
  requireThat(scanContract(source).automatedChecksPassed, 'DEPLOY_SCAN', 'Resolve automated source findings first.');
  const result = await adapter.deploy(source, network);
  requireThat(/^0x[0-9a-fA-F]{64}$/.test(result.transactionHash), 'DEPLOY_RECEIPT', 'Adapter returned an invalid transaction hash.');
  return { ...result, status: 'SUBMITTED' as const, network, sourceHash: approvedSourceHash };
}
