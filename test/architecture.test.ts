import { test } from 'node:test';
import assert from 'node:assert/strict';

test('public module boundaries resolve through package exports', async () => {
  const contracts = await import('gavel-judgment-sdk/contracts');
  const clients = await import('gavel-judgment-sdk/clients');
  const markets = await import('gavel-judgment-sdk/markets');
  const evidence = await import('gavel-judgment-sdk/evidence');
  const api = await import('gavel-judgment-sdk/api');
  assert.equal(typeof contracts.generateIntelligentContract, 'function');
  assert.equal(typeof clients.createOracleClient, 'function');
  assert.equal(typeof markets.normalizeOdds, 'function');
  assert.equal(typeof evidence.normalizeEvidencePolicy, 'function');
  assert.equal(typeof api.readApi, 'function');
  assert.equal('createOracleClient' in contracts, false);
  assert.equal('generateIntelligentContract' in markets, false);
});

test('public declarations compile with strict library checks', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '--noEmit', '--strict',
    '--module', 'nodenext', '--target', 'es2022', '--types', 'node',
    'test/consumer-types.mts',
  ], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});
