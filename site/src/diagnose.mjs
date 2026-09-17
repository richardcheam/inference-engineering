// A differential, not a diagnosis. Each candidate carries the observation that would
// falsify it and the rival explanation it must be separated from, because a hypothesis
// you cannot disprove is not worth ranking.

export const symptoms = [
  { id: 'ttft-high', label: 'Time to first token is high', hint: 'The wait before anything appears' },
  { id: 'tpot-high', label: 'Time per output token is high', hint: 'Steady but slow generation' },
  { id: 'itl-spiky', label: 'Individual token gaps are spiky', hint: 'Occasional long pauses mid-stream' },
  { id: 'throughput-flat', label: 'Throughput stops rising with load', hint: 'More concurrency buys nothing' },
  { id: 'memory-near-cap', label: 'Device memory is near capacity', hint: 'Little headroom reported at runtime' },
  { id: 'util-low', label: 'Accelerator utilisation is low', hint: 'The device looks idle while requests wait' },
  { id: 'scales-poorly', label: 'Adding devices barely helps', hint: 'More hardware, similar latency' },
  { id: 'long-context-only', label: 'Only long-context requests suffer', hint: 'Short prompts are fine' },
];

export const hypotheses = [
  {
    id: 'queueing',
    label: 'Requests are waiting, not running',
    mechanism: 'Admission control or a full batch is holding requests before they reach the model at all.',
    raisedBy: ['ttft-high', 'throughput-flat', 'util-low'],
    discriminator: 'Compare queue residency against execution time per request. If most of the latency is before the first forward pass, the model is not the problem.',
    counter: 'The model itself is slow and there is no queue; execution time alone accounts for the latency.',
  },
  {
    id: 'prefill-bound',
    label: 'Prefill is dominating the step',
    mechanism: 'Long prompts make each scheduled step mostly prefill work, delaying decode for everyone in the batch.',
    raisedBy: ['ttft-high', 'itl-spiky', 'long-context-only'],
    discriminator: 'Hold output length fixed and sweep prompt length alone. If the gaps track prompt length, prefill is interleaving with decode.',
    counter: 'Decode is slow independently of prompt length, which points at bandwidth rather than prefill.',
  },
  {
    id: 'bandwidth-bound',
    label: 'Decode is memory-bandwidth bound',
    mechanism: 'Every step reads the weights and the live cache; at low batch that traffic sets the floor.',
    raisedBy: ['tpot-high', 'util-low'],
    discriminator: 'Raise batch size at fixed context. Bandwidth-bound decode improves aggregate throughput while per-sequence rate falls, exactly as chapter two predicts.',
    counter: 'Throughput does not improve with batch either, which points at queueing or a compute limit instead.',
  },
  {
    id: 'cache-thrash',
    label: 'Cache pressure is forcing eviction and recompute',
    mechanism: 'The cache pool cannot hold every live sequence, so blocks are evicted and later recomputed.',
    raisedBy: ['memory-near-cap', 'itl-spiky', 'throughput-flat', 'long-context-only'],
    discriminator: 'Track preemption and recompute counters against concurrency. Thrashing shows as work rising faster than the load that caused it.',
    counter: 'Memory is merely full but stable, with no preemptions: capacity is tight but not thrashing.',
  },
  {
    id: 'link-bound',
    label: 'Interconnect traffic is the limit',
    mechanism: 'Sharded execution moves activations between devices every layer, and the link is slower than local memory.',
    raisedBy: ['scales-poorly', 'tpot-high'],
    discriminator: 'Run the same workload at a smaller shard count that still fits. If latency improves with fewer devices, communication is charging more than parallelism pays.',
    counter: 'Fewer devices is equal or worse, so the link is not the binding constraint.',
  },
  {
    id: 'offload-stall',
    label: 'Something is being fetched from host memory',
    mechanism: 'Weights or cache that do not fit are moved across the host link on demand, at a fraction of local bandwidth.',
    raisedBy: ['memory-near-cap', 'itl-spiky', 'tpot-high'],
    discriminator: 'Shrink the working set until everything is resident. If the stalls vanish, the transfers were the cause.',
    counter: 'Everything was already resident, so the stalls have another source.',
  },
  {
    id: 'synchronisation',
    label: 'The devices are waiting for each other',
    mechanism: 'A collective or a straggler rank makes every device wait for the slowest one each step.',
    raisedBy: ['scales-poorly', 'util-low', 'itl-spiky'],
    discriminator: 'Capture a timeline and look for matched idle gaps across ranks. Synchronisation shows as gaps that line up; independent slowness does not.',
    counter: 'Ranks are busy at different times with no shared gap, so they are not blocking on each other.',
  },
  {
    id: 'kernel-fallback',
    label: 'A slow kernel path is being taken',
    mechanism: 'An unsupported shape, dtype, or feature falls back to a general implementation instead of the fast one.',
    raisedBy: ['tpot-high', 'long-context-only', 'util-low'],
    discriminator: 'Compare against a nearby supported configuration, one dtype or one attention backend away. A fallback shows as a step change, not a gradient.',
    counter: 'Performance degrades smoothly with size, which looks like a resource limit rather than a fallback.',
  },
];

/**
 * Rank candidates by how many of the observations they explain.
 * With nothing observed, everything scores zero: an empty differential has no leader.
 */
export function rank(observed) {
  const valid = new Set(symptoms.map(s => s.id));
  const seen = (Array.isArray(observed) ? observed : []).filter(id => valid.has(id));
  return hypotheses
    .map(h => ({ ...h, score: h.raisedBy.filter(id => seen.includes(id)).length,
                 explains: h.raisedBy.filter(id => seen.includes(id)) }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}
