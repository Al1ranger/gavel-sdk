import { readApi, normalizeOdds } from '../dist/index.js';

// Live quotes are observations, never proof of a resolved outcome.
const payload = await readApi({ url: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=3' }, { allowedOrigins: ['https://gamma-api.polymarket.com'] });
if (!Array.isArray(payload)) throw new Error('Expected a market array.');
for (const market of payload) {
  const labels = JSON.parse(market.outcomes);
  const prices = JSON.parse(market.outcomePrices);
  if (!Array.isArray(labels) || !Array.isArray(prices) || labels.length !== prices.length) throw new Error('Invalid market odds.');
  const outcomes = labels.map((label, index) => ({ id: `OUTCOME_${index}`, index, label: String(label) }));
  const odds = normalizeOdds({ format: 'PROBABILITY', outcomes: prices.map((value, index) => ({ outcomeId: `OUTCOME_${index}`, value })) }, outcomes);
  console.log(JSON.stringify({ source: 'Polymarket Gamma', id: market.id, question: market.question, observedAt: new Date().toISOString(), outcomes, odds, settlementReady: false }, null, 2));
}
