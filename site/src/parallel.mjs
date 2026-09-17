import { modelMeta } from './memory.mjs';
import { platforms } from './bandwidth.mjs';

// What each strategy actually divides, and what it charges for doing so.
export const strategies = [
  { id: 'tp', label: 'Tensor parallel', shards: 'Every layer’s weights, and the KV cache along its head dimension',
    cost: 'A collective inside every layer, on the critical path of every step' },
  { id: 'dp', label: 'Data parallel', shards: 'Nothing; each device holds a whole replica and serves its own requests',
    cost: 'Aggregate memory multiplied by the replica count; no per-step communication' },
  { id: 'ep', label: 'Expert parallel', shards: 'The experts of a sparse model, spread across devices',
    cost: 'Routing tokens to wherever their experts live, twice per MoE layer' },
];

const DEFAULT_CAPACITY = platforms['h200-sxm'].capacityBytes;

/**
 * Per-device and aggregate memory for a placement.
 *
 * CALCULATED ESTIMATE. Weights and cache only; activations, workspaces, communication
 * buffers and the engine's own reserve are not modelled here, though chapter one's third term
 * still applies to every device in this picture.
 */
export function placeMemory({ model, devices, strategy, context, sequences, kvHeads, capacityPerDevice }, records) {
  const meta = modelMeta[model];
  if (!meta || !records.weights[model]) throw new RangeError('Unknown model');
  if (!strategies.some(s => s.id === strategy)) throw new RangeError('Unknown strategy');
  if (![devices, context, sequences].every(n => Number.isSafeInteger(n) && n > 0)) throw new RangeError('Invalid placement input');
  if (kvHeads !== undefined && (!Number.isSafeInteger(kvHeads) || kvHeads <= 0)) throw new RangeError('Invalid KV head count');

  const capacity = capacityPerDevice ?? DEFAULT_CAPACITY;
  const weights = records.weights[model].bytes;
  const cachePerToken = records.cache_components[meta.component].bytes_per_token;
  const cacheOneCopy = cachePerToken * context * sequences;

  // Data parallel replicates everything; the sharding strategies divide it.
  const replicas = strategy === 'dp' ? devices : 1;
  const shards = strategy === 'dp' ? 1 : devices;
  const weightBytesPerDevice = weights / shards;
  const weightBytesTotal = weights * replicas;

  // KV heads cannot be split more finely than they exist. Past that, ranks replicate them.
  const heads = kvHeads ?? 8;
  const kvReplicas = strategy === 'dp' ? 1 : Math.max(1, Math.ceil(devices / heads));
  const cacheBytesTotal = cacheOneCopy * (strategy === 'dp' ? 1 : kvReplicas);
  const cacheBytesPerDevice = cacheBytesTotal / devices;

  const perDeviceBytes = weightBytesPerDevice + cacheBytesPerDevice;
  // One collective per layer boundary is the shape, not the count; what matters is that
  // a single device has none and every added rank adds synchronisation.
  const collectivesPerStep = devices === 1 ? 0 : (strategy === 'dp' ? 0 : devices - 1);

  return {
    weightBytesPerDevice, weightBytesTotal, cacheBytesPerDevice, cacheBytesTotal,
    perDeviceBytes, kvReplicas, capacityPerDevice: capacity,
    capacityBytesTotal: capacity * devices,
    fits: perDeviceBytes <= capacity,
    headroomBytes: capacity - perDeviceBytes,
    collectivesPerStep,
    replicas, shards,
  };
}
