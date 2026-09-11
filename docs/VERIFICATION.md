# Example verification

Observed 2026-09-11.

| Check | Result |
| --- | --- |
| SDK automated tests | 7 passed |
| Live Polymarket market-list schema | PASS at 22:04:33 UTC |
| Live USGS event API | Fetch failed in this environment |
| Generated-contract direct tests | 3 passed: required review accepted, missing review unresolved, invalid winner rejected |
| Live GenLayer consensus | Not verified; requires reachable GenLayer environment and signer |

The Polymarket pass verifies live API access and basic market schema, not price accuracy, trading access, settlement, or a GenLayer verdict. Re-run `node examples/live-check.ts` for current connectivity.
