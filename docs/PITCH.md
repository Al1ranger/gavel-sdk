# Gavel hackathon pitch

## Opening

Prediction markets are easy to price and hard to resolve. A quoted probability tells you what traders believe. It does not tell you which evidence should decide the final outcome.

Gavel makes that agreement explicit before resolution: the question, outcomes, deadline, exact evidence sources, and required criteria become an immutable GenLayer contract.

## Demonstration

Open Evidence Lab and inspect a live Polymarket quote. Switch between probability and decimal odds. Explain that this is market data, not a verdict.

Create an independent event market with an authoritative public API. Download the specification and generated contract. Show the required completed-event criterion and the UNRESOLVED fallback.

If a real GenLayer test deployment is available, display its transaction and verdict. Otherwise show the passing direct-contract tests and state clearly that live consensus is still pending.

## Why GenLayer

For judgments involving external evidence, validators independently retrieve and reason over registered sources. Consensus compares the outcome rather than wording. Missing or conflicting evidence can remain unresolved. Applications wait for successful finality before settlement.

## Who uses it

Market teams integrate the TypeScript SDK instead of maintaining a private winner-setting backend. The same market specification drives evidence collection, contract generation, and audit records. Optional courts provide a path for arguments, evidence submissions, and appeals.

## Honest close

The current demo delivers live market discovery, API evidence configuration, generated intelligent contracts, and local contract validation. The next proof point is a recorded end-to-end testnet resolution. No hackathon result, partnership, trading profitability, or production-readiness guarantee is claimed.
