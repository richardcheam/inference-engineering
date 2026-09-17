import { test } from 'node:test';
import assert from 'node:assert/strict';
import records from '../experiments/001-feasibility/calculations.json' with { type: 'json' };
import { phaseStates, decodeTokens } from '../site/src/phaseStates.mjs';

const INPUT = { model: 'mistral-medium-3.5', promptTokens: 4096, sequences: 8, batched: 64 };

test('the six states run prompt, prefill, decode, and the lever, in order', () => {
  const { states } = phaseStates(INPUT, records);
  assert.deepEqual(states.map(s => s.id),
    ['prompt', 'prefill', 'prefill-intensity', 'decode', 'decode-intensity', 'batching']);
});

test('a decode step carries one token per sequence, which is the whole claim', () => {
  assert.equal(decodeTokens(8), 8);
  assert.equal(decodeTokens(64), 64);
  const { frames } = phaseStates(INPUT, records);
  assert.equal(frames.decode.tokens, INPUT.sequences);
});

test('the weights read are identical in both phases', () => {
  // If this ever stops holding, the lesson's central sentence is wrong.
  const { frames } = phaseStates(INPUT, records);
  assert.equal(frames.prefill.weightBytes, frames.decode.weightBytes);
  assert.equal(frames.prefill.weightBytes, records.weights[INPUT.model].bytes);
});

test('only the token count changes between the phases', () => {
  const { frames } = phaseStates(INPUT, records);
  assert.equal(frames.prefill.tokens, INPUT.promptTokens);
  assert.equal(frames.decode.tokens, INPUT.sequences);
  assert.ok(frames.prefill.tokens > frames.decode.tokens);
});

test('intensity collapses by the ratio of the token counts', () => {
  const { frames, ratio } = phaseStates(INPUT, records);
  assert.equal(ratio, INPUT.promptTokens / INPUT.sequences);
  const measured = frames.prefill.tokensPerGB / frames.decode.tokensPerGB;
  assert.ok(Math.abs(measured - ratio) < 1e-9,
    `intensity ratio ${measured} does not match the token ratio ${ratio}`);
});

test('batching raises intensity without changing the weights read', () => {
  const { frames } = phaseStates(INPUT, records);
  assert.ok(frames.batched.tokensPerGB > frames.decode.tokensPerGB,
    'a larger batch did not raise intensity');
  assert.equal(frames.batched.weightBytes, frames.decode.weightBytes,
    'batching should not change what is read, only what shares it');
});

test('the opening state has computed nothing', () => {
  const { frames } = phaseStates(INPUT, records);
  assert.equal(frames.prompt.tokens, 0);
  assert.equal(frames.prompt.tokensPerGB, 0);
});

test('no two consecutive states render the same frame', () => {
  const { states } = phaseStates(INPUT, records);
  for (let i = 1; i < states.length; i++) {
    const a = states[i - 1], b = states[i];
    assert.ok(a.frame !== b.frame || a.focus !== b.focus,
      `states "${a.id}" and "${b.id}" are the same picture`);
  }
});

test('bad input is refused rather than rendering a false comparison', () => {
  assert.throws(() => phaseStates({ ...INPUT, model: 'nope' }, records), /Unknown model/);
  assert.throws(() => phaseStates({ ...INPUT, sequences: 0 }, records), /Invalid phase input/);
  // A "batch" no larger than the plain case would show a lever that does nothing.
  assert.throws(() => phaseStates({ ...INPUT, batched: 8 }, records), /more tokens than/);
});
