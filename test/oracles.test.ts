import assert from 'node:assert/strict';
import { test } from 'node:test';
import { earthquakeDemoContract, weatherDemoContract, polymarketJournalContract, gavelDeliveryProofContract, generateIntelligentContract, generateScalarOracle, generateOddsJournal, normalizeEvidencePolicy, publicEvidenceUrl, impliedProbability } from '../dist/index.js';

test('three workflows expose distinct state machines, not renamed certificates', () => {
  const resolver = earthquakeDemoContract();
  const scalar = weatherDemoContract();
  const journal = polymarketJournalContract('123', ['Yes', 'No']);
  for (const artifact of [resolver, scalar, journal]) {
    assert.match(artifact.source.split('\n')[0], /py-genlayer:[a-z0-9]{40,}/);
    assert.match(artifact.source, /gl\.nondet\.web\.get/);
    assert.match(artifact.source, /gl\.vm\.run_nondet_unsafe/);
    assert.doesNotMatch(artifact.source, /py-genlayer:(test|latest)["\s]/);
  }
  assert.match(resolver.source, /def resolve\(/);
  assert.match(resolver.source, /attempts: DynArray/);
  assert.match(scalar.source, /longPayoutBps/);
  assert.doesNotMatch(scalar.source, /exec_prompt/);
  assert.match(journal.source, /snapshots: TreeMap/);
  assert.doesNotMatch(journal.source, /def resolve\(/);
});

test('delivery proof acquires normalized public evidence and binds the threshold decision', () => {
  const proof = gavelDeliveryProofContract();
  assert.match(proof.source, /gl\.nondet\.web\.get/);
  assert.match(proof.source, /candidate\["evidenceDigest"\] != independent\["evidenceDigest"\]/);
  assert.match(proof.source, /minimumConfidenceBps/);
  assert.match(proof.source, /INSTALLABLE_SDK/);
  assert.equal((proof.compiledSpec as any).evidence.sources[0].format, 'text');
});

test('evidence policy rejects unsafe URLs and unbounded projections', () => {
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://127.0.0.1', 'https://[::1]', 'https://metadata.internal', 'https://localhost', 'https://example.com/#fragment', 'https://example.com:8443']) assert.throws(() => publicEvidenceUrl(url));
  const source = { url: 'https://api.example.com/event', format: 'json' as const, fields: { id: ['id'] }, expect: { id: 'one' } };
  assert.equal(normalizeEvidencePolicy({ sources: [source] }).minimumSources, 1);
  assert.throws(() => normalizeEvidencePolicy({ sources: [source, source] }), /Duplicate/);
  assert.throws(() => normalizeEvidencePolicy({ sources: [source], minimumSources: 2 }), /minimumSources/);
  assert.throws(() => normalizeEvidencePolicy({ sources: [{ ...source, fields: { id: ['__proto__'] } }] }), /projection/);
  assert.throws(() => normalizeEvidencePolicy({ sources: [{ ...source, expect: { missing: true } }] }), /Expected/);
  assert.throws(() => normalizeEvidencePolicy({ sources: [source], maxResponseBytes: Infinity }), /maxResponseBytes/);
});

test('generator rejects invalid gates and undeclared source changes', () => {
  const demo = earthquakeDemoContract().compiledSpec as any;
  const input = { spec: demo, shape: demo.shape, evidence: demo.evidence };
  for (const minimumConfidenceBps of [-1, 10001, 8.1, NaN]) assert.throws(() => generateIntelligentContract({ ...input, minimumConfidenceBps }));
  assert.throws(() => generateIntelligentContract({ ...input, maxAttempts: 0 }), /maxAttempts/);
  assert.throws(() => generateIntelligentContract({ ...input, features: [{ id: 'BAD', requirement: 'Must be independently verified.', required: 'false' as any }] }), /boolean/);
  assert.throws(() => generateIntelligentContract({ ...input, evidence: { sources: [{ url: 'https://other.example.com/evidence', format: 'json' }] } }), /match approvedSources/);
});

test('numeric oracle inputs require identity, bounded range and ordered outcomes', () => {
  const scalar = weatherDemoContract().compiledSpec as any;
  const input = { ...scalar, source: scalar.evidence.sources[0] };
  assert.throws(() => generateScalarOracle({ ...input, upper: input.lower }), /bounds/);
  assert.throws(() => generateScalarOracle({ ...input, decimals: 9 }), /decimals/);
  assert.throws(() => generateScalarOracle({ ...input, source: { ...input.source, expect: {} } }), /identity/);
  const journal = polymarketJournalContract('123', ['Yes', 'No']).compiledSpec as any;
  const book = { ...journal, source: journal.evidence.sources[0] };
  assert.throws(() => generateOddsJournal({ ...book, outcomeLabels: ['Yes', 'Yes'] }), /unique/);
  assert.throws(() => generateOddsJournal({ ...book, intervalSeconds: 0 }), /intervalSeconds/);
  assert.throws(() => polymarketJournalContract('../markets', ['Yes', 'No']), /numeric/);
});

test('odds parsers reject ambiguous coercions and unknown formats', () => {
  for (const value of ['', ' ', true, null]) assert.throws(() => impliedProbability('PROBABILITY', value as any));
  assert.throws(() => impliedProbability('FRACTIONAL', '5/2/1'));
  assert.throws(() => impliedProbability('UNKNOWN' as any, 100));
  assert.equal(impliedProbability('AMERICAN', -200), 2 / 3);
});
