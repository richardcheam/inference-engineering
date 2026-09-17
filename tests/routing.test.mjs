import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = new URL('../site/src/routing.mjs', import.meta.url);
let distinctExperts, expertTraffic, reuseCurve, routing;
try { ({ distinctExperts, expertTraffic, reuseCurve, routing } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const records = JSON.parse(readFileSync(new URL('../experiments/001-feasibility/calculations.json', import.meta.url)));
const config = model => {
  const raw = JSON.parse(readFileSync(new URL(`../research/sources/2026-09-15/${model}.config.json`, import.meta.url)));
  return raw.text_config || raw;
};

test('routing figures are the ones in the pinned configs, not retyped guesses', () => {
  assert.ok(routing, 'Routing reference data must be exported');
  for (const [model, spec] of Object.entries(routing)) {
    const c = config(model);
    assert.equal(spec.experts, c.n_routed_experts ?? c.num_experts, `${model} expert count must match its config`);
    assert.equal(spec.expertsPerToken, c.num_experts_per_tok, `${model} top-k must match its config`);
    assert.equal(spec.hidden, c.hidden_size, `${model} hidden size must match its config`);
    assert.equal(spec.moeIntermediate, c.moe_intermediate_size, `${model} expert width must match its config`);
    assert.equal(spec.layers, c.num_hidden_layers, `${model} layer count must match its config`);
    assert.equal(spec.denseFirst, c.first_k_dense_replace ?? 0, `${model} dense-prefix count must match its config`);
  }
});

test('a single token touches exactly its top-k experts', () => {
  assert.equal(typeof distinctExperts, 'function', 'The reuse model must be implemented');
  for (const [model, spec] of Object.entries(routing)) {
    assert.ok(Math.abs(distinctExperts({ model, tokens: 1 }) - spec.expertsPerToken) < 1e-9, `${model} at one token`);
  }
});

test('GLM reproduces the expert reuse figures already pinned in the workspace', () => {
  for (const [tokens, expected] of Object.entries(records.toy_expert_reuse)) {
    const got = distinctExperts({ model: 'glm-5.3', tokens: Number(tokens) });
    assert.ok(Math.abs(got - expected) < 1e-9, `at ${tokens} tokens expected ${expected}, got ${got}`);
  }
});

test('reuse rises with batch, never exceeds the expert count, and saturates', () => {
  for (const model of Object.keys(routing)) {
    let previous = 0;
    for (const tokens of [1, 2, 4, 8, 16, 32, 64, 128, 256]) {
      const got = distinctExperts({ model, tokens });
      assert.ok(got > previous, `${model} reuse must rise at ${tokens} tokens`);
      assert.ok(got <= routing[model].experts, `${model} cannot touch more than every expert`);
      previous = got;
    }
    assert.ok(previous / routing[model].experts > 0.95, `${model} should be nearly saturated by 256 tokens`);
  }
});

test('expert bytes per emitted token always falls as the batch grows', () => {
  assert.equal(typeof expertTraffic, 'function', 'The traffic model must be implemented');
  let previous = Infinity;
  for (const tokens of [1, 2, 4, 8, 16, 32, 64, 128]) {
    const r = expertTraffic({ model: 'glm-5.3', tokens, bytesPerParam: 1 });
    assert.ok(r.bytesPerToken < previous, `bytes per token must fall at ${tokens}`);
    assert.ok(r.bytesPerStep <= r.allExpertBytes, 'a step cannot read more than every expert');
    previous = r.bytesPerToken;
  }
});

test('no model claims more expert bytes than its pinned checkpoint holds', () => {
  for (const [model, spec] of Object.entries(routing)) {
    const { allExpertBytes } = expertTraffic({ model, tokens: 1, bytesPerParam: spec.bytesPerParam });
    assert.ok(allExpertBytes < records.weights[model].bytes, `${model}: experts must not exceed the whole checkpoint`);
  }
});

test('GLM and Qwen expert footprints land where their stored precision says they should', () => {
  // Verified cross-check. DeepSeek is excluded: its checkpoint is mixed FP4/FP8 and we have
  // not established which tensors carry which, so its expert precision stays an assumption.
  for (const [model, expected] of Object.entries({ 'glm-5.3': 0.96, 'qwen3.6-35b-a3b': 0.9 })) {
    const spec = routing[model];
    const { allExpertBytes } = expertTraffic({ model, tokens: 1, bytesPerParam: spec.bytesPerParam });
    const share = allExpertBytes / records.weights[model].bytes;
    assert.ok(Math.abs(share - expected) < 0.05, `${model}: experts are ${(share * 100).toFixed(1)}% of the checkpoint, expected about ${expected * 100}%`);
  }
  assert.equal(routing['deepseek-v4.1-flash'].precisionAssumed, true, 'DeepSeek expert precision must stay flagged as an assumption');
});

test('the curve is ordered and carries the fraction of experts reached', () => {
  assert.equal(typeof reuseCurve, 'function', 'The reuse curve must be implemented');
  const points = reuseCurve({ model: 'glm-5.3', bytesPerParam: 1 }, [1, 8, 64]);
  assert.deepEqual(points.map(p => p.tokens), [1, 8, 64]);
  assert.ok(points[0].fraction < points[2].fraction);
  assert.ok(points[2].fraction <= 1);
});

test('invalid controls never produce a reuse figure', () => {
  for (const options of [{ tokens: 0 }, { tokens: -4 }, { tokens: 1.5 }, { model: 'missing' }, { model: 'mistral-medium-3.5' }]) {
    assert.throws(() => distinctExperts({ model: 'glm-5.3', tokens: 8, ...options }), /invalid|unknown|dense/i,
      `expected ${JSON.stringify(options)} to be rejected`);
  }
  assert.throws(() => expertTraffic({ model: 'glm-5.3', tokens: 8, bytesPerParam: 0 }), /invalid/i);
});
