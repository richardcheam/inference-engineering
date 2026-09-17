import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = new URL('../site/src/bandwidth.mjs', import.meta.url);
let decodeStepBound, amortizationCurve, platforms;
try { ({ decodeStepBound, amortizationCurve, platforms } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const records = JSON.parse(readFileSync(new URL('../experiments/001-feasibility/calculations.json', import.meta.url)));
const base = { model: 'mistral-medium-3.5', platform: 'b200-sxm', context: 8192, batch: 8, efficiency: 0.7 };
const run = (overrides = {}) => {
  assert.equal(typeof decodeStepBound, 'function', 'The decode-step bound must be implemented');
  return decodeStepBound({ ...base, ...overrides }, records);
};

const MISTRAL_WEIGHT_BYTES = 133605834656;
const MISTRAL_KV_BYTES_PER_TOKEN = 360448;

test('every device in the explorer comes from the pinned hardware table', () => {
  assert.ok(platforms, 'Platform reference data must be exported');
  const expected = { 'rtx-5090': [32e9, 1792e9], 'h100-sxm': [80e9, 3350e9], 'h200-sxm': [141e9, 4800e9], 'gh200-hbm3e': [144e9, 4900e9], 'b200-sxm': [180e9, 8000e9], 'mi300x': [192e9, 5300e9] };
  assert.deepEqual(Object.keys(platforms), Object.keys(expected));
  for (const [id, [capacity, bandwidth]] of Object.entries(expected)) {
    assert.equal(platforms[id].capacityBytes, capacity, `${id} capacity must match hardware/reference.md`);
    assert.equal(platforms[id].bandwidthBytesPerSecond, bandwidth, `${id} bandwidth must match hardware/reference.md`);
  }
});

test('a decode step moves the weights once plus the live cache of every sequence', () => {
  const r = run();
  const cache = MISTRAL_KV_BYTES_PER_TOKEN * 8192 * 8;
  assert.equal(r.weightBytes, MISTRAL_WEIGHT_BYTES);
  assert.equal(r.cacheBytes, cache);
  assert.equal(r.bytesPerStep, MISTRAL_WEIGHT_BYTES + cache);
  assert.equal(r.effectiveBandwidth, 8000e9 * 0.7);
  assert.ok(Math.abs(r.stepSeconds - (MISTRAL_WEIGHT_BYTES + cache) / (8000e9 * 0.7)) < 1e-12);
  assert.ok(Math.abs(r.tokensPerSecond - 284.93) < 0.01, `unexpected aggregate rate ${r.tokensPerSecond}`);
  assert.ok(Math.abs(r.tokensPerSecondPerSequence - 35.61) < 0.01);
});

test('batching amortizes the weight read but never the per-sequence cache read', () => {
  const one = run({ batch: 1 });
  const eight = run({ batch: 8 });
  assert.equal(one.weightBytesPerToken, MISTRAL_WEIGHT_BYTES);
  assert.ok(Math.abs(eight.weightBytesPerToken - MISTRAL_WEIGHT_BYTES / 8) < 1e-6);
  assert.equal(one.cacheBytesPerToken, eight.cacheBytesPerToken);
  assert.ok(eight.tokensPerSecond > one.tokensPerSecond, 'aggregate throughput must rise with batch');
  assert.ok(eight.tokensPerSecondPerSequence < one.tokensPerSecondPerSequence, 'per-sequence rate must fall with batch');
});

test('the bound scales linearly with the achieved fraction of peak bandwidth', () => {
  const half = run({ efficiency: 0.35 });
  const full = run({ efficiency: 0.7 });
  assert.ok(Math.abs(half.stepSeconds - 2 * full.stepSeconds) < 1e-12);
  assert.ok(Math.abs(half.tokensPerSecond - full.tokensPerSecond / 2) < 1e-9);
});

test('a rate estimate is withheld when the same batch cannot be placed on the device', () => {
  const fits = run();
  assert.equal(fits.fitsCapacity, true);
  const over = run({ platform: 'h100-sxm', context: 131072, batch: 16 });
  assert.equal(over.fitsCapacity, false);
  assert.ok(over.residentBytes > over.capacityBytes);
});

test('models that do not re-read their whole cache carry the weaker claim', () => {
  assert.equal(run().partial, false);
  for (const model of ['qwen3.6-35b-a3b', 'glm-5.3', 'deepseek-v4.1-flash']) {
    const r = run({ model, platform: 'mi300x', batch: 1, context: 8192 });
    assert.equal(r.partial, true, `${model} must stay an explicitly partial read model`);
    assert.ok(r.readScope.length > 0, `${model} must explain what the bound leaves out`);
  }
});

test('the amortization curve reports one point per batch size in order', () => {
  assert.equal(typeof amortizationCurve, 'function', 'The amortization curve must be implemented');
  const points = amortizationCurve({ ...base, batch: undefined }, records, [1, 2, 4, 8]);
  assert.equal(points.length, 4);
  assert.deepEqual(points.map(p => p.batch), [1, 2, 4, 8]);
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].tokensPerSecond > points[i - 1].tokensPerSecond);
    assert.ok(points[i].tokensPerSecondPerSequence < points[i - 1].tokensPerSecondPerSequence);
  }
});

test('invalid controls never produce a misleading speed limit', () => {
  for (const options of [{ context: 0 }, { batch: -2 }, { batch: 2.5 }, { efficiency: 0 }, { efficiency: 1.4 }, { efficiency: NaN }, { platform: 'missing' }, { model: 'missing' }]) {
    assert.throws(() => run(options), /invalid|unknown/i, `expected ${JSON.stringify(options)} to be rejected`);
  }
});
