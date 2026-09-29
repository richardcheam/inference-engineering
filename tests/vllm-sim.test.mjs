import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, SCENARIOS, codeUrl, VLLM_COMMIT } from '../site/src/vllmSim.mjs';

const scenario = id => SCENARIOS.find(s => s.id === id);
const run = (id, o = {}) => simulate({ ...scenario(id).config, ...o });
const ALL = SCENARIOS.flatMap(s => [true, false].map(c => ({ name: `${s.id}, caching ${c}`, frames: simulate({ ...s.config, prefixCaching: c }) })));

test('frames are self-contained and in order', () => {
  for (const { frames } of ALL) {
    frames.forEach((f, i) => {
      assert.equal(f.index, i);
      assert.ok(Array.isArray(f.pool) && Array.isArray(f.freeQueue));
      assert.equal(typeof f.text, 'string');
      assert.ok(!f.text.includes('\u2014'), 'no em dashes in narration');
    });
    assert.equal(frames.at(-1).kind, 'done');
    assert.ok(Object.values(frames.at(-1).requests).every(r => r.status === 'done'));
  }
});

test('every block is either referenced or in the free queue, never both', () => {
  for (const { name, frames } of ALL) for (const f of frames) {
    const inQueue = new Set(f.freeQueue);
    assert.equal(inQueue.size, f.freeQueue.length, `${name}: a block is queued twice`);
    for (const b of f.pool) assert.notEqual(b.ref > 0, inQueue.has(b.id), `${name} frame ${f.index}: block ${b.id}`);
    const holders = {};
    for (const r of Object.values(f.requests)) for (const id of r.blocks) holders[id] = (holders[id] || 0) + 1;
    for (const b of f.pool) assert.equal(b.ref, holders[b.id] || 0, `${name} frame ${f.index}: ref count of block ${b.id}`);
  }
});

test('a request frees tail first: hashed blocks to the back, the rest to the front', () => {
  const frames = run('return');
  const at = frames.findIndex(f => f.kind === 'free');
  const before = frames[at - 1], after = frames[at];
  const victim = after.focus.request;
  const freed = before.requests[victim].blocks;
  const hashed = [...freed].reverse().filter(id => after.pool[id].hash);
  const plain = [...freed].reverse().filter(id => !after.pool[id].hash);
  assert.deepEqual(after.freeQueue.slice(after.freeQueue.length - hashed.length), hashed);
  assert.deepEqual(after.freeQueue.slice(0, plain.length), plain);
});

test('a cached block keeps its hash until it is handed out again, and the eviction is narrated', () => {
  for (const { name, frames } of ALL) for (let i = 1; i < frames.length; i++) {
    for (const b of frames[i].pool) {
      const was = frames[i - 1].pool[b.id].hash;
      if (!was || b.hash === was) continue;
      assert.ok(['alloc', 'admit'].includes(frames[i].kind), `${name}: hash ${was} vanished in a ${frames[i].kind} frame`);
      assert.ok(frames.slice(i).some(f => f.step === frames[i].step && f.kind === 'evict' && f.focus.blocks.includes(b.id)),
        `${name}: the eviction of block ${b.id} is narrated`);
    }
  }
});

test('the victim is running[-1], requeued at the front, and nobody is admitted in that step', () => {
  const frames = run('return');
  const victims = frames.filter(f => f.kind === 'victim');
  assert.ok(victims.length > 0, 'the scenario must preempt');
  for (const v of victims) {
    const prev = frames[v.index - 1];
    assert.equal(v.focus.request, prev.running.at(-1));
    const requeued = frames.slice(v.index).find(f => f.kind === 'requeue');
    assert.equal(requeued.waiting[0], v.focus.request);
    assert.equal(requeued.requests[v.focus.request].computed, 0);
    assert.ok(!frames.some(f => f.step === v.step && f.kind === 'admit'), 'no admission in a preempting step');
  }
});

test('the victim can be the request that asked', () => {
  const frames = simulate({ blockSize: 4, totalBlocks: 3, prefixCaching: true,
    requests: [{ id: 'A', arriveStep: 1, promptTokens: 8, outputTokens: 12 }] });
  const nospace = frames.find(f => f.kind === 'nospace');
  assert.ok(nospace, 'a single request that outgrows the pool must hit pressure');
  const victim = frames[nospace.index + 1];
  assert.equal(victim.kind, 'victim');
  assert.equal(victim.focus.request, nospace.focus.request);
});

test('a prefix hit never covers the last token', () => {
  for (const { frames } of ALL) for (const f of frames.filter(x => x.kind === 'admit')) {
    const r = f.requests[f.focus.request];
    assert.ok(r.fromCache <= r.length - 1);
    assert.equal(r.fromCache % 4, 0);
  }
});

test('"Preempted, then back" shows the whole story', () => {
  const frames = run('return');
  const victim = frames.find(f => f.kind === 'victim').focus.request;
  const evicted = frames.filter(f => f.kind === 'evict');
  assert.ok(evicted.length > 0, 'someone must take a ghost block');
  const readmit = frames.find(f => f.kind === 'admit' && f.focus.request === victim && f.requests[victim].preemptions > 0);
  const r = readmit.requests[victim];
  assert.ok(r.fromCache > 0 && r.fromCache < r.length - 1, 'part, not all, of the cache survives');
  assert.ok(frames.some(f => f.kind === 'wait'), 'a later arrival waits on the full-sequence check');
});

test('with prefix caching off, nothing is hashed and the victim recomputes everything', () => {
  const frames = run('no-cache');
  assert.deepEqual(scenario('no-cache').config.requests, scenario('return').config.requests, 'the same requests, only caching differs');
  assert.ok(frames.every(f => f.pool.every(b => b.hash === null)));
  assert.ok(frames.every(f => Object.values(f.requests).every(r => r.fromCache === 0)));
});

test('a shared system prompt is referenced twice while live and found again later', () => {
  const frames = run('shared');
  assert.ok(frames.some(f => f.pool.some(b => b.ref === 2)));
  const c = frames.find(f => f.kind === 'admit' && f.focus.request === 'C');
  assert.equal(c.requests.C.fromCache, 8, 'twelve cached tokens, capped to two blocks');
});

test('code pointers are permalinks at the pinned commit', () => {
  for (const { frames } of ALL) for (const f of frames) if (f.code) {
    assert.match(f.code, /^vllm\/v1\/[\w/]+\.py(:\d+)?$/);
    assert.ok(codeUrl(f.code).startsWith(`https://github.com/vllm-project/vllm/blob/${VLLM_COMMIT}/vllm/v1/`));
  }
});
