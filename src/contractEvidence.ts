/** Public, reproducible evidence only. Never embed API keys in deployed code. */
export type EvidenceSource = {
  url: string;
  format: 'json' | 'text';
  /** Project stable, consequential fields. Paths are data, never expressions. */
  fields?: Record<string, Array<string | number>>;
  /** Exact values checked against projected fields, e.g. event ID, date, units. */
  expect?: Record<string, string | number | boolean>;
  /** Optional SHA-256 of the exact response bytes; not a proof of source truth. */
  sha256?: string;
};

export type EvidencePolicy = {
  sources: EvidenceSource[];
  minimumSources?: number;
  maxResponseBytes?: number;
  maxNormalizedChars?: number;
};

export function publicEvidenceUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') ||
      !host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host) ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) {
    throw new Error('Evidence needs a public HTTPS hostname without credentials, fragments or custom ports.');
  }
  return url.href;
}

export function normalizeEvidencePolicy(input: EvidencePolicy): Required<EvidencePolicy> {
  if (!input || !Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 8) throw new Error('Provide 1-8 evidence sources.');
  const sources = input.sources.map(source => {
    const url = publicEvidenceUrl(source.url);
    if (!['json', 'text'].includes(source.format)) throw new Error('Evidence format must be json or text.');
    if (source.sha256 && !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('sha256 must be 64 lowercase hex characters.');
    const fields = source.fields ?? {};
    if (Object.keys(fields).length > 32 || (source.format === 'text' && Object.keys(fields).length)) throw new Error('JSON sources allow at most 32 projected fields; text sources allow none.');
    for (const [name, path] of Object.entries(fields)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name) || !Array.isArray(path) || path.length > 12 || path.some(key =>
        typeof key === 'number' ? !Number.isSafeInteger(key) || key < 0 : typeof key !== 'string' || !key || ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('Invalid evidence projection.');
    }
    for (const [key, value] of Object.entries(source.expect ?? {})) {
      if (!Object.hasOwn(fields, key) || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Expected values must reference projected fields and be finite scalars.');
    }
    return { url, format: source.format, fields, expect: source.expect ?? {}, ...(source.sha256 ? { sha256: source.sha256 } : {}) };
  }).sort((a, b) => a.url.localeCompare(b.url));
  if (new Set(sources.map(source => source.url)).size !== sources.length) throw new Error('Duplicate evidence URL.');
  const minimumSources = input.minimumSources ?? sources.length;
  const maxResponseBytes = input.maxResponseBytes ?? 262144;
  const maxNormalizedChars = input.maxNormalizedChars ?? 12000;
  if (!Number.isSafeInteger(minimumSources) || minimumSources < 1 || minimumSources > sources.length) throw new Error('Invalid minimumSources.');
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 256 || maxResponseBytes > 1048576) throw new Error('maxResponseBytes must be 256-1048576.');
  if (!Number.isSafeInteger(maxNormalizedChars) || maxNormalizedChars < 128 || maxNormalizedChars > 24000) throw new Error('maxNormalizedChars must be 128-24000.');
  return { sources, minimumSources, maxResponseBytes, maxNormalizedChars };
}

/** Shared Python runtime, included verbatim in self-contained generated contracts. */
export const evidenceRuntime = `
def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


def _digest(value):
    return "0x" + hashlib.sha256(_canonical(value).encode("utf-8")).hexdigest()


def _path(value, path):
    for key in path:
        if type(key) is int and isinstance(value, list) and 0 <= key < len(value):
            value = value[key]
        elif isinstance(key, str) and isinstance(value, dict) and key in value:
            value = value[key]
        else:
            raise ValueError("MISSING_FIELD")
    return value


def _fetch_evidence(policy):
    records = []
    for source in policy["sources"]:
        record = {"source": source["url"], "available": False, "content": "", "error": "UNAVAILABLE"}
        try:
            response = gl.nondet.web.get(source["url"])
            if response.status != 200:
                raise ValueError("HTTP_FAILURE")
            raw = response.body
            if len(raw) > policy["maxResponseBytes"]:
                raise ValueError("RESPONSE_TOO_LARGE")
            if source.get("sha256") and hashlib.sha256(raw).hexdigest() != source["sha256"]:
                raise ValueError("HASH_MISMATCH")
            text = raw.decode("utf-8")
            if source["format"] == "json":
                data = json.loads(text)
                fields = source.get("fields", {})
                data = {key: _path(data, path) for key, path in fields.items()} if fields else data
                for key, expected in source.get("expect", {}).items():
                    if type(data[key]) is not type(expected) or data[key] != expected:
                        raise ValueError("IDENTITY_MISMATCH")
                content = _canonical(data)
            else:
                content = " ".join(text.split())
            if not content or len(content) > policy["maxNormalizedChars"]:
                raise ValueError("INVALID_CONTENT_SIZE")
            record.update({"available": True, "content": content, "error": ""})
        except Exception:
            # Do not persist untrusted server errors or certify missing content.
            pass
        records.append(record)
    return records
`;
