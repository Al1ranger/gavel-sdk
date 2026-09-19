import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default async function deploy(client) {
  if (Number(await client.getChainId()) !== 61997) throw new Error('Select studio-dev (61997) before deploying.');
  const code = new Uint8Array(readFileSync('contract.py'));
  const sourceHash = createHash('sha256').update(code).digest('hex');
  let transaction;
  if (existsSync('transaction.json')) {
    transaction = JSON.parse(readFileSync('transaction.json', 'utf8'));
    if (transaction.sourceHash !== sourceHash || transaction.chainId !== 61997) throw new Error('Existing transaction belongs to different source or chain. Use a new directory.');
  } else {
    const estimate = await client.estimateTransactionFees({ leaderTimeunitsAllocation: 100n, validatorTimeunitsAllocation: 200n, rotations: [3n], appealRounds: 0n, totalMessageFees: 0n });
    console.log('Fee deposit (wei):', String(estimate.feeValue));
    const hash = await client.deployContract({ code, args: [], fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
    transaction = { hash, sourceHash, chainId: 61997 };
    writeFileSync('transaction.json', JSON.stringify(transaction, null, 2), { flag: 'wx' });
    console.log('Submitted:', hash);
  }
  const receipt = await client.waitForTransactionReceipt({ hash: transaction.hash, retries: 60, interval: 5000, waitUntil: 'finalized', fullTransaction: true });
  writeFileSync('receipt.json', JSON.stringify(receipt, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  if (receipt.statusName !== 'FINALIZED' || receipt.txExecutionResultName !== 'FINISHED_WITH_RETURN') throw new Error('Deployment did not finalize successfully. Inspect receipt.json.');
  const address = receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) throw new Error('No valid contract address in receipt.');
  console.log(JSON.stringify({ ...transaction, address, explorer: `https://explorer-studio-dev.genlayer.com/address/${address}`, status: 'FINALIZED', execution: 'FINISHED_WITH_RETURN' }, null, 2));
}
