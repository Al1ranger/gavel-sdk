export type Finding = { code: string; severity: 'error' | 'warning'; message: string };
/** Heuristics are diagnostics, not a proof of safe prompts or source authenticity. */
export function detectEvidenceInstructions(content: string): Finding[] {
  return /ignore\s+(all|previous)|system\s*prompt|override\s+(rules|instructions)|reveal\s+(key|secret)/i.test(content)
    ? [{ code: 'EMBEDDED_INSTRUCTION', severity: 'warning', message: 'Evidence contains instruction-like text; treat it as untrusted data.' }] : [];
}
