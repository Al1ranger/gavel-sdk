# Gavel for prediction-market teams

Connect public evidence to auditable resolution workflows on GenLayer.

- Read JSON APIs with GET/POST, runtime headers, field selection, timeouts, byte limits, and explicit origin allowlists.
- Build immutable API-backed market specifications from public HTTPS evidence and interpretation rules.
- Generate GenLayer contracts with independent validator reasoning and required judging criteria.
- Display binary, categorical, or scalar-bucket markets with probability, decimal, fractional, or American odds.
- Format verdicts into terminal payout weights only after successful finality; preserve UNRESOLVED.
- Extend into evidence submissions, arguments, courts, and appeals.

API previews are off-chain. Current generated contracts fetch public GET URLs. Authenticated POST previews are not automatically available to validators; never embed secret API keys in a contract. Server applications must enforce trusted destination policies including DNS/IP restrictions for their deployment.

Gavel does not set Polymarket outcomes, place trades, or generate predictive probabilities from a resolved outcome. Quotes and settlement are separate records. `predictionResult` formats supplied data; the caller must authenticate the contract, transaction-to-market association, and finality through GenLayer before distributing funds.

## Real API example

Build, then run `node examples/polymarket.ts`. It fetches three live markets and converts their quoted outcome prices. API failure fails the example; no fixture replaces live data.

Reference: https://docs.polymarket.com/api-reference/markets/list-markets

## GenLayer testing

Use `createApiMarket` with an event-specific public API endpoint and precise final-state rules, then pass the spec to `generateIntelligentContract`. Deploy the emitted source to Studio or a testnet and invoke `resolve`. Independent validators fetch evidence themselves. Read `get_verdict` only after checking transaction state. A successful API preview or unit test is not a live consensus test.

Live deployment requires a reachable GenLayer environment and signer. No live consensus claim is made by these examples.
