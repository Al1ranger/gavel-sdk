/**
 * Court definitions.
 *
 * A court is a judicial system: who may judge, under what rules, in what
 * jurisdiction, and how hard it is to overturn a ruling. Validation here
 * mirrors `contracts/gavel_court.py::_canonicalize_court` exactly so a spec
 * that passes locally cannot be rejected on-chain — the SDK never lets a
 * developer discover a validation failure by paying for a transaction.
 */

/** Appeal ladder. Each rung draws a wider validator set and costs more. */
export const COURT_TIERS = ['TRIAL', 'APPEAL', 'SUPREME'] as const;
export type CourtTier = (typeof COURT_TIERS)[number];

/**
 * Consensus threshold per tier, in basis points of the validator set.
 * A simple majority settles a trial; a supreme ruling needs three quarters.
 */
export const TIER_THRESHOLDS_BPS: Record<CourtTier, number> = {
  TRIAL: 5001,
  APPEAL: 6667,
  SUPREME: 7500,
};

export type CourtSpec = {
  id: string;
  name: string;
  jurisdiction: string;
  /** Validator allowlist. Empty means any validator the protocol schedules. */
  judges: string[];
  rules: string[];
  /** Trial-tier threshold in basis points. Must exceed a bare 50%. */
  votingThresholdBps: number;
  appealPeriodSeconds: number;
  /** Highest tier this court will hear. 2 = appeals up to Supreme. */
  maxTier: number;
  approvedSources: string[];
  courtHash?: `0x${string}`;
};

export type CourtRecord = { admin: string; court: CourtSpec };

const MAX_APPEAL_PERIOD_SECONDS = 31_536_000; // one year

export function tierName(tier: number): CourtTier {
  const name = COURT_TIERS[tier];
  if (!name) throw new Error(`Unknown court tier: ${tier}`);
  return name;
}

export function tierThresholdBps(tier: number): number {
  return TIER_THRESHOLDS_BPS[tierName(tier)];
}

/** Identifier shape shared by courts, cases and markets. */
export function normalizeIdentifier(value: unknown, label: string): string {
  const text = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,64}$/.test(text)) throw new Error(`${label} must contain 4-64 letters, digits, hyphens or underscores.`);
  return text;
}

/** Sources must be exact HTTPS URLs with no embedded credentials. */
export function normalizeSources(value: unknown, maximum = 16): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) throw new Error(`Register 1-${maximum} exact HTTPS sources.`);
  const sources = value.map(source => String(source).trim()).sort();
  if (new Set(sources).size !== sources.length) throw new Error('Evidence sources must be unique.');
  for (const source of sources) {
    let url: URL;
    try { url = new URL(source); } catch { throw new Error('Evidence sources must be valid HTTPS URLs.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Evidence sources must be HTTPS URLs without credentials.');
  }
  return sources;
}

export function normalizeCourtSpec(input: CourtSpec): CourtSpec {
  if (!input || typeof input !== 'object') throw new Error('A CourtSpec object is required.');
  const id = normalizeIdentifier(input.id, 'Court ID');
  const name = String(input.name ?? '').trim();
  const jurisdiction = String(input.jurisdiction ?? '').trim();
  if (name.length < 3 || name.length > 120) throw new Error('Court name must contain 3-120 characters.');
  if (jurisdiction.length < 3 || jurisdiction.length > 240) throw new Error('Jurisdiction must contain 3-240 characters.');

  if (!Array.isArray(input.rules) || !input.rules.length || input.rules.length > 32) throw new Error('Register 1-32 court rules.');
  const rules = input.rules.map(rule => String(rule).trim());
  if (rules.some(rule => !rule)) throw new Error('Court rules cannot be empty.');

  if (!Array.isArray(input.judges) || input.judges.length > 64) throw new Error('Assign at most 64 judges.');
  const judges = [...new Set(input.judges.map(judge => String(judge).trim()).filter(Boolean))].sort();

  const votingThresholdBps = Number(input.votingThresholdBps ?? TIER_THRESHOLDS_BPS.TRIAL);
  if (!Number.isSafeInteger(votingThresholdBps) || votingThresholdBps < 5001 || votingThresholdBps > 10000) throw new Error('Voting threshold must be 5001-10000 basis points; a court cannot settle on a tie.');

  const appealPeriodSeconds = Number(input.appealPeriodSeconds ?? 86400);
  if (!Number.isSafeInteger(appealPeriodSeconds) || appealPeriodSeconds < 0 || appealPeriodSeconds > MAX_APPEAL_PERIOD_SECONDS) throw new Error('Appeal period must be 0 seconds to one year.');

  const maxTier = Number(input.maxTier ?? 2);
  if (!Number.isSafeInteger(maxTier) || maxTier < 0 || maxTier > 2) throw new Error('Max tier must be 0 (TRIAL), 1 (APPEAL) or 2 (SUPREME).');

  return {
    appealPeriodSeconds,
    approvedSources: normalizeSources(input.approvedSources),
    id,
    judges,
    jurisdiction,
    maxTier,
    name,
    rules,
    votingThresholdBps,
  };
}

export function serializeCourtSpec(input: CourtSpec): string {
  return JSON.stringify(normalizeCourtSpec(input), null, 2);
}
