import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readApi, createApiMarket, generateIntelligentContract, normalizeOdds, createGavelClient } from '../dist/index.js';

const port = Number(process.env.PORT || 3100);
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
let cache;
async function markets() {
  if (cache && Date.now() - cache.time < 60000) return cache.value;
  const data = await readApi({ url: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20' }, { allowedOrigins: ['https://gamma-api.polymarket.com'], timeoutMs: 30000 });
  if (!Array.isArray(data)) throw new Error('Market provider returned an invalid response.');
  const results = [];
  for (const market of data) {
    try {
      const labels = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
      const prices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices;
      if (!Array.isArray(labels) || !Array.isArray(prices) || labels.length < 2) continue;
      const outcomes = labels.map((label, index) => ({ id: `OUTCOME_${index}`, index, label: String(label) }));
      const odds = normalizeOdds({ format: 'PROBABILITY', outcomes: prices.map((value, index) => ({ outcomeId: `OUTCOME_${index}`, value })) }, outcomes);
      results.push({ id: String(market.id), question: String(market.question), outcomes, odds, endDate: market.endDate || null });
    } catch { /* Malformed provider entries are excluded, never invented. */ }
  }
  const value = { source: 'Polymarket Gamma', observedAt: new Date().toISOString(), markets: results };
  cache = { time: Date.now(), value };
  return value;
}
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 32768) throw new Error('Request too large.'); }
  return JSON.parse(text);
}
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && files[path]) {
      const [name, type] = files[path];
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(await readFile(fileURLToPath(new URL(name, import.meta.url)))); return;
    }
    if (req.method === 'GET' && path === '/api/markets') return send(200, await markets());
    if (req.method === 'GET' && path === '/api/resolver') {
      const address = process.env.GAVEL_CONTRACT_ADDRESS;
      if (!address) return send(200, { configured: false, markets: [], message: 'Resolver address is not configured.' });
      const client = createGavelClient({ network: process.env.GAVEL_NETWORK || 'localnet', contractAddress: address, rpcUrl: process.env.GENLAYER_RPC_URL });
      const ids = await client.listMarketIds();
      const records = await Promise.all(ids.slice(0, 10).map(async id => {
        const market = await client.getMarket(id);
        try { return { market, verdict: await client.getVerdict(id), finality: 'UNVERIFIED', settlementReady: false }; }
        catch { return { market, verdict: null, finality: 'UNVERIFIED', settlementReady: false }; }
      }));
      return send(200, { configured: true, markets: records, totalMarkets: ids.length, message: 'Registry and verdict reads succeeded. Finality is unverified; settlement is disabled in this demo.' });
    }
    if (req.method === 'POST' && path === '/api/generate') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: 'Cross-origin request rejected.' });
      const input = await body(req);
      const spec = createApiMarket({ marketId: input.marketId, question: input.question, outcomes: [{ id: 'YES', index: 0, label: 'Yes' }, { id: 'NO', index: 1, label: 'No' }], resolutionTime: Math.floor(Date.parse(input.deadline) / 1000), resolutionRules: [input.rule, 'Return UNRESOLVED when evidence is missing, incomplete, or conflicting.'], sourcePolicy: { format: 'JSON', sourceRole: 'Authoritative event evidence' } }, [{ url: input.source, interpretation: input.interpretation }]);
      const contract = generateIntelligentContract({ spec, shape: { kind: 'BINARY' }, features: [{ id: 'FINAL_EVENT', requirement: 'Evidence must describe a completed event, not a forecast or a quoted price.', required: true }] });
      return send(200, { spec, contract });
    }
    send(404, { error: 'Route not found.' });
  } catch (error) { send(502, { error: error instanceof Error ? error.message : 'Request failed.' }); }
});
server.requestTimeout = 35000;
server.listen(port, '127.0.0.1', () => console.log(`Gavel demo: http://127.0.0.1:${port}`));
