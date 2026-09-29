import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = new URL('../site/src/memory.mjs', import.meta.url);
let calculateBudget;
try { ({ calculateBudget } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const records = JSON.parse(readFileSync(new URL('../experiments/001-feasibility/calculations.json', import.meta.url)));
const base = { model: 'mistral-medium-3.5', context: 32768, concurrency: 2, capacityGiB: 160, overheadGiB: 12 };
const run = (overrides = {}) => {
  assert.equal(typeof calculateBudget, 'function', 'The budget calculation must be implemented');
  return calculateBudget({ ...base, ...overrides }, records);
};

test('two 32K Mistral sequences fit the hypothetical budget with little margin', () => {
  const r = run();
  assert.ok(Math.abs(r.totalGiB - 158.4298805296421) < 0.001);
  assert.equal(r.cacheGiB, 22);
  assert.equal(r.verdict, 'candidate');
  assert.ok(r.remainingGiB > 1.56 && r.remainingGiB < 1.58);
});
test('one 128K sequence exceeds the same budget despite lower concurrency', () => {
  const r = run({ context: 131072, concurrency: 1 });
  assert.equal(r.cacheGiB, 44);
  assert.equal(r.verdict, 'exceeds');
  assert.ok(r.remainingGiB < -20.4);
});
test('hybrid Qwen cache stays explicitly partial rather than a full fit claim', () => {
  const r = run({ model: 'qwen3.6-35b-a3b', concurrency: 1 });
  assert.equal(r.cacheGiB, 0.625);
  assert.equal(r.partial, true);
  assert.equal(r.verdict, 'candidate');
});
test('GLM and DeepSeek partial components cannot be treated as complete state', () => {
  assert.equal(run({ model: 'glm-5.3', capacityGiB: 1200 }).partial, true);
  assert.equal(run({ model: 'deepseek-v4.1-flash', capacityGiB: 1200 }).partial, true);
});
test('context and sequence count multiply only the per-request cache', () => {
  const a = run({ concurrency: 1 });
  const b = run({ concurrency: 4 });
  assert.equal(a.weightGiB, b.weightGiB);
  assert.equal(b.cacheGiB, 44);
});
test('invalid controls never produce misleading capacity verdicts', () => {
  for (const options of [{context: -1}, {concurrency: 0}, {capacityGiB: NaN}, {overheadGiB: -1}, {model: 'missing'}, {context: 1.5}]) {
    assert.throws(() => run(options), /invalid|unknown/i);
  }
});

const { attentionCache } = await import(path);
test('attention cache geometry reproduces the pinned per-token figures', () => {
  assert.equal(typeof attentionCache, 'function', 'The cache geometry function must be implemented');
  // Mistral Medium 3.5: 88 layers, 8 KV heads, 128/128 head dims, BF16.
  assert.equal(attentionCache({ layers: 88, kvHeads: 8, kHeadDim: 128, vHeadDim: 128, bytesPerValue: 2 }).bytesPerToken,
    records.cache_components.mistral_gqa_bf16.bytes_per_token);
  // Qwen3.6-35B-A3B full-attention layers: 10 layers, 2 KV heads, 256/256, BF16.
  assert.equal(attentionCache({ layers: 10, kvHeads: 2, kHeadDim: 256, vHeadDim: 256, bytesPerValue: 2 }).bytesPerToken,
    records.cache_components.qwen_full_attention_only_bf16.bytes_per_token);
});
test('a K head wider than the V head is counted separately', () => {
  // MiMo V2.6 global layers: 9 layers, 4 KV heads, K 192 and V 128.
  const bf16 = attentionCache({ layers: 9, kvHeads: 4, kHeadDim: 192, vHeadDim: 128, bytesPerValue: 2 });
  assert.equal(bf16.valuesPerToken, 11520);
  assert.equal(bf16.bytesPerToken, 23040);
  assert.equal(attentionCache({ layers: 9, kvHeads: 4, kHeadDim: 192, vHeadDim: 128, bytesPerValue: 1 }).bytesPerToken, 11520);
});
test('a sliding window bounds what a layer holds, however long the context', () => {
  const swa = { layers: 39, kvHeads: 8, kHeadDim: 192, vHeadDim: 128, bytesPerValue: 2, window: 128 };
  const short = attentionCache({ ...swa, liveTokens: 100 });
  const long = attentionCache({ ...swa, liveTokens: 1048576 });
  assert.equal(short.heldTokens, 100, 'below the window, every token is held');
  assert.equal(long.heldTokens, 128, 'past it, only the window is');
  assert.equal(long.bytes, 39 * 8 * 320 * 128 * 2);
  const global = attentionCache({ ...swa, window: undefined, liveTokens: 1048576 });
  assert.equal(global.heldTokens, 1048576, 'without a window the cache grows with the context');
});
test('invalid cache geometry is refused', () => {
  const ok = { layers: 9, kvHeads: 4, kHeadDim: 192, vHeadDim: 128, bytesPerValue: 2 };
  for (const o of [{ layers: 0 }, { kvHeads: 1.5 }, { kHeadDim: -1 }, { bytesPerValue: 0 }, { liveTokens: -1 }, { window: 0 }]) {
    assert.throws(() => attentionCache({ ...ok, ...o }), /invalid/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});
