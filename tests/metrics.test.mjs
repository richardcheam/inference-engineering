import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/metrics.mjs', import.meta.url);
let requestMetrics, goodput, percentile;
try { ({ requestMetrics, goodput, percentile } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

// A request sent at 0, first token at 200ms, then four more tokens 50ms apart.
const sample = { sentAt: 0, tokenTimes: [200, 250, 300, 350, 400] };
const run = (o = {}) => {
  assert.equal(typeof requestMetrics, 'function', 'The metric model must be implemented');
  return requestMetrics({ ...sample, ...o });
};

test('time to first token is measured from the send, not from the first gap', () => {
  assert.equal(run().ttft, 200);
});

test('TPOT divides by the gaps between output tokens, not by the token count', () => {
  const r = run();
  // (400 - 200) / (5 - 1) = 50, and emphatically not 400/5 = 80.
  assert.equal(r.tpot, 50);
  assert.notEqual(r.tpot, (400 - 0) / 5);
});

test('a single output token has no TPOT to report', () => {
  const r = run({ tokenTimes: [200] });
  assert.equal(r.ttft, 200);
  assert.equal(r.tpot, null, 'TPOT is undefined for one token, not zero');
  assert.deepEqual(r.interTokenLatencies, []);
});

test('inter-token latencies are the individual gaps, which TPOT averages away', () => {
  const r = run({ tokenTimes: [200, 210, 500, 510, 520] });
  assert.deepEqual(r.interTokenLatencies, [10, 290, 10, 10]);
  assert.equal(r.tpot, 80);
  assert.equal(r.maxInterTokenLatency, 290, 'a stall TPOT hides entirely');
});

test('end to end latency covers the send through the final token', () => {
  assert.equal(run().endToEnd, 400);
  assert.equal(run({ sentAt: 100, tokenTimes: [300, 350, 400] }).endToEnd, 300);
});

test('goodput counts only requests meeting every limit at once', () => {
  assert.equal(typeof goodput, 'function', 'Goodput must be implemented');
  const requests = [
    { sentAt: 0, tokenTimes: [100, 150, 200] }, // ttft 100, tpot 50
    { sentAt: 0, tokenTimes: [500, 550, 600] }, // ttft 500: fails ttft
    { sentAt: 0, tokenTimes: [100, 400, 700] }, // tpot 300: fails tpot
  ];
  const limits = { ttft: 200, tpot: 100 };
  const r = goodput(requests, limits, 1000);
  assert.equal(r.satisfied, 1, 'only the first request meets both limits');
  assert.equal(r.total, 3);
  // Each limit alone would pass two of three; together, one. Goodput is not the intersection of margins.
  assert.equal(r.byLimit.ttft, 2);
  assert.equal(r.byLimit.tpot, 2);
  assert.ok(Math.abs(r.requestsPerSecond - 1) < 1e-9);
});

test('percentiles are reported on the population, separately from goodput', () => {
  assert.equal(typeof percentile, 'function', 'Percentile must be implemented');
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(values, 50), 50);
  assert.equal(percentile(values, 100), 100);
  assert.equal(percentile(values, 0), 10);
  assert.equal(percentile([42], 99), 42);
});

test('token times must be ordered and after the send', () => {
  for (const o of [{ tokenTimes: [] }, { tokenTimes: [200, 150] }, { sentAt: 300 }, { tokenTimes: [-5] }]) {
    assert.throws(() => run(o), /invalid/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});
