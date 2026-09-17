import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/speculate.mjs', import.meta.url);
let speculation, expectedAccepted;
try { ({ speculation, expectedAccepted } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const base = { draftLength: 4, acceptance: 0.8, draftCost: 0.2, verifyCost: 1.1, baseStep: 1 };
const run = (o = {}) => {
  assert.equal(typeof speculation, 'function', 'The speculation model must be implemented');
  return speculation({ ...base, ...o });
};

test('expected accepted tokens follow the geometric acceptance chain', () => {
  assert.equal(typeof expectedAccepted, 'function', 'Expected acceptance must be implemented');
  // Acceptance stops at the first rejection, so it is a truncated geometric series.
  assert.ok(Math.abs(expectedAccepted(4, 1) - 4) < 1e-9, 'perfect acceptance yields every drafted token');
  assert.ok(Math.abs(expectedAccepted(4, 0) - 0) < 1e-9, 'nothing accepted yields none');
  assert.ok(Math.abs(expectedAccepted(1, 0.5) - 0.5) < 1e-9);
  const p = 0.8;
  assert.ok(Math.abs(expectedAccepted(4, p) - (p + p**2 + p**3 + p**4)) < 1e-9);
});

test('a speculated step emits the accepted drafts plus the free verified token', () => {
  const r = run();
  assert.ok(Math.abs(r.tokensPerStep - (expectedAccepted(4, 0.8) + 1)) < 1e-9,
    'verification always produces one correct token even when every draft is rejected');
  assert.ok(r.tokensPerStep > 1);
});

test('speculation wins only when time per token beats the ordinary step', () => {
  const good = run({ acceptance: 0.9 });
  assert.ok(good.timePerToken < good.baselineTimePerToken);
  assert.equal(good.worthwhile, true);
  const bad = run({ acceptance: 0.1, draftCost: 0.5 });
  assert.ok(bad.timePerToken > bad.baselineTimePerToken);
  assert.equal(bad.worthwhile, false);
});

test('low acceptance makes a longer draft actively worse', () => {
  const short = run({ draftLength: 2, acceptance: 0.3 });
  const long = run({ draftLength: 8, acceptance: 0.3 });
  assert.ok(long.timePerToken > short.timePerToken,
    'drafting more tokens that get rejected costs time and returns nothing');
});

test('there is a break-even acceptance rate, and it is reported', () => {
  const r = run();
  assert.ok(r.breakEvenAcceptance > 0 && r.breakEvenAcceptance < 1, `got ${r.breakEvenAcceptance}`);
  const below = run({ acceptance: r.breakEvenAcceptance - 0.05 });
  const above = run({ acceptance: r.breakEvenAcceptance + 0.05 });
  assert.equal(below.worthwhile, false);
  assert.equal(above.worthwhile, true);
});

test('speedup is reported against the same configuration without speculation', () => {
  const r = run();
  assert.ok(Math.abs(r.speedup - r.baselineTimePerToken / r.timePerToken) < 1e-9);
});

test('drafting nothing is not speculation', () => {
  assert.throws(() => run({ draftLength: 0 }), /invalid/i);
});

test('invalid controls never produce a verdict', () => {
  for (const o of [{ acceptance: -0.1 }, { acceptance: 1.5 }, { draftLength: 2.5 }, { draftCost: -1 }, { verifyCost: 0 }, { baseStep: 0 }]) {
    assert.throws(() => run(o), /invalid/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});
