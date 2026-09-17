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
