import { normalizeMarketSpec } from './market.ts';
import type { MarketSpec } from './client.ts';

export type ApiRequest = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  /** JSON object keys or array indexes; no expressions are evaluated. */
  path?: Array<string | number>;
};

function httpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Use HTTPS without URL credentials or fragments.');
  return url.href;
}

/** Off-chain preview only. Callers must restrict allowed URLs at their server boundary. */
export async function readApi(request: ApiRequest, options: { allowedOrigins: string[]; timeoutMs?: number; maxBytes?: number; fetch?: typeof fetch }): Promise<unknown> {
  const url = httpsUrl(request.url);
  if (!options.allowedOrigins.includes(new URL(url).origin)) throw new Error('API origin is not allowed.');
  const maxBytes = options.maxBytes ?? 1_048_576;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Limits must be positive integers.');
  if (request.method && !['GET', 'POST'].includes(request.method)) throw new Error('Unsupported API method.');
  if (request.body !== undefined && request.method !== 'POST') throw new Error('A request body requires POST.');
  const response = await (options.fetch ?? fetch)(url, {
    method: request.method ?? 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}), ...request.headers },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
  if (!response.ok) throw new Error(`API returned HTTP ${response.status}.`);
  if (!response.body) throw new Error('API response has no body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '', size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new Error('API response exceeds byte limit.');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel(); reader.releaseLock(); }
  let value: unknown = JSON.parse(text);
  for (const key of request.path ?? []) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new Error('API field is missing.');
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}

/** Existing Gavel resolvers independently GET these public API URLs as evidence. */
export function createApiMarket(input: Omit<MarketSpec, 'approvedSources'>, sources: Array<{ url: string; interpretation: string }>): MarketSpec {
  if (!sources.length || sources.some(source => !source.interpretation.trim())) throw new Error('API sources require interpretation rules.');
  return normalizeMarketSpec({ ...input, approvedSources: sources.map(source => httpsUrl(source.url)),
    resolutionRules: [...input.resolutionRules, ...sources.map(source => `API ${httpsUrl(source.url)}: ${source.interpretation.trim()}`)],
  });
}
