import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/prefix.mjs', import.meta.url);
let prefixReuse, blockSizes;
try { ({ prefixReuse, blockSizes } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const base = { promptTokens: 1024, cachedTokens: 1024, blockSize: 64 };
const run = (o = {}) => {
  assert.equal(typeof prefixReuse, 'function', 'The prefix reuse model must be implemented');
  return prefixReuse({ ...base, ...o });
};

test('a complete prompt match still leaves work to do', () => {
  const r = run();
  assert.ok(r.recomputedTokens >= 1, 'the last token always needs recomputation for logits');
  assert.equal(r.reportedHitFraction, 1, 'every prompt token was present in the cache');
  assert.ok(r.actualHitFraction < 1, 'but the work actually skipped is less than that');
});

test('the reusable prefix is always a whole number of blocks', () => {
  for (const blockSize of blockSizes) {
    for (const promptTokens of [129, 512, 1000, 1024, 4096, 4097]) {
      const r = run({ promptTokens, cachedTokens: promptTokens, blockSize });
      assert.equal(r.reusedTokens % blockSize, 0, `${promptTokens} tokens at block ${blockSize} must align`);
      assert.ok(r.reusedTokens <= promptTokens - 1, 'reuse can never cover the final token');
    }
  }
});

test('a fully cached prompt recomputes between one token and one whole block', () => {
  for (const blockSize of blockSizes) {
    for (const promptTokens of [200, 512, 1024, 2000, 4096]) {
      const r = run({ promptTokens, cachedTokens: promptTokens, blockSize });
      assert.ok(r.recomputedTokens >= 1, 'at least the last token');
      assert.ok(r.recomputedTokens <= blockSize, `at most one block, got ${r.recomputedTokens} at block ${blockSize}`);
    }
  }
});

test('one extra prompt token can change the recomputation by a whole block', () => {
  const onBoundary = run({ promptTokens: 1025, cachedTokens: 1025, blockSize: 64 });
  const justUnder = run({ promptTokens: 1024, cachedTokens: 1024, blockSize: 64 });
  assert.equal(onBoundary.recomputedTokens, 1);
  assert.equal(justUnder.recomputedTokens, 64);
});

test('a partial cache hit cannot reuse more than was cached', () => {
  const r = run({ promptTokens: 4096, cachedTokens: 1000, blockSize: 64 });
  assert.ok(r.reusedTokens <= 1000);
  assert.equal(r.reusedTokens % 64, 0);
  assert.equal(r.recomputedTokens, 4096 - r.reusedTokens);
});

test('a cache holding more than this prompt is clamped to the prompt', () => {
  const r = run({ promptTokens: 512, cachedTokens: 99999, blockSize: 64 });
  assert.ok(r.reusedTokens < 512);
  assert.equal(r.reportedHitFraction, 1);
});

test('with nothing cached, everything is recomputed', () => {
  const r = run({ cachedTokens: 0 });
  assert.equal(r.reusedTokens, 0);
  assert.equal(r.recomputedTokens, 1024);
  assert.equal(r.reportedHitFraction, 0);
  assert.equal(r.actualHitFraction, 0);
});

test('blocks allocated cover every prompt token, with the rounding made visible', () => {
  const r = run({ promptTokens: 1000, cachedTokens: 0, blockSize: 64 });
  assert.equal(r.blocksForPrompt, 16);
  assert.equal(r.paddingTokens, 24);
});

test('invalid controls never produce a reuse claim', () => {
  for (const o of [{ promptTokens: 0 }, { promptTokens: -5 }, { cachedTokens: -1 }, { blockSize: 0 }, { blockSize: 1.5 }, { promptTokens: 1.5 }]) {
    assert.throws(() => run(o), /invalid/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});
