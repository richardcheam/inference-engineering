// Metric definitions follow the pinned cheatsheet, which follows the AIPerf reference.
// Every one of these needs a declared measurement boundary to mean anything; these
// operate on timestamps already collected at one.

/** Metrics for one request, from its send time and the arrival time of each output token. */
export function requestMetrics({ sentAt, tokenTimes }) {
  if (!Number.isFinite(sentAt)) throw new RangeError('Invalid send time');
  if (!Array.isArray(tokenTimes) || tokenTimes.length === 0) throw new RangeError('Invalid token times');
  for (const [i, t] of tokenTimes.entries()) {
    if (!Number.isFinite(t) || t < sentAt) throw new RangeError('Invalid token time before the send');
    if (i > 0 && t < tokenTimes[i - 1]) throw new RangeError('Invalid out-of-order token times');
  }
  const first = tokenTimes[0];
  const last = tokenTimes[tokenTimes.length - 1];
  const interTokenLatencies = tokenTimes.slice(1).map((t, i) => t - tokenTimes[i]);
  return {
    ttft: first - sentAt,
    // Gaps, not tokens: N tokens have N-1 gaps, and one token has none.
    tpot: tokenTimes.length > 1 ? (last - first) / (tokenTimes.length - 1) : null,
    interTokenLatencies,
    maxInterTokenLatency: interTokenLatencies.length ? Math.max(...interTokenLatencies) : null,
    endToEnd: last - sentAt,
    outputTokens: tokenTimes.length,
  };
}

/**
 * Requests satisfying every stated limit at once, over the measurement window.
 * Deliberately not per-limit pass rates: a request that meets one limit and misses
 * another served nobody.
 */
export function goodput(requests, limits, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) throw new RangeError('Invalid measurement window');
  const byLimit = Object.fromEntries(Object.keys(limits).map(k => [k, 0]));
  let satisfied = 0;
  for (const request of requests) {
    const m = requestMetrics(request);
    let all = true;
    for (const [key, limit] of Object.entries(limits)) {
      const value = m[key];
      const ok = value === null || value <= limit;
      if (ok) byLimit[key] += 1; else all = false;
    }
    if (all) satisfied += 1;
  }
  return { satisfied, total: requests.length, byLimit, requestsPerSecond: satisfied / (elapsedMs / 1000),
    fraction: requests.length ? satisfied / requests.length : 0 };
}

/** Nearest-rank percentile over a population, reported separately from goodput. */
export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) throw new RangeError('Invalid population');
  if (!Number.isFinite(p) || p < 0 || p > 100) throw new RangeError('Invalid percentile');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank - 1, 0), sorted.length - 1)];
}
