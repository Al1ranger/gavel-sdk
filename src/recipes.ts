import { generateIntelligentContract, type GeneratedContract } from './generate.ts';
import { generateScalarOracle, generateOddsJournal } from './oracles.ts';

export const PUBLIC_DEMO_SOURCES = {
  earthquake: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000m9g4.geojson',
  weather: 'https://archive-api.open-meteo.com/v1/archive?latitude=52.52&longitude=13.41&start_date=2024-07-01&end_date=2024-07-01&daily=temperature_2m_max&timezone=UTC',
  gavelRepository: 'https://raw.githubusercontent.com/Al1ranger/gavel-sdk/main/README.md',
} as const;

/** Public delivery proof: validators fetch and evaluate the repository independently. */
export function gavelDeliveryProofContract(): GeneratedContract {
  return generateIntelligentContract({
    spec: {
      marketId: 'GAVEL-SDK-PUBLIC-DELIVERY',
      question: 'Does the published Gavel SDK README document an installable GenLayer SDK with evidence-aware contract generation and StudioNet deployment?',
      outcomes: [
        { id: 'VERIFIED', index: 0, label: 'Public SDK delivery verified' },
        { id: 'NOT_VERIFIED', index: 1, label: 'Public SDK delivery not verified' },
      ],
      resolutionTime: 1757869200,
      approvedSources: [PUBLIC_DEMO_SOURCES.gavelRepository],
      resolutionRules: [
        'VERIFIED only when the acquired README documents npm installation, GenLayer intelligent-contract generation, and StudioNet deployment.',
        'Return NOT_VERIFIED when any required delivery criterion is absent. Return UNRESOLVED when evidence cannot be acquired.',
      ],
      sourcePolicy: { authority: 'GitHub raw content for the public repository', corrections: 'Use the main-branch README acquired during adjudication.' },
    },
    shape: { kind: 'BINARY' },
    features: [
      { id: 'INSTALLABLE_SDK', required: true, requirement: 'Confirm the acquired README contains the npm installation command for @gavel-sdk/core.' },
      { id: 'EVIDENCE_ACQUISITION', required: true, requirement: 'Confirm it documents contract-side evidence acquisition and evidence digests.' },
      { id: 'STUDIONET_DELIVERY', required: true, requirement: 'Confirm it documents deployment with the GenLayer CLI on StudioNet.' },
    ],
    evidence: {
      sources: [{ url: PUBLIC_DEMO_SOURCES.gavelRepository, format: 'text' }],
    },
    minimumConfidenceBps: 8000,
    confidenceToleranceBps: 500,
  });
}

/** Historical demo; values must still be acquired by every contract validator. */
export function earthquakeDemoContract(): GeneratedContract {
  return generateIntelligentContract({
    spec: {
      marketId: 'USGS-REVIEWED-2024',
      question: 'Was USGS earthquake us7000m9g4 reviewed at magnitude 7.4 or above?',
      outcomes: [{ id: 'YES', index: 0, label: 'Reviewed magnitude at least 7.4' }, { id: 'NO', index: 1, label: 'Reviewed magnitude below 7.4' }],
      resolutionTime: 1712188800,
      approvedSources: [PUBLIC_DEMO_SOURCES.earthquake],
      resolutionRules: ['Use only the matching USGS event, with reviewed status and a numeric magnitude.', 'YES when magnitude >= 7.4; NO when magnitude < 7.4. Missing or conflicting evidence is UNRESOLVED.'],
      sourcePolicy: { authority: 'USGS', corrections: 'Reviewed magnitude available at adjudication; not the initial estimate.' },
    },
    shape: { kind: 'BINARY' },
    features: [{ id: 'REVIEWED', required: true, requirement: 'Independently confirm that the event is reviewed, not preliminary or automatic.' }],
    evidence: { sources: [{ url: PUBLIC_DEMO_SOURCES.earthquake, format: 'json', fields: { eventId: ['id'], magnitude: ['properties', 'mag'], reviewStatus: ['properties', 'status'] }, expect: { eventId: 'us7000m9g4', reviewStatus: 'reviewed' } }] },
    minimumConfidenceBps: 8000,
    confidenceToleranceBps: 250,
  });
}

/** A continuous weather-index payout, not a binary resolver with a different name. */
export function weatherDemoContract(): GeneratedContract {
  return generateScalarOracle({
    id: 'BERLIN-TEMPERATURE-20240701',
    source: { url: PUBLIC_DEMO_SOURCES.weather, format: 'json', fields: { date: ['daily', 'time', 0], maximum: ['daily', 'temperature_2m_max', 0], unit: ['daily_units', 'temperature_2m_max'] }, expect: { date: '2024-07-01', unit: '°C' } },
    valueField: 'maximum', decimals: 1, lower: 100, upper: 400, resolutionTime: 1719878400,
  });
}

/** Caller chooses one exact Gamma market ID and exact ordered labels before deploy. */
export function polymarketJournalContract(marketId: string, outcomeLabels: string[]): GeneratedContract {
  if (!/^[0-9]{1,20}$/.test(marketId)) throw new Error('Gamma marketId must be a numeric string.');
  return generateOddsJournal({
    id: `POLYMARKET-${marketId}`,
    source: { url: `https://gamma-api.polymarket.com/markets/${marketId}`, format: 'json', fields: { marketId: ['id'], prices: ['outcomePrices'], labels: ['outcomes'] }, expect: { marketId } },
    pricesField: 'prices', outcomesField: 'labels', outcomeLabels,
  });
}
