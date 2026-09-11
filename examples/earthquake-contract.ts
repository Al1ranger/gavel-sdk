import { createApiMarket, generateIntelligentContract } from '../dist/index.js';

// A historical, binary market using a stable event-specific public USGS feed.
// Generation does not deploy or claim a consensus verdict.
const spec = createApiMarket({
  marketId: 'USGS-2024-001',
  question: 'Did USGS record magnitude 7.4 or higher for earthquake us7000m9g4?',
  outcomes: [{ index: 0, id: 'YES', label: 'Magnitude at least 7.4' }, { index: 1, id: 'NO', label: 'Magnitude below 7.4' }],
  resolutionTime: 1712188800,
  resolutionRules: ['YES if properties.mag is a number greater than or equal to 7.4; NO if lower.', 'Return UNRESOLVED if the event ID differs, magnitude is missing, or data is unavailable.'],
  sourcePolicy: { eventId: 'us7000m9g4', provider: 'USGS', corrections: 'Use the reviewed value returned at adjudication time.' },
}, [{ url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000m9g4.geojson', interpretation: 'Read id, properties.mag and properties.status. Require id us7000m9g4 and reviewed status.' }]);

const contract = generateIntelligentContract({ spec, shape: { kind: 'BINARY' }, features: [{ id: 'REVIEWED', requirement: 'USGS properties.status must equal reviewed.', required: true }] });
console.log(contract.source);
