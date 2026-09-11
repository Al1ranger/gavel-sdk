import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Gavel, normalizeMarketSpec, isSettlementReady } from '../dist/index.js';

test('compiled package loads without TypeScript source', () => {
  assert.equal(typeof Gavel, 'function');
  assert.equal(typeof normalizeMarketSpec, 'function');
  assert.equal(isSettlementReady('FINALIZED', 'FINISHED_WITH_ERROR'), false);
});

test('read-only client rejects protocol writes without signing', async () => {
  const gavel = new Gavel({ network: 'localnet', contractAddress: `0x${'1'.repeat(40)}` });
  await assert.rejects(gavel.resolve('GAV-0001'), /signer/);
});
