import { modelMeta } from './memory.mjs';

// VERIFIED FACT: advertised capacity and peak local memory bandwidth, copied from the
// pinned table in hardware/reference.md. Vendor decimal units. These are not measured
// sustained bandwidth and not guaranteed allocatable capacity.
export const platforms = {
  'rtx-5090': { name: 'RTX 5090', memory: '32 GB GDDR7', capacityBytes: 32e9, bandwidthBytesPerSecond: 1792e9, lesson: 'Consumer capacity and backend differences' },
  'h100-sxm': { name: 'H100 SXM', memory: '80 GB HBM3', capacityBytes: 80e9, bandwidthBytesPerSecond: 3350e9, lesson: 'Hopper baseline; not the PCIe part' },
  'h200-sxm': { name: 'H200 SXM', memory: '141 GB HBM3e', capacityBytes: 141e9, bandwidthBytesPerSecond: 4800e9, lesson: 'More capacity and bandwidth, same family' },
  'gh200-hbm3e': { name: 'GH200 HBM3e', memory: 'Up to 144 GB HBM3e', capacityBytes: 144e9, bandwidthBytesPerSecond: 4900e9, lesson: 'Grace memory is a separate, slower pool', qualifier: 'up to' },
  'b200-sxm': { name: 'B200 SXM', memory: '180 GB HBM3e', capacityBytes: 180e9, bandwidthBytesPerSecond: 8000e9, lesson: 'Blackwell formats and interconnect', qualifier: 'up to' },
  'mi300x': { name: 'AMD MI300X', memory: '192 GB HBM3', capacityBytes: 192e9, bandwidthBytesPerSecond: 5300e9, lesson: 'Capacity must be paired with ROCm support' },
};

// What the whole-cache re-read assumption does and does not cover, per architecture.
export const readScopes = {
  'mistral-medium-3.5': 'Conventional GQA. Every live token is read from cache on every step, so this bound models the traffic fairly.',
  'qwen3.6-35b-a3b': 'Full-attention layers only. Recurrent and convolution state is read too, and this bound does not count those bytes.',
  'glm-5.3': 'Latent and positional KV only. Sparse attention reads less history than it stores, so real traffic should fall below this line.',
  'deepseek-v4.1-flash': 'Report-based global KV only. Local windows, indexer buffers, and sparse selection all change what is actually read.',
};

export const efficiencyPresets = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function resolve({ model, platform }) {
  const meta = modelMeta[model];
  const device = platforms[platform];
  if (!meta) throw new RangeError('Unknown model');
  if (!device) throw new RangeError('Unknown platform');
  return { meta, device };
}

/**
 * Lower bound on decode step time from local memory traffic alone.
 *
 * CALCULATED ESTIMATE. Each step is assumed to read the resident weights once and the
 * live cache of every in-flight sequence once. Compute, communication, launch overhead,
 * and incomplete overlap are not modelled, so a real step can only be slower than this.
 */
export function decodeStepBound({ model, platform, context, batch, efficiency }, records) {
  const { meta, device } = resolve({ model, platform });
  if (!records.weights[model]) throw new RangeError('Unknown model');
  if (![context, batch].every(n => Number.isSafeInteger(n) && n > 0)) throw new RangeError('Invalid decode step input');
  if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1) throw new RangeError('Invalid bandwidth efficiency');

  const weightBytes = records.weights[model].bytes;
  const cacheBytes = records.cache_components[meta.component].bytes_per_token * context * batch;
  const bytesPerStep = weightBytes + cacheBytes;
  const effectiveBandwidth = device.bandwidthBytesPerSecond * efficiency;
  const stepSeconds = bytesPerStep / effectiveBandwidth;
  if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) throw new RangeError('Invalid decode step result');

  return {
    weightBytes, cacheBytes, bytesPerStep, effectiveBandwidth, stepSeconds,
    weightBytesPerToken: weightBytes / batch,
    cacheBytesPerToken: cacheBytes / batch,
    bytesPerToken: bytesPerStep / batch,
    weightShare: weightBytes / bytesPerStep,
    tokensPerSecond: batch / stepSeconds,
    tokensPerSecondPerSequence: 1 / stepSeconds,
    residentBytes: bytesPerStep,
    capacityBytes: device.capacityBytes,
    fitsCapacity: bytesPerStep <= device.capacityBytes,
    partial: meta.partial,
    readScope: readScopes[model],
  };
}

/** The same bound across a range of batch sizes, for the amortization chart. */
export function amortizationCurve(settings, records, batches) {
  return batches.map(batch => ({ batch, ...decodeStepBound({ ...settings, batch }, records) }));
}
