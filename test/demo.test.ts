import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';

test('demo serves UI, rejects invalid specs and generates an immutable contract', async () => {
  const port = 3197;
  const child = spawn(process.execPath, ['demo/server.mjs'], { env: { ...process.env, PORT: String(port), GAVEL_CONTRACT_ADDRESS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await Promise.race([once(child.stdout, 'data'), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Demo did not start')), 15000); timer.unref(); })]);
    const base = `http://127.0.0.1:${port}`;
    assert.match(await (await fetch(base)).text(), /Every outcome needs evidence/);
    const disconnected = await (await fetch(`${base}/api/resolver`)).json();
    assert.equal(disconnected.configured, false);
    const invalid = await fetch(`${base}/api/generate`, { method: 'POST', body: '{}' });
    assert.equal(invalid.ok, false);
    const input = { marketId: 'DEMO-0001', question: 'Did the reviewed event meet the threshold?', deadline: '2024-01-01T00:00:00Z', source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000m9g4.geojson', interpretation: 'Read the reviewed event magnitude.', rule: 'YES if magnitude >= 7.4; NO otherwise.' };
    const response = await fetch(`${base}/api/generate`, { method: 'POST', body: JSON.stringify(input) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.spec.marketId, input.marketId);
    assert.match(result.contract.source, /run_nondet_unsafe/);
    assert.match(result.contract.source, /FINAL_EVENT/);
    const blocked = await fetch(`${base}/api/generate`, { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: JSON.stringify(input) });
    assert.equal(blocked.status, 403);
  } finally { child.kill(); await once(child, 'exit'); }
});
