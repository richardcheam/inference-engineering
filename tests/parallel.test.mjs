import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = new URL('../site/src/parallel.mjs', import.meta.url);
let placeMemory, strategies;
try { ({ placeMemory, strategies } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const records = JSON.parse(readFileSync(new URL('../experiments/001-feasibility/calculations.json', import.meta.url)));
const base = { model: 'mistral-medium-3.5', devices: 4, strategy: 'tp', context: 32768, sequences: 8, kvHeads: 8 };
const run = (o = {}) => {
  assert.equal(typeof placeMemory, 'function', 'The placement model must be implemented');
  return placeMemory({ ...base, ...o }, records);
};

test('tensor parallelism divides the weights across devices', () => {
  const one = run({ devices: 1 });
  const four = run({ devices: 4 });
  assert.ok(Math.abs(four.weightBytesPerDevice - one.weightBytesPerDevice / 4) < 1, 'weights shard');
  assert.equal(four.weightBytesTotal, one.weightBytesTotal, 'the checkpoint itself does not change size');
});

test('data parallelism replicates the weights on every device', () => {
  const r = run({ strategy: 'dp', devices: 4 });
  const one = run({ strategy: 'dp', devices: 1 });
  assert.equal(r.weightBytesPerDevice, one.weightBytesPerDevice, 'each replica holds the whole model');
  assert.equal(r.weightBytesTotal, one.weightBytesTotal * 4, 'so aggregate memory spent on weights multiplies');
});

test('tensor parallelism cannot shard past the stored KV heads', () => {
  const ok = run({ devices: 8, kvHeads: 8 });
  assert.equal(ok.kvReplicas, 1, 'eight heads across eight devices is one head each');
  const over = run({ devices: 16, kvHeads: 8 });
  assert.equal(over.kvReplicas, 2, 'past that, KV heads are replicated rather than split');
  assert.ok(over.cacheBytesTotal > ok.cacheBytesTotal, 'replication costs real aggregate memory');
});

test('cache per device falls with sharding but total cache does not', () => {
  const one = run({ devices: 1, kvHeads: 8 });
  const four = run({ devices: 4, kvHeads: 8 });
  assert.equal(four.cacheBytesTotal, one.cacheBytesTotal, 'no replication yet, so no extra bytes');
  assert.ok(four.cacheBytesPerDevice < one.cacheBytesPerDevice);
});

test('adding devices adds aggregate capacity and per-step communication', () => {
  const two = run({ devices: 2 });
  const eight = run({ devices: 8 });
  assert.ok(eight.capacityBytesTotal > two.capacityBytesTotal);
  assert.ok(eight.collectivesPerStep > two.collectivesPerStep, 'more ranks, more synchronisation points');
  assert.equal(run({ devices: 1 }).collectivesPerStep, 0, 'one device never waits for a peer');
});

test('a placement that does not fit is reported rather than rounded away', () => {
  const r = run({ model: 'glm-5.3', devices: 1, strategy: 'tp' });
  assert.equal(r.fits, false);
  assert.ok(r.perDeviceBytes > r.capacityPerDevice);
});

test('expert parallelism spreads experts without replicating them', () => {
  const ep = run({ model: 'glm-5.3', strategy: 'ep', devices: 8 });
  const tp = run({ model: 'glm-5.3', strategy: 'tp', devices: 8 });
  assert.ok(Math.abs(ep.weightBytesTotal - tp.weightBytesTotal) < 1, 'neither duplicates the checkpoint');
  assert.ok(ep.collectivesPerStep > 0, 'routing tokens to experts is itself communication');
});

test('invalid placements never produce a verdict', () => {
  for (const o of [{ devices: 0 }, { devices: -2 }, { devices: 1.5 }, { strategy: 'magic' }, { model: 'missing' }, { context: 0 }, { sequences: 0 }]) {
    assert.throws(() => run(o), /invalid|unknown/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});

test('every strategy is described well enough to choose between them', () => {
  assert.ok(strategies.length >= 3);
  for (const s of strategies) {
    assert.ok(s.id && s.label && s.shards && s.cost, `${s.id} needs what it shards and what it costs`);
  }
});
