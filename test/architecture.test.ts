import { test } from 'node:test';
import assert from 'node:assert/strict';

test('public module boundaries resolve through package exports', async () => {
  const contracts = await import('@gavel-sdk/core/contracts');
  const clients = await import('@gavel-sdk/core/clients');
  const markets = await import('@gavel-sdk/core/markets');
  const evidence = await import('@gavel-sdk/core/evidence');
  const api = await import('@gavel-sdk/core/api');
  assert.equal(typeof contracts.generateIntelligentContract, 'function');
  assert.equal(typeof clients.createOracleClient, 'function');
  assert.equal(typeof markets.normalizeOdds, 'function');
  assert.equal(typeof evidence.normalizeEvidencePolicy, 'function');
  assert.equal(typeof api.readApi, 'function');
  assert.equal('createOracleClient' in contracts, false);
  assert.equal('generateIntelligentContract' in markets, false);
});
