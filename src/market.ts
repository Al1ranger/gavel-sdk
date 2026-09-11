import type { MarketSpec } from './client.ts';

export function normalizeMarketSpec(input: MarketSpec): MarketSpec {
  if (!input || typeof input !== 'object') throw new Error('A MarketSpec object is required.');
  const marketId = String(input.marketId ?? '').trim().toUpperCase();
  const question = String(input.question ?? '').trim();
  if (!/^[A-Z0-9_-]{4,64}$/.test(marketId)) throw new Error('Market ID must contain 4-64 letters, digits, hyphens or underscores.');
  if (question.length < 10 || question.length > 500) throw new Error('Question must contain 10-500 characters.');
  if (!Array.isArray(input.outcomes) || input.outcomes.length < 2 || input.outcomes.length > 16) throw new Error('Register 2-16 outcomes.');
  const outcomes = input.outcomes.map((item, index) => {
    const id = String(item.id ?? '').trim().toUpperCase();
    const label = String(item.label ?? '').trim();
    if (item.index !== index || !id || !label || id === 'UNRESOLVED') throw new Error('Outcomes need contiguous indexes and labels. UNRESOLVED is reserved.');
    return { id, index, label };
  });
  if (new Set(outcomes.map(item => item.id)).size !== outcomes.length) throw new Error('Outcome IDs must be unique.');
  if (!Array.isArray(input.resolutionRules) || !input.resolutionRules.length) throw new Error('Resolution rules are required.');
  const resolutionRules = input.resolutionRules.map(rule => String(rule).trim());
  if (resolutionRules.some(rule => !rule)) throw new Error('Rules cannot be empty.');
  if (!Number.isSafeInteger(input.resolutionTime) || input.resolutionTime <= 0) throw new Error('Resolution time must be positive Unix seconds.');
  if (!Array.isArray(input.approvedSources) || input.approvedSources.length < 1 || input.approvedSources.length > 8) throw new Error('Register 1-8 exact HTTPS sources.');
  const approvedSources = input.approvedSources.map(source => String(source).trim()).sort();
  for (const source of approvedSources) {
    let url: URL;
    try { url = new URL(source); } catch { throw new Error('Evidence sources must be valid HTTPS URLs.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Evidence sources must be HTTPS URLs without credentials.');
  }
  if (new Set(approvedSources).size !== approvedSources.length) throw new Error('Evidence sources must be unique.');
  if (!input.sourcePolicy || typeof input.sourcePolicy !== 'object' || Array.isArray(input.sourcePolicy)) throw new Error('Source policy must be a JSON object.');
  return { approvedSources, marketId, outcomes, question, resolutionRules, resolutionTime: input.resolutionTime, sourcePolicy: input.sourcePolicy };
}
export function serializeMarketSpec(input: MarketSpec): string { return JSON.stringify(normalizeMarketSpec(input), null, 2); }
