import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readApi, createApiMarket, predictionResult } from '../dist/index.js';

test('API supports POST and explicit nested JSON fields', async () => {
  const result = await readApi({ url: 'https://data.example/query', method: 'POST', body: { id: 1 }, path: ['data', 0, 'score'] }, {
    allowedOrigins: ['https://data.example'], fetch: async (_, init) => {
      assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error');
      return new Response(JSON.stringify({ data: [{ score: 42 }] }));
    },
  });
  assert.equal(result, 42);
});
test('API rejects unapproved origins, oversized responses and missing fields', async () => {
  await assert.rejects(readApi({ url: 'https://other.example' }, { allowedOrigins: [] }), /origin/);
  await assert.rejects(readApi({ url: 'https://data.example' }, { allowedOrigins: ['https://data.example'], maxBytes: 2, fetch: async () => new Response('{"x":1}') }), /byte limit/);
  await assert.rejects(readApi({ url: 'https://data.example', path: ['missing'] }, { allowedOrigins: ['https://data.example'], fetch: async () => new Response('{}') }), /missing/);
});
test('settlement requires final execution and matching spec; unresolved keeps payouts absent', () => {
  const spec = { ...createApiMarket({ marketId: 'API-0001', question: 'Did the event finish successfully?', outcomes: [{ index: 0, id: 'YES', label: 'Yes' }, { index: 1, id: 'NO', label: 'No' }], resolutionRules: ['Missing evidence returns UNRESOLVED.'], resolutionTime: 1, sourcePolicy: {} }, [{ url: 'https://data.example/event', interpretation: 'Read final status.' }]), specHash: '0xabc' as const };
  const verdict = { marketId: spec.marketId, specHash: spec.specHash, status: 'RESOLVED' as const, winnerIndex: 0, outcomeId: 'YES', facts: [], rulesApplied: [], conflicts: [], reasonCode: 'FINAL', reasoningSummary: 'Final API state.' };
  assert.equal(predictionResult(spec, verdict, { status: 'ACCEPTED', executionResult: 'FINISHED_WITH_RETURN' }).payoutWeights, null);
  assert.deepEqual(predictionResult(spec, verdict, { status: 'FINALIZED', executionResult: 'FINISHED_WITH_RETURN' }).payoutWeights?.map(x => x.weight), [1, 0]);
  assert.equal(predictionResult(spec, { ...verdict, status: 'UNRESOLVED', winnerIndex: -1, outcomeId: 'UNRESOLVED' }, { status: 'FINALIZED', executionResult: 'FINISHED_WITH_RETURN' }).settlementReady, false);
  assert.throws(() => predictionResult(spec, { ...verdict, marketId: 'WRONG' }, {}), /match/);
});
