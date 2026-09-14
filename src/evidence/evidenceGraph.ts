import { requireThat } from '../api/types.ts';
import { verifyEvidence, type EvidenceVerificationPolicy } from './verifier.ts';
import type { EvidenceClaim } from './evidenceFetcher.ts';
import { hashJSON } from './normalizer.ts';

/** Append-only DAG; hashes detect duplicates but do not certify publishers. */
export class EvidenceGraph {
  private readonly nodes = new Map<string, EvidenceClaim>();
  private readonly contents = new Set<string>();
  add(claim: EvidenceClaim, policy: EvidenceVerificationPolicy): string {
    verifyEvidence(claim, policy);
    requireThat(this.nodes.size < 10000, 'GRAPH_FULL', 'Evidence graph limit reached.');
    requireThat(!this.nodes.has(claim.id) && !this.contents.has(claim.contentHash), 'DUPLICATE_EVIDENCE', 'Duplicate evidence ID or normalized content.');
    requireThat(claim.relatedClaims.every(id => this.nodes.has(id)), 'MISSING_PARENT', 'Related claims must already exist.');
    this.nodes.set(claim.id, structuredClone(claim)); this.contents.add(claim.contentHash);
    return claim.id;
  }
  list(): EvidenceClaim[] { return structuredClone([...this.nodes.values()]); }
  digest(): string { return hashJSON(this.list().sort((a, b) => a.id.localeCompare(b.id))); }
}
