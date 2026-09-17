import { test } from 'node:test';
import assert from 'node:assert/strict';
import records from '../experiments/001-feasibility/calculations.json' with { type: 'json' };
import { placementStates, LADDER } from '../site/src/placementStates.mjs';

const INPUT = { model: 'glm-5.3', context: 32768, sequences: 8, kvHeads: 8, capacityPerDevice: 141e9 };

test('the ladder climbs the device counts the scene shows', () => {
  const { ladder } = placementStates(INPUT, records);
  assert.deepEqual(ladder.map(r => r.devices), LADDER);
});

test('per-device memory falls while devices are still dividing the cache', () => {
  const { ladder, turnDevices } = placementStates(INPUT, records);
  const clean = ladder.filter(r => r.devices <= turnDevices / 2);
  for (let i = 1; i < clean.length; i++) {
    assert.ok(clean[i].perDeviceBytes < clean[i - 1].perDeviceBytes,
      `per-device memory did not fall from ${clean[i - 1].devices} to ${clean[i].devices} devices`);
  }
});

test('aggregate weight bytes never change: sharding cuts up one checkpoint', () => {
  const { ladder } = placementStates(INPUT, records);
  const totals = new Set(ladder.map(r => Math.round(r.weightBytesTotal)));
  assert.equal(totals.size, 1, 'sharding changed the total weight bytes');
});

test('past the stored KV head count the cache replicates', () => {
  const { ladder, turnDevices } = placementStates(INPUT, records);
  assert.equal(turnDevices, 16, 'with 8 stored heads the turn should land at 16 devices');
  for (const rung of ladder) {
    const expected = Math.max(1, Math.ceil(rung.devices / INPUT.kvHeads));
    assert.equal(rung.kvReplicas, expected, `wrong replica count at ${rung.devices} devices`);
  }
});

test('the turn is a real reversal: aggregate cache rises when hardware is added', () => {
  // This is the whole point of the scene. If it ever stops being true, the
  // captions are telling the reader something false.
  const { ladder, turnDevices } = placementStates(INPUT, records);
  const turnIndex = ladder.findIndex(r => r.devices === turnDevices);
  const before = ladder[turnIndex - 1];
  const at = ladder[turnIndex];
  assert.ok(at.cacheBytesTotal > before.cacheBytesTotal,
    `aggregate cache did not rise: ${before.cacheBytesTotal} -> ${at.cacheBytesTotal}`);
  assert.ok(at.devices > before.devices, 'the turn did not add devices');
});

test('collectives per step grow with the rank count', () => {
  const { ladder } = placementStates(INPUT, records);
  assert.equal(ladder[0].collectivesPerStep, 0, 'one device should synchronise with nobody');
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(ladder[i].collectivesPerStep > ladder[i - 1].collectivesPerStep,
      `collectives did not grow from ${ladder[i - 1].devices} to ${ladder[i].devices} devices`);
  }
});

test('the five states are in reading order and each names its device count', () => {
  const { states } = placementStates(INPUT, records);
  assert.deepEqual(states.map(s => s.id),
    ['one-device', 'shard', 'headroom', 'head-limit', 'charge']);
  for (let i = 1; i < states.length; i++) {
    assert.ok(states[i].devices >= states[i - 1].devices,
      `state ${states[i].id} goes backwards down the ladder`);
  }
});

test('a checkpoint with more heads than devices fails loudly rather than telling a false story', () => {
  // With 64 stored heads the ladder never replicates, so there is no turn and
  // the scene has no point to make.
  assert.throws(() => placementStates({ ...INPUT, kvHeads: 64 }, records),
    /never passes the KV head count/);
});

test('no two consecutive states render the same frame', () => {
  // Two states on the same rung with nothing else distinguishing them would
  // read as the same picture twice, which is the failure that makes a scene
  // feel like fixed frames rather than a mechanism.
  const { states } = placementStates(INPUT, records);
  for (let i = 1; i < states.length; i++) {
    const a = states[i - 1], b = states[i];
    assert.ok(a.devices !== b.devices || a.focus !== b.focus,
      `states "${a.id}" and "${b.id}" both show ${b.devices} devices focused on ${b.focus}`);
  }
});

test('every state names the quantity its caption is about', () => {
  const { states } = placementStates(INPUT, records);
  const allowed = new Set(['perDevice', 'cache', 'sync']);
  for (const s of states) {
    assert.ok(allowed.has(s.focus), `state "${s.id}" has no usable focus: ${s.focus}`);
  }
  // The turn must draw the eye to the number that turns.
  assert.equal(states.find(s => s.id === 'head-limit').focus, 'cache');
  assert.equal(states.find(s => s.id === 'charge').focus, 'sync');
});
