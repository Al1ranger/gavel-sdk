# Gavel backend developer workflow

Gavel provides API evidence previews, market validation, intelligent-contract generation, resolver and court clients, odds normalization, and finality-aware result formatting.

## Local development

```sh
npm ci
npm run build
node bin/gavel.mjs help
npm test
```

After installing the package, use `gavel` directly. npm publication is separate from the GitHub repository.

## API evidence

```json
{
  "request": {
    "url": "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1",
    "path": [0, "question"]
  },
  "allowedOrigins": ["https://gamma-api.polymarket.com"],
  "timeoutMs": 30000
}
```

Save as request.json and run `gavel api request.json`. GET and POST previews support JSON field paths and byte/time limits. These are off-chain observations; validators independently retrieve registered public GET sources. Never compile private API credentials into a contract.

## Contract generation

`gavel generate input.json resolver.py` accepts the SDK's GenerateInput shape: `{ spec, shape, features? }`. It refuses to overwrite files. Generation is not deployment. Validate generated Python with GenVM lint and direct tests before using a configured test environment for real consensus.

## Resolver inspection

Set GAVEL_CONTRACT_ADDRESS, GAVEL_NETWORK and GENLAYER_RPC_URL. Use `gavel markets`, `gavel market ID`, `gavel verdict ID`, and `gavel transaction HASH`. Verdict reads are explicitly unverified for finality. Market prices, model confidence, and accepted transactions are not settlement proof.

For writes, applications construct Gavel with their own signer. Keep that signer in your application's secret management. The CLI deliberately performs no signing, payouts, or funds custody.

## Integration boundary

Use predictionResult only with authenticated contract data and a transaction known to resolve that market. It checks market/spec identity and withholds payout weights until successful finality. It does not authenticate arbitrary supplied objects. UNRESOLVED never becomes a forced winner.

## Verified and pending

Public Polymarket access and local generated-contract validation were tested previously; see VERIFICATION.md. A complete live deployment-to-finalized-verdict demonstration still requires an accessible GenLayer environment and an authorized signer. It is not yet verified.

## Current deployment reference

Package: `gavel-judgment-sdk@0.1.3`. For chain **61997**, use the [Studio Next guide](STUDIO-NEXT.md) and [verified deployment proof](deployments/studio-next-earthquake.json). Deployment and reads are verified; judgment resolution has not yet been executed. [Release notes](RELEASE-NOTES.md).
