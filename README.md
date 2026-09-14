# Gavel SDK

**Evidence-aware prediction markets and intelligent oracles for GenLayer.**

Gavel turns a typed JavaScript specification into a pinned, deployable GenLayer intelligent contract. Validators retrieve approved public evidence independently, reach consensus, and persist the result with its specification hash and evidence digest.

## Install

```bash
npm i @gavel-sdk/core
```

Node.js 22.13 or newer is required.

## Generate an intelligent contract

```ts
import { writeFile } from 'node:fs/promises';
import { earthquakeDemoContract } from '@gavel-sdk/core/contracts';

const generated = earthquakeDemoContract();
await writeFile('earthquake_resolver.py', generated.source);
await writeFile('earthquake_resolver.json', JSON.stringify(generated.compiledSpec, null, 2));
```

The generated Python contract pins a concrete GenVM runner, restricts evidence to explicit HTTPS origins, and stores deterministic hashes that clients can verify.

## Build a custom market

```ts
import { generateIntelligentContract } from '@gavel-sdk/core/contracts';

const contract = generateIntelligentContract({
  className: 'GavelElectionResolver',
  spec: {
    marketId: 'CERTIFIED-ELECTION',
    question: 'Did candidate A win the certified election?',
    outcomes: [
      { id: 'YES', index: 0, label: 'Candidate A won' },
      { id: 'NO', index: 1, label: 'Candidate A did not win' },
    ],
    resolutionRules: ['Use the final certified result. Return UNRESOLVED on conflict.'],
    resolutionTime: 1782864000,
    approvedSources: ['https://results.example.gov/final.json'],
    sourcePolicy: { authority: 'Official election authority' },
  },
  shape: { kind: 'BINARY' },
  evidence: {
    sources: [{ url: 'https://results.example.gov/final.json' }],
  },
});
```

## Oracle modes

| Generator | Result | Use case |
| --- | --- | --- |
| `generateIntelligentContract` | Categorical verdict | Prediction markets, claims, event resolution |
| `generateScalarOracle` | Numeric observation and payout weights | Temperature, rainfall, prices, indexes |
| `generateOddsJournal` | Consensus odds snapshots | Auditable market history and agent signals |

`gavelDeliveryProofContract()` is a reproducible proof recipe that acquires the public SDK README inside the nondeterministic flow and binds validator agreement to its normalized evidence digest and approval decision.

`createOracleClient` reads contract state and defaults to finalized results. API helpers build evidence policies and preview public JSON. Platform modules add lifecycle certificates, validator consensus, evidence graphs, simulation, replay, and contract auditing.

## Deploy with GenLayer CLI

```bash
npm run build
npm run generate:examples
genlayer network set studionet
genlayer deploy --contract artifacts/studionet-samples/usgs_reviewed_2024_resolver.py
genlayer deploy --contract artifacts/studionet-samples/berlin-temperature-20240701_scalaroracle.py
```

Two SDK-generated examples are live on GenLayer StudioNet. Addresses, transaction hashes, and verification commands are in [StudioNet deployments](docs/STUDIONET-DEPLOYMENTS.md).

## Architecture

```text
gavel-sdk/
├── bin/                     CLI entry point
├── demo/                    Local product demo
├── docs/                    Architecture, oracle, backend, deployment guides
├── examples/                Generation and live API examples
├── src/
│   ├── api/                 Typed backend API client
│   ├── core/                Lifecycle, certificates, events, contract engine
│   ├── evidence/            Fetch, normalize, verify, provenance graph
│   ├── markets/             Binary, scalar, continuous, odds primitives
│   ├── oracle/              Validators, consensus, confidence, reputation
│   ├── security/            Audit and attack detection
│   ├── simulation/          Adversarial simulation and replay
│   ├── contracts.ts         Stable contract-generation exports
│   ├── generate.ts          Categorical contract generator
│   ├── oracles.ts           Scalar and odds-journal generators
│   └── oracleClient.ts      Finality-aware onchain reader
└── test/                    TypeScript, Python, browser, integration tests
```

See [oracle architecture](docs/ORACLE-ARCHITECTURE.md), [oracle API](docs/ORACLES.md), and [backend integration](docs/BACKEND.md).

## Trust model

- Installing the SDK does not deploy a contract or prove an external fact.
- An evidence digest proves which normalized evidence was used; validator consensus determines the accepted result.
- `ACCEPTED` and `FINALIZED` are distinct lifecycle states. Settlement code must wait for successful finalization.
- `UNRESOLVED` is a valid result and must never be treated as a winning outcome.
- The SDK never creates, stores, or exposes wallet private keys.

## Development

```bash
npm ci
npm run build
npm test
npm run test:contracts
npm pack --dry-run
```

License: MIT
