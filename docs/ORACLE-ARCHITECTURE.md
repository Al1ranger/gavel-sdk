# Gavel backend trust boundary

The SDK configures immutable rules and public evidence URLs. It may preview APIs
and format odds, but cannot supply an authoritative answer to a deployed oracle.

Resolve request -> contract-side HTTP acquisition -> bounded normalization and
identity checks -> independent validator acquisition/evaluation -> consequential
field comparison -> evidence-bound state -> finality-aware application read.

## Three workflows, not three renamed submissions

1. **Adjudicated event resolver:** immutable finite outcomes; independent AI
   evaluation of rules and required criteria; bounded retry history for unresolved
   evidence; one terminal resolved outcome. Confidence is an adjudication gate,
   not the event probability.
2. **Scalar observation oracle:** exact scaled measurement, interval bounds and
   complementary payout weights; no AI arithmetic and no winner classification.
   It terminates on a verified observation, not a certificate consumption call.
3. **Odds observation journal:** append-only, rate-limited snapshots of quoted
   outcome prices with exact source identity and normalization. It never resolves
   the underlying event or transfers funds. Numerical API consensus does not need
   a language model; do not claim that it predicts the future.

These share an evidence-acquisition library intentionally. Examples within a
workflow are configuration variants, not independently novel hackathon entries.

## Security requirements

- Each validator fetches the evidence itself and sees normalized contents, not
  only a hash or the caller's summary. Verdicts retain that evidence and a digest.
- URLs and projection rules are fixed at generation; no resolve-time URLs,
  arbitrary expressions, private API keys or self-reported trace inputs.
- Source authority is an explicit deployment trust assumption. HTTPS and repeated
  fetches do not prove a publisher truthful or eliminate DNS rebinding. Operators
  must apply network egress controls; provider redirects must not escape them.
- Missing, oversized, malformed, identity-mismatched or hash-mismatched evidence
  cannot produce a resolved result. Content is rejected, never silently truncated.
- AI confidence gates and every required criterion must agree independently.
  Tolerance cannot bridge an approval threshold. Prompt isolation reduces risk;
  it is not a proof of prompt-injection immunity.
- External API corrections can prevent consensus. Pin stable fields or immutable
  snapshots. A matching digest proves agreement on selected content, not truth.
- Outputs describe adjudication or payout weights, not executed settlement.
  Application escrow, cross-chain proofs and actual transfers are out of scope.
- Accepted/finalized transactions can contain execution errors. Consumers need a
  successful finalized transaction bound to the expected contract and market.

Local direct tests run a leader with mocked HTTP/model responses. Explicit
validator-callback tests exercise comparison logic but are not network consensus.
Live integration is a separate opt-in check against a configured GenLayer node.

## Current deployment reference

Package: `gavel-judgment-sdk@0.1.2`. For chain **61997**, use the [Studio Next guide](STUDIO-NEXT.md) and [verified deployment proof](deployments/studio-next-earthquake.json). Deployment and reads are verified; judgment resolution has not yet been executed. [Release notes](RELEASE-NOTES.md).
