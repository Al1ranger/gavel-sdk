# Studio Next developer guide

Network: Studio-dev / Studio Next, chain ID **61997**. RPC: https://studio-dev.genlayer.com/api. Explorer: https://explorer-studio-dev.genlayer.com.

## Install and generate

Node.js 22.13 or newer is required. Install with `npm install gavel-judgment-sdk`. npm version 0.1.3 includes the tested fixes. To use those fixes now, clone this repository, run `npm ci`, `npm run build`, then `npm pack` and install that tarball in your application.

Save this as `generate.mjs` and run `node generate.mjs`:

```js
import { writeFile } from 'node:fs/promises';
import { earthquakeDemoContract } from 'gavel-judgment-sdk/contracts';
const contract = earthquakeDemoContract();
await writeFile('earthquake_resolver.py', contract.source);
await writeFile('earthquake_resolver.json', JSON.stringify(contract.compiledSpec, null, 2));
```

## Prepare and deploy

```sh
npx gavel prepare-studio-next earthquake_resolver.py studio-next-deployment
cd studio-next-deployment
npx --yes genlayer@0.40.0-rc.3 network set studio-dev
npx --yes genlayer@0.40.0-rc.3 account list
npx --yes genlayer@0.40.0-rc.3 deploy
```

Select and unlock your own account using GenLayer CLI before deploying. The script adds the pinned runtime header, verifies chain 61997, estimates fees, submits a zero-argument contract, and saves `transaction.json`. The fee allocation is a development preset; review it for your contract.

## Pending transactions and RPC failures

`PROPOSING` / `NOT_VOTED` is not a successful deployment or proof of failure. Preserve the deployment directory and transaction hash. Inspect that same transaction with:

```sh
npx --yes genlayer@0.40.0-rc.3 receipt 0x6760f2f13aa7861cbaddb830811c01b4d9868724ac04bfbc717eb082c68b4a3c
```

Do not create a new deployment directory merely because polling failed. The generated script resumes a saved transaction only when its source hash and chain match. Deployment success requires both `FINALIZED` and `FINISHED_WITH_RETURN`. A finalized execution error is a failed deployment.

## Verified example

[USGS earthquake resolver](https://explorer-studio-dev.genlayer.com/address/0xA059bF529c15fDd69ad5320F80DFd04bfc24A2F4) — chain **61997**.

Transaction: `0x6760f2f13aa7861cbaddb830811c01b4d9868724ac04bfbc717eb082c68b4a3c`.

```sh
npx --yes genlayer@0.40.0-rc.3 call 0xA059bF529c15fDd69ad5320F80DFd04bfc24A2F4 get_progress
```

Verified response: `{ attempts: 0, maxAttempts: 8, resolved: false }`. Deployment and reads work; judgment resolution has not been executed. [Machine-readable proof](deployments/studio-next-earthquake.json).

## TypeScript and errors

Version 0.1.2 public declarations pass strict TypeScript without `skipLibCheck`. The regression suite has 150 passing tests. Version 0.1.1 still has the upstream declaration issue. Preparation errors identify missing contract files and existing output directories. Windows CRLF runtime headers are supported. Never put private keys in generated source, documentation, or transaction proof files.
