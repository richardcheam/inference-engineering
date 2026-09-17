import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/specSim.mjs', import.meta.url);
let simulateSpeculation;
try { ({ simulateSpeculation } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const run = (o = {}) => {
  assert.equal(typeof simulateSpeculation, 'function', 'The speculation simulation must be implemented');
  return simulateSpeculation({ draftLength: 4, rounds: 4, seed: 7, acceptance: 0.8, ...o });
};

test('a round drafts, verifies, then commits a prefix of the draft', () => {
  const frames = run();
  const phases = [...new Set(frames.map(f => f.phase))];
  for (const p of ['draft', 'verify', 'commit']) assert.ok(phases.includes(p), `missing the ${p} phase`);
  frames.forEach((f, i) => assert.equal(f.step, i));
});

test('acceptance stops at the first rejection, and everything after is discarded', () => {
  const frames = run();
  for (const f of frames.filter(x => x.phase === 'commit')) {
    const firstReject = f.tokens.findIndex(t => t.verdict === 'rejected');
    if (firstReject !== -1) {
      for (const t of f.tokens.slice(firstReject + 1)) {
        assert.equal(t.verdict, 'discarded', 'nothing after a rejection can be accepted');
      }
    }
  }
});

test('every round commits at least one token, even when all drafts fail', () => {
  const frames = run({ acceptance: 0 });
  for (const f of frames.filter(x => x.phase === 'commit')) {
    assert.ok(f.committed >= 1, 'verification always yields one correct token');
  }
});

test('perfect acceptance commits the whole draft plus the free token', () => {
  const frames = run({ acceptance: 1, draftLength: 4 });
  const commits = frames.filter(f => f.phase === 'commit');
  for (const f of commits) assert.equal(f.committed, 5);
});

test('the same seed replays identically, so stepping back is stable', () => {
  const a = run({ seed: 42 });
  const b = run({ seed: 42 });
  assert.deepEqual(a.map(f => f.committed), b.map(f => f.committed));
  const c = run({ seed: 43 });
  assert.ok(a.length === c.length, 'same shape');
});

test('emitted tokens only ever grow across the timeline', () => {
  const frames = run();
  let previous = 0;
  for (const f of frames) {
    assert.ok(f.emitted >= previous, 'the output cannot un-emit a token');
    previous = f.emitted;
  }
});

test('invalid configurations never produce a timeline', () => {
  for (const o of [{ draftLength: 0 }, { rounds: 0 }, { acceptance: -0.2 }, { acceptance: 2 }, { draftLength: 1.5 }]) {
    assert.throws(() => run(o), /invalid/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});

test('committed text accumulates across rounds and never rewrites itself', () => {
  const frames = run({ rounds: 4, acceptance: 0.7 });
  let previous = '';
  for (const f of frames) {
    const text = (f.committedText || []).join('');
    assert.ok(text.startsWith(previous), 'output only ever grows, never rewrites');
    previous = text;
  }
  assert.ok(previous.length > 0, 'something was emitted');
});

test('every drafted token shows the word it is guessing', () => {
  for (const f of run().filter(x => x.phase !== 'idle')) {
    for (const t of f.tokens) assert.ok(typeof t.text === 'string' && t.text.length > 0, `${f.phase} token needs text`);
  }
});

test('the emitted count matches the accumulated text length', () => {
  const last = run().at(-1);
  assert.equal(last.committedText.length, last.emitted);
});
