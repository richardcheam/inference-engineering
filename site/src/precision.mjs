// Storage format and execution format are different questions. These entries say what a
// checkpoint holds; whether a kernel computes in that format depends on the hardware and
// the backend, and must be checked per deployment rather than assumed from the file.
export const formats = [
  { id: 'bf16', label: 'BF16', bits: 16, quantized: false, executesNatively: true,
    note: 'The common training and serving baseline. Matrix units compute in it directly.' },
  { id: 'fp8', label: 'FP8', bits: 8, quantized: true, executesNatively: true,
    note: 'Executes natively on recent accelerators. Older parts store it and upcast, which keeps the memory saving and loses the arithmetic one.' },
  { id: 'int8', label: 'INT8', bits: 8, quantized: true, executesNatively: true,
    note: 'Widely supported for weights. Integer paths need their accumulator and dequantisation points checked, not assumed.' },
  { id: 'fp4', label: 'FP4', bits: 4, quantized: true, executesNatively: false,
    note: 'Usually a storage format: weights are unpacked and computed at higher precision. The memory saving is real; the arithmetic saving often is not.' },
  { id: 'int4', label: 'INT4', bits: 4, quantized: true, executesNatively: false,
    note: 'Packed storage with per-group scales. Expect dequantisation on the critical path unless the backend documents otherwise.' },
];

/**
 * Bytes a checkpoint occupies at a given storage format, including the scales.
 * CALCULATED ESTIMATE over a uniform parameter count; a real checkpoint mixes formats
 * across tensors, which is why the pinned indices are summed rather than approximated.
 */
export function quantize({ parameters, format, groupSize, scaleBits }) {
  const spec = formats.find(f => f.id === format);
  if (!spec) throw new RangeError('Unknown format');
  if (!Number.isFinite(parameters) || parameters <= 0) throw new RangeError('Invalid parameter count');
  if (!Number.isFinite(groupSize) || groupSize <= 0) throw new RangeError('Invalid group size');
  if (!Number.isFinite(scaleBits) || scaleBits <= 0) throw new RangeError('Invalid scale width');

  const payloadBytes = parameters * spec.bits / 8;
  // One scale per group of values, only for formats that need them.
  const scaleBytes = spec.quantized ? (parameters / groupSize) * (scaleBits / 8) : 0;
  const totalBytes = payloadBytes + scaleBytes;
  const bf16Bytes = parameters * 2;

  return {
    payloadBytes, scaleBytes, totalBytes,
    effectiveBitsPerParameter: (totalBytes * 8) / parameters,
    nominalBits: spec.bits,
    scaleOverheadFraction: totalBytes === 0 ? 0 : scaleBytes / totalBytes,
    savingVsBf16: 1 - totalBytes / bf16Bytes,
    executesNatively: spec.executesNatively,
    note: spec.note,
    label: spec.label,
  };
}
