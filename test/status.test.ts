import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveProtocolState, isSettlementReady } from '../src/status.ts';

describe('GenLayer finality mapping', () => {
  it('shows ACCEPTED as provisional and not settlement-ready', () => {
    assert.deepEqual(deriveProtocolState('ACCEPTED', 'FINISHED_WITH_RETURN'), {
      finality: 'PROVISIONAL',
      settlementReady: false,
    });
    assert.equal(isSettlementReady('ACCEPTED', 'FINISHED_WITH_RETURN'), false);
  });

  it('shows FINALIZED as final and settlement-ready', () => {
    assert.deepEqual(deriveProtocolState('FINALIZED', 'FINISHED_WITH_RETURN'), {
      finality: 'FINAL',
      settlementReady: true,
    });
    assert.equal(isSettlementReady('FINALIZED', 'FINISHED_WITH_RETURN'), true);
    assert.equal(isSettlementReady('FINALIZED', 'FINISHED_WITH_ERROR'), false);
  });
});
