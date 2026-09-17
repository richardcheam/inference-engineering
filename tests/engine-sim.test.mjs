import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/engineSim.mjs', import.meta.url);
let simulate, SCENARIOS;
try { ({ simulate, SCENARIOS } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const one = { id: 'A', arriveAt: 0, promptTokens: 24, outputTokens: 6, prefixTag: 'x' };
const run = (o = {}) => {
  assert.equal(typeof simulate, 'function', 'The engine simulation must be implemented');
  return simulate({ requests: [one], blockSize: 8, totalBlocks: 12, prefixCaching: false, ...o });
};

test('a simulation is a list of self-contained frames in order', () => {
  const frames = run();
  assert.ok(frames.length > 3, 'needs enough steps to watch');
  frames.forEach((f, i) => {
    assert.equal(f.step, i, 'frames are numbered by position');
    assert.ok(Array.isArray(f.pool), 'every frame carries the whole pool');
    assert.ok(Array.isArray(f.events), 'and what happened to get here');
  });
});

test('the block pool is never oversubscribed and never double-owned', () => {
  const frames = run({ requests: [
    { id: 'A', arriveAt: 0, promptTokens: 40, outputTokens: 10, prefixTag: 'x' },
    { id: 'B', arriveAt: 1, promptTokens: 40, outputTokens: 10, prefixTag: 'y' },
    { id: 'C', arriveAt: 2, promptTokens: 40, outputTokens: 10, prefixTag: 'z' },
  ], totalBlocks: 12 });
  for (const f of frames) {
    assert.ok(f.pool.length <= 12, `frame ${f.step} allocated ${f.pool.length} of 12 blocks`);
    const owned = f.pool.filter(b => b.owner);
    const keys = owned.map(b => `${b.owner}:${b.index}`);
    assert.equal(new Set(keys).size, keys.length, `frame ${f.step} has a duplicated block slot`);
  }
});

test('a prompt occupies a whole number of blocks, rounded up', () => {
  const frames = run({ requests: [{ ...one, promptTokens: 17 }], blockSize: 8 });
  const prefilled = frames.find(f => f.requests.A?.phase === 'decode');
  assert.ok(prefilled, 'the request should reach decode');
  assert.equal(prefilled.pool.filter(b => b.owner === 'A').length, 3, '17 tokens in 8-token blocks is 3 blocks');
});

test('decoding appends tokens and opens a new block exactly when one fills', () => {
  const frames = run({ requests: [{ ...one, promptTokens: 8, outputTokens: 9 }], blockSize: 8 });
  const counts = frames.map(f => f.pool.filter(b => b.owner === 'A').length);
  assert.ok(Math.max(...counts) >= 2, 'a second block must open as output passes the first');
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] - counts[i - 1] <= 1, 'blocks open one at a time, never in a jump');
  }
});

test('a finished request gives its blocks back', () => {
  const frames = run();
  const last = frames[frames.length - 1];
  assert.equal(last.requests.A.phase, 'done');
  assert.equal(last.pool.filter(b => b.owner === 'A').length, 0, 'its blocks are released');
});

test('with no room, a request waits in the queue instead of allocating', () => {
  const frames = run({ requests: [
    { id: 'A', arriveAt: 0, promptTokens: 32, outputTokens: 12, prefixTag: 'x' },
    { id: 'B', arriveAt: 0, promptTokens: 32, outputTokens: 12, prefixTag: 'y' },
  ], blockSize: 8, totalBlocks: 7 });
  const queued = frames.find(f => f.queue.length > 0);
  assert.ok(queued, 'the second request must be made to wait');
  assert.ok(frames.some(f => f.requests.B?.phase === 'done'), 'and must still finish eventually');
});

test('prefix caching reuses blocks and recomputes only the tail', () => {
  const shared = [
    { id: 'A', arriveAt: 0, promptTokens: 32, outputTokens: 3, prefixTag: 'same' },
    { id: 'B', arriveAt: 6, promptTokens: 32, outputTokens: 3, prefixTag: 'same' },
  ];
  const withCache = simulate({ requests: shared, blockSize: 8, totalBlocks: 16, prefixCaching: true });
  const withoutCache = simulate({ requests: shared, blockSize: 8, totalBlocks: 16, prefixCaching: false });
  const hit = withCache.find(f => f.events.some(e => /reuse/i.test(e)));
  assert.ok(hit, 'a reuse event must be reported');
  const b = withCache.find(f => f.requests.B?.reusedTokens > 0);
  assert.ok(b, 'B must record reused tokens');
  assert.ok(b.requests.B.reusedTokens < 32, 'but never the whole prompt — the last token needs recomputing');
  assert.equal(b.requests.B.reusedTokens % 8, 0, 'and reuse is block aligned');
  assert.ok(withCache.length <= withoutCache.length, 'caching must not make it slower');
});

test('scenarios are offered and each one is playable', () => {
  assert.ok(SCENARIOS && SCENARIOS.length >= 3, 'needs a few situations to compare');
  for (const s of SCENARIOS) {
    assert.ok(s.id && s.label && s.explains, `${s.id} needs to say what it demonstrates`);
    const frames = simulate(s.config);
    assert.ok(frames.length > 2, `${s.id} produced no timeline`);
    assert.ok(frames[frames.length - 1].allDone, `${s.id} never finishes`);
  }
});

test('invalid configurations never produce a timeline', () => {
  for (const o of [{ blockSize: 0 }, { totalBlocks: 0 }, { requests: [] }, { blockSize: -8 },
                   { requests: [{ id: 'A', arriveAt: 0, promptTokens: 0, outputTokens: 4 }] }]) {
    assert.throws(() => run(o), /invalid/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});
