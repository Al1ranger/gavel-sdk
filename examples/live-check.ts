import { readApi, PUBLIC_DEMO_SOURCES, polymarketJournalContract } from '../dist/index.js';

const checks = [
  { name: 'Polymarket quotes', url: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1', validate: (x: any) => Array.isArray(x) && x.length > 0 && typeof x[0].question === 'string' },
  { name: 'USGS reviewed evidence', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000m9g4.geojson', validate: (x: any) => x?.id === 'us7000m9g4' && typeof x.properties?.mag === 'number' },
  { name: 'Open-Meteo historical measurement', url: PUBLIC_DEMO_SOURCES.weather, validate: (x: any) => x?.daily?.time?.[0] === '2024-07-01' && Number.isFinite(x?.daily?.temperature_2m_max?.[0]) && x?.daily_units?.temperature_2m_max === '°C' },
];
for (const check of checks) {
  try {
    const data = await readApi({ url: check.url }, { allowedOrigins: [new URL(check.url).origin], timeoutMs: 10000 });
    if (!check.validate(data)) throw new Error('Unexpected response schema');
    console.log(JSON.stringify({ name: check.name, status: 'PASS', observedAt: new Date().toISOString(), consensusVerified: false }));
    if (check.name === 'Polymarket quotes') {
      const market = (data as any[])[0];
      const labels = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
      const generated = polymarketJournalContract(String(market.id), labels);
      const source = (generated.compiledSpec.evidence as any).sources[0];
      const detail = await readApi({ url: source.url }, { allowedOrigins: ['https://gamma-api.polymarket.com'], timeoutMs: 10000 }) as any;
      if (String(detail.id) !== String(market.id)) throw new Error('Live market identity mismatch');
      console.log(JSON.stringify({ name: 'Pinned live odds-journal generation', marketId: market.id, className: generated.className, deployed: false, consensusVerified: false }));
    }
  } catch (error) {
    console.log(JSON.stringify({ name: check.name, status: 'FAIL', reason: error instanceof Error ? error.message : String(error), consensusVerified: false }));
    process.exitCode = 1;
  }
}
