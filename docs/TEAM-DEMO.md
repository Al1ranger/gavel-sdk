# Gavel team demo

**Pitch:** Build prediction-market resolution around public evidence, immutable rules, and independent GenLayer validators.

## Five-minute walkthrough

For the interactive version run `npm run build` then `npm run demo`, and open http://127.0.0.1:3100. Search live markets, switch odds formats, generate a market specification, and download its Python resolver. The protocol panel reads the configured registry without signing transactions.

1. Run `npm run build && npm test` to verify the SDK.
2. Run `node examples/polymarket.ts` to inspect real market quotes. Prices remain observations, not resolution evidence.
3. Run `node examples/live-check.ts` to check both public API connections. Failures remain visible.
4. Run `node examples/earthquake-contract.ts` to inspect a generated binary-market contract with a mandatory reviewed-evidence criterion.
5. Deploy that contract to your configured GenLayer test environment, invoke `resolve`, and inspect the actual receipt and verdict. Do not present this step as completed without a successful live run.

## Features to demonstrate

For local contract validation, install `python -m pip install -r requirements-dev.txt` and run `python -m pytest test/test_generated_contract.py -q`. This deploys the generated source in the direct test VM and checks synthetic result validation; it does not run live validator consensus.

| Capability | Demonstration |
| --- | --- |
| API integration | GET/POST JSON previews, field selection, allowlists and response limits |
| Real market odds | Polymarket probability quotes mapped to registered outcome IDs |
| Market formats | Binary, categorical, scalar buckets; four odds conventions |
| Immutable rules | Generated contract embeds its exact specification |
| Required criteria | Missing reviewed-source criterion forces UNRESOLVED |
| Consensus design | Validators independently retrieve and evaluate evidence |
| Settlement output | Payout weights withheld for provisional or unresolved results |
| Disputes | Optional court, argument, evidence and appeal interfaces |

No partnership with Polymarket or USGS is implied. No trading, profitability, production audit, or live consensus claim is made. Market creators must select authoritative sources and define correction/finality policies before registration.
