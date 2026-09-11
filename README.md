# Gavel SDK

TypeScript SDK for prediction market resolution through GenLayer, with optional court, evidence, argument, and appeal workflows.

## Install

After this package is published to npm:

```sh
npm i @gavel-sdk/core
```

Until publication, build this repository and install its generated tarball:

```sh
npm install
npm pack
npm install ./gavel-sdk-core-0.1.0.tgz
```

## Read a market

```ts
import { Gavel } from '@gavel-sdk/core';

const gavel = new Gavel({
  network: 'localnet',
  contractAddress: '0xYOUR_DEPLOYED_RESOLVER_ADDRESS',
  rpcUrl: 'http://127.0.0.1:4000/api',
});

const market = await gavel.getMarket('GAV-0001');
const verdict = await gavel.getVerdict(market.spec.marketId);
```

Replace the address with a deployed Gavel resolver. No deployment or live consensus is implied by installing the package.

## Register and resolve

Configure an account and wallet provider for writes. Server agents can instead supply a signer through secure runtime configuration. Never ship an agent private key to the browser.

`createMarket(spec)` accepts a MarketSpec containing `marketId`, `question`, ordered `outcomes`, `resolutionRules`, `resolutionTime` (Unix seconds), exact HTTPS `approvedSources`, and a `sourcePolicy` object. `normalizeMarketSpec` validates and normalizes this data before registration.

`resolve(marketId)` requests adjudication. Write methods return a transaction hash and `SUBMITTED` status; they do not claim that consensus or settlement has completed.

## Finality

`getVerdict` reads provisional state. `getFinalVerdict(marketId, transactionHash)` waits for successful finalized execution and reads final contract state. `UNRESOLVED` is valid and must not be treated as a winning outcome. Applications remain responsible for matching the resolution transaction to their market before paying out.

## Optional courts

Pass `courtAddress` to enable `createCourt`, `createCase`, evidence and argument submissions, verdict requests, and appeals. The deployed contract remains the authority for eligibility, timing, and finality.

## Development

```sh
npm install
npm run build
npm test
npm pack --dry-run
```

The package ships compiled ESM and TypeScript declarations. It does not require consumers to transpile TypeScript dependencies.
