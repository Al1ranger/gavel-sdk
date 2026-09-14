import type { Finding } from './attackDetection.ts';
export type AuditReport = { findings: Finding[]; automatedChecksPassed: boolean; securityCertified: false; requires: string[] };
/** Conservative source checks. Run GenVM lint and an independent audit separately. */
export function scanContract(source: string): AuditReport {
  const findings: Finding[] = [];
  const check = (ok: boolean, code: string, message: string) => { if (!ok) findings.push({ code, severity: 'error', message }); };
  check(/^#.*py-genlayer:[a-z0-9]{40,}/.test(source), 'RUNNER_UNPINNED', 'Pin a concrete GenVM runner.');
  check(source.includes('gl.nondet.web.get('), 'NO_ACQUISITION', 'No contract-side HTTP acquisition detected.');
  check(source.includes('run_nondet_unsafe') && /def (validator|validate_leader)/.test(source), 'NO_VALIDATOR', 'Independent validator callback not detected.');
  check(!/\beval\s*\(|\bexec\s*\(/.test(source), 'DYNAMIC_CODE', 'Dynamic code evaluation requires manual review.');
  check(!/private_key\s*=|api_key\s*=/i.test(source), 'POSSIBLE_SECRET', 'Potential embedded credential assignment.');
  check(source.includes('evidenceDigest'), 'NO_EVIDENCE_BINDING', 'Evidence commitment not detected.');
  return { findings, automatedChecksPassed: findings.length === 0, securityCertified: false,
    requires: ['GenVM lint', 'adversarial contract tests', 'live consensus tests', 'manual source and validator-independence review'] };
}
