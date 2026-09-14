import { verify as cryptoVerify, type KeyLike } from 'node:crypto';
import { canonicalJSON, hashJSON } from '../evidence/normalizer.ts';
import { identifier, integer, requireThat } from '../api/types.ts';

export type CertificatePayload = {
  version: 1; issuer: string; audience: string; network: string; contract: string;
  marketId: string; specHash: string; evidenceHash: string; decision: string;
  nonce: string; issuedAt: number; expiresAt: number;
};
export type DecisionCertificate = { payload: CertificatePayload; algorithm: 'Ed25519'; signature: string };
export type CertificateScope = Pick<CertificatePayload, 'audience' | 'network' | 'contract' | 'marketId' | 'specHash'>;
export function validateCertificatePayload(payload: CertificatePayload): void {
  requireThat(payload?.version === 1, 'CERT_VERSION', 'Unsupported certificate version.');
  for (const value of [payload.issuer, payload.audience, payload.network, payload.marketId, payload.nonce, payload.decision]) identifier(value);
  requireThat(/^0x[0-9a-fA-F]{40}$/.test(payload.contract) && /^0x[0-9a-f]{64}$/.test(payload.specHash) && /^0x[0-9a-f]{64}$/.test(payload.evidenceHash), 'CERT_BINDING', 'Invalid certificate address or hash.');
  integer(payload.issuedAt, 0, Number.MAX_SAFE_INTEGER, 'issuedAt'); integer(payload.expiresAt, payload.issuedAt + 1, Number.MAX_SAFE_INTEGER, 'expiresAt');
}
export function certificateMessage(payload: CertificatePayload): Buffer {
  validateCertificatePayload(payload);
  return Buffer.from(`gavel:decision-certificate:v1\n${canonicalJSON(payload)}`, 'utf8');
}
/** Signing keys stay in the caller's signer/HSM. A signature proves issuer approval, not truth. */
export async function issueCertificate(payload: CertificatePayload, sign: (message: Uint8Array) => Promise<Uint8Array>): Promise<DecisionCertificate> {
  const copy = structuredClone(payload);
  const signature = await sign(certificateMessage(copy));
  requireThat(signature.byteLength === 64, 'CERT_SIGNATURE', 'Ed25519 signatures must be 64 bytes.');
  return { payload: copy, algorithm: 'Ed25519', signature: Buffer.from(signature).toString('base64') };
}
export function verifyCertificate(certificate: DecisionCertificate, scope: CertificateScope, trustedIssuers: ReadonlyMap<string, KeyLike>, now: number): true {
  integer(now, 0, Number.MAX_SAFE_INTEGER, 'now');
  const message = certificateMessage(certificate.payload);
  requireThat(certificate.algorithm === 'Ed25519' && typeof certificate.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(certificate.signature), 'CERT_SIGNATURE', 'Malformed Ed25519 signature.');
  requireThat(Object.entries(scope).every(([key, value]) => certificate.payload[key as keyof CertificateScope] === value), 'CERT_SCOPE', 'Certificate does not belong to this deployment/consumer.');
  requireThat(certificate.payload.issuedAt <= now && now < certificate.payload.expiresAt, 'CERT_TIME', 'Certificate expired or not yet valid.');
  const key = trustedIssuers.get(certificate.payload.issuer);
  requireThat(key, 'CERT_ISSUER', 'Issuer is not trusted.');
  let valid = false;
  try { valid = cryptoVerify(null, message, key, Buffer.from(certificate.signature, 'base64')); } catch { /* fail closed */ }
  requireThat(valid, 'CERT_SIGNATURE', 'Signature verification failed.');
  return true;
}
export interface ReplayStore { /** Must atomically reject an existing key. Persist this in production. */ claim(key: string): Promise<boolean> }
export class MemoryReplayStore implements ReplayStore {
  private readonly used = new Set<string>();
  async claim(key: string): Promise<boolean> { if (this.used.has(key)) return false; this.used.add(key); return true; }
}
export async function consumeCertificate(certificate: DecisionCertificate, scope: CertificateScope, issuers: ReadonlyMap<string, KeyLike>, now: number, store: ReplayStore): Promise<void> {
  const copy = structuredClone(certificate);
  verifyCertificate(copy, scope, issuers, now);
  const { issuer, audience, network, contract, marketId, specHash, nonce } = copy.payload;
  requireThat(await store.claim(hashJSON({ issuer, audience, network, contract, marketId, specHash, nonce })), 'CERT_REPLAY', 'Certificate nonce already consumed.');
}
