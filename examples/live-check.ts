import { readApi } from '../dist/index.js';

const checks = [
  { name: 'Polymarket quotes', url: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1', validate: (x: any) => Array.isArray(x) && x.length > 0 && typeof x[0].question === 'string' },
  { name: 'USGS reviewed evidence', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000m9g4.geojson', validate: (x: any) => x?.id === 'us7000m9g4' && typeof x.properties?.mag === 'number' },
];
for (const check of checks) {
  try {
    const data = await readApi({ url: check.url }, { allowedOrigins: [new URL(check.url).origin], timeoutMs: 30000 });
    if (!check.validate(data)) throw new Error('Unexpected response schema');
    console.log(JSON.stringify({ name: check.name, status: 'PASS', observedAt: new Date().toISOString(), consensusVerified: false }));
  } catch (error) {
    console.log(JSON.stringify({ name: check.name, status: 'FAIL', reason: error instanceof Error ? error.message : String(error), consensusVerified: false }));
    process.exitCode = 1;
  }
}
