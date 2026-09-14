import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionHashVariant } from 'genlayer-js/types';
import { createOracleClient } from '../dist/index.js';

const address = `0x${'1'.repeat(40)}` as const;
const hash = `0x${'2'.repeat(64)}` as const;
const observation = { oracleId: 'TEST-ORACLE', specHash: hash, evidenceDigest: hash, evidence: [{ source: 'https://example.com', available: true, content: '{}', error: '' }], observedAt: 1, kind: 'SCALAR_OBSERVATION', status: 'OBSERVED', valueScaled: 25, longPayoutBps: 5000, shortPayoutBps: 5000, transfersExecuted: false };

test('oracle reads use finalized state and bind oracle identity', async () => {
  const calls: any[] = [];
  let value = { ...observation };
  const client = createOracleClient({ network: 'localnet', contractAddress: address, expectedId: 'TEST-ORACLE', expectedSpecHash: hash,
    readClient: { readContract: async (request: any) => { calls.push(request); return JSON.stringify(value); } } as any });
  assert.equal((await client.scalar()).state, 'FINALIZED_STATE');
  assert.equal(calls[0].transactionHashVariant, TransactionHashVariant.LATEST_FINAL);
  assert.equal((await client.scalar({ provisional: true })).state, 'PROVISIONAL');
  assert.equal(calls[1].transactionHashVariant, TransactionHashVariant.LATEST_NONFINAL);
  value = { ...observation, oracleId: 'WRONG' };
  await assert.rejects(client.scalar(), /identity/);
  value = { ...observation, shortPayoutBps: 5001 };
  await assert.rejects(client.scalar(), /Malformed/);
  await assert.rejects(client.submit('observe'), /signer/);
});

test('writes return submitted status, never implied settlement', async () => {
  const client = createOracleClient({ network: 'localnet', contractAddress: address, expectedId: 'TEST-ORACLE', expectedSpecHash: hash,
    signer: { writeContract: async (request: any) => { assert.equal(request.functionName, 'sample'); assert.equal(request.value, 0n); return hash; } } as any });
  assert.deepEqual(await client.submit('sample'), { transactionHash: hash, contractAddress: address, status: 'SUBMITTED' });
  await assert.rejects(client.submit('transfer' as any), /Unsupported/);
  await assert.rejects(client.snapshot(-1), /index/);
});
