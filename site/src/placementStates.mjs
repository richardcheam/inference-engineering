// The five states of the placement scroll scene (module 12 §14).
//
// Chapter seven's claim is counterintuitive and quantitative: sharding divides
// the weights, so per-device memory falls, until the device count passes the
// checkpoint's stored KV head count. Past that the cache cannot divide any
// further, ranks replicate it, and aggregate memory starts climbing while you
// are still adding hardware.
//
// Every number here comes from `placeMemory`, the same tested function the
// explorer in §03 runs. The scene reports what that model says at each device
// count rather than illustrating the shape of the argument.

import { placeMemory } from './parallel.mjs';

export const LADDER = [1, 2, 4, 8, 16];

/**
 * Runs the ladder and labels the moment the KV heads run out. `kvHeads` is the
 * checkpoint's stored head count: the point past which the cache replicates.
 */
export function placementStates({ model, context, sequences, kvHeads, capacityPerDevice }, records) {
  const rung = devices => ({
    devices,
    ...placeMemory({ model, devices, strategy: 'tp', context, sequences, kvHeads, capacityPerDevice }, records),
  });
  const ladder = LADDER.map(rung);
  const first = ladder[0];
  // The first rung whose cache had to be replicated, which is the turn.
  const turnIndex = ladder.findIndex(r => r.kvReplicas > 1);
  if (turnIndex < 0) {
    throw new Error('placement scene: the ladder never passes the KV head count');
  }
  const turn = ladder[turnIndex];
  const beforeTurn = ladder[turnIndex - 1];
  const last = ladder[ladder.length - 1];

  const states = [
    {
      id: 'one-device', devices: 1, focus: 'perDevice', label: 'One device holds everything',
      caption: `A single device carries the whole checkpoint and the whole cache. Per device that is ${gb(first.perDeviceBytes)} GB against ${gb(first.capacityPerDevice)} GB of capacity.`,
    },
    {
      id: 'shard', devices: 2, focus: 'perDevice', label: 'Sharding divides the weights',
      caption: 'Tensor parallelism splits every layer across the devices, so each one holds a fraction of the weights and a fraction of the cache. Aggregate weight bytes do not change: the same checkpoint is simply cut up.',
    },
    {
      id: 'headroom', devices: beforeTurn.devices, focus: 'perDevice', label: 'The last clean division',
      caption: `At ${beforeTurn.devices} devices the cache still divides exactly, because the checkpoint stores ${kvHeads} KV heads and there are no more ranks than heads. Per device is down to ${gb(beforeTurn.perDeviceBytes)} GB.`,
    },
    {
      id: 'head-limit', devices: turn.devices, focus: 'cache', label: 'The heads run out',
      caption: `At ${turn.devices} devices there are more ranks than stored heads, so the cache is replicated ${turn.kvReplicas} times. Aggregate cache memory goes from ${gb(beforeTurn.cacheBytesTotal)} GB to ${gb(turn.cacheBytesTotal)} GB: you added hardware and spent more total memory on the same workload.`,
    },
    {
      id: 'charge', devices: last.devices, focus: 'sync', label: 'And every rank charges for it',
      caption: `Each added rank also adds synchronisation. At ${last.devices} devices a step carries ${last.collectivesPerStep} collectives, every one of them on the critical path, and the slowest rank sets the pace for all of them.`,
    },
  ];

  return { ladder, states, turnDevices: turn.devices };
}

const gb = bytes => {
  const value = bytes / 1e9;
  return value.toFixed(value < 10 ? 1 : 0);
};
