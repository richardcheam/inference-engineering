import { prefixReuse } from './prefix.mjs';

/**
 * A teaching model of an engine step loop, not a model of vLLM's scheduler.
 *
 * What it keeps faithful, because these are the points of chapter four:
 *  - cache is allocated in fixed-size blocks, and a sequence rounds up to whole blocks
 *  - a new block opens exactly when the previous one fills
 *  - a request that cannot be given blocks waits instead of running
 *  - admission checks the prompt, not the growth, so the pool can run out mid-flight and
 *    something has to be preempted and recomputed
 *  - prefix reuse is capped one token short of the prompt and aligned down to a block,
 *    using the same arithmetic as the static explorer so the two cannot disagree
 *
 * What it leaves out: chunked prefill, real continuous-batching policy, eviction order,
 * cache groups, and every real admission heuristic. Preemption here is last-admitted-first,
 * which is a choice made for legibility, not a claim about what any engine does.
 */
export function simulate({ requests, blockSize, totalBlocks, prefixCaching }) {
  if (!Number.isSafeInteger(blockSize) || blockSize <= 0) throw new RangeError('Invalid block size');
  if (!Number.isSafeInteger(totalBlocks) || totalBlocks <= 0) throw new RangeError('Invalid pool size');
  if (!Array.isArray(requests) || requests.length === 0) throw new RangeError('Invalid request list');
  for (const r of requests) {
    if (!r.id) throw new RangeError('Invalid request without an id');
    if (!Number.isSafeInteger(r.promptTokens) || r.promptTokens <= 0) throw new RangeError('Invalid prompt length');
    if (!Number.isSafeInteger(r.outputTokens) || r.outputTokens <= 0) throw new RangeError('Invalid output length');
    if (!Number.isSafeInteger(r.arriveAt) || r.arriveAt < 0) throw new RangeError('Invalid arrival time');
  }

  const state = {};
  for (const r of requests) {
    state[r.id] = { ...r, phase: 'unborn', tokens: 0, blocks: [], reusedTokens: 0, emitted: 0 };
  }
  let pool = [];                       // { owner, index, tokens, kind, shared }
  let queue = [];
  const cachedPrefixes = new Map();    // prefixTag -> tokens available to reuse
  const frames = [];
  const freeBlocks = () => totalBlocks - pool.length;

  const snapshot = (step, events) => ({
    step, events,
    pool: pool.map(b => ({ ...b })),
    queue: [...queue],
    requests: Object.fromEntries(Object.entries(state).map(([id, r]) => [id, {
      phase: r.phase, tokens: r.tokens, emitted: r.emitted, reusedTokens: r.reusedTokens,
      promptTokens: r.promptTokens, outputTokens: r.outputTokens, blocks: r.blocks.length,
    }])),
    usedBlocks: pool.length, totalBlocks, freeBlocks: freeBlocks(),
    allDone: Object.values(state).every(r => r.phase === 'done'),
  });

  const allocate = (r, kind) => {
    if (freeBlocks() <= 0) return false;
    pool.push({ owner: r.id, index: r.blocks.length, tokens: 0, kind, shared: false });
    r.blocks.push(pool[pool.length - 1]);
    return true;
  };

  let step = 0;
  frames.push(snapshot(step, ['Nothing has arrived yet.']));

  const guard = requests.reduce((n, r) => n + r.promptTokens + r.outputTokens, 0) * 4 + 50;
  while (!Object.values(state).every(r => r.phase === 'done') && step < guard) {
    step += 1;
    const events = [];

    for (const r of requests) {
      const s = state[r.id];
      if (s.phase === 'unborn' && r.arriveAt <= step) {
        s.phase = 'queued';
        queue.push(r.id);
        events.push(`${r.id} arrives with a ${r.promptTokens}-token prompt.`);
      }
    }

    // Admission: only if the whole prompt can be given blocks now.
    for (const id of [...queue]) {
      const s = state[id];
      let reused = 0;
      if (prefixCaching && cachedPrefixes.has(s.prefixTag)) {
        const available = cachedPrefixes.get(s.prefixTag);
        reused = prefixReuse({ promptTokens: s.promptTokens, cachedTokens: Math.min(available, s.promptTokens), blockSize }).reusedTokens;
      }
      const toCompute = s.promptTokens - reused;
      const needed = Math.ceil(s.promptTokens / blockSize);
      if (needed > freeBlocks()) {
        events.push(`${id} waits: needs ${needed} blocks, ${freeBlocks()} free.`);
        continue;
      }
      queue = queue.filter(q => q !== id);
      s.phase = 'prefill';
      s.reusedTokens = reused;
      for (let i = 0; i < needed; i++) allocate(s, 'prompt');
      // Fill the prompt blocks, marking the reused ones as shared.
      let remaining = s.promptTokens;
      s.blocks.forEach((b, i) => {
        b.tokens = Math.min(blockSize, remaining);
        remaining -= b.tokens;
        b.shared = reused > 0 && (i + 1) * blockSize <= reused;
      });
      s.tokens = s.promptTokens;
      events.push(reused > 0
        ? `${id} reuses ${reused} cached tokens and recomputes ${toCompute}.`
        : `${id} prefills ${s.promptTokens} tokens into ${needed} blocks.`);
    }

    // One decode token per running request.
    for (const r of requests) {
      const s = state[r.id];
      if (s.phase === 'blocked' && freeBlocks() > 0) s.phase = 'decode';
      if (s.phase === 'prefill') { s.phase = 'decode'; continue; }
      if (s.phase !== 'decode') continue;
      const last = s.blocks[s.blocks.length - 1];
      if (!last || last.tokens >= blockSize) {
        if (!allocate(s, 'output')) {
          // Admission checked the prompt, not the growth, so the pool can run out mid-flight.
          // A real engine preempts something; here the most recently admitted rival goes back
          // to the queue and will be recomputed from the start.
          const victim = requests
            .map(x => state[x.id])
            .filter(x => x.phase === 'decode' && x.id !== r.id)
            .pop();
          if (victim) {
            const lost = victim.emitted;
            pool = pool.filter(b => b.owner !== victim.id);
            victim.blocks = [];
            victim.phase = 'queued';
            victim.tokens = 0;
            victim.emitted = 0;
            queue.push(victim.id);
            events.push(`${victim.id} is preempted so ${r.id} can continue. Its ${lost} generated ${lost === 1 ? 'token' : 'tokens'} will be recomputed.`);
          }
          if (!allocate(s, 'output')) {
            events.push(`${r.id} stalls: the pool cannot hold this request at all.`);
            s.phase = 'blocked';
            continue;
          }
        }
        events.push(`${r.id} fills a block and opens another.`);
      }
      const tail = s.blocks[s.blocks.length - 1];
      tail.tokens += 1;
      s.tokens += 1;
      s.emitted += 1;
      if (s.emitted >= s.outputTokens) {
        s.phase = 'done';
        if (prefixCaching) {
          cachedPrefixes.set(s.prefixTag, Math.max(cachedPrefixes.get(s.prefixTag) || 0, s.promptTokens));
        }
        pool = pool.filter(b => b.owner !== r.id);
        s.blocks = [];
        events.push(`${r.id} finishes and releases its blocks.`);
      }
    }

    if (!events.length) events.push('Steady decoding.');
    frames.push(snapshot(step, events));
  }
  return frames;
}

export const SCENARIOS = [
  {
    id: 'single',
    label: 'One request, start to finish',
    explains: 'Prefill fills whole blocks, decode appends a token at a time, and a new block opens exactly when the last one fills.',
    config: { requests: [{ id: 'A', arriveAt: 0, promptTokens: 20, outputTokens: 14, prefixTag: 'doc' }], blockSize: 8, totalBlocks: 10, prefixCaching: false },
  },
  {
    id: 'pressure',
    label: 'More requests than blocks',
    explains: 'The pool runs out, so a request waits in the queue rather than running slowly. Capacity becomes admission.',
    config: { requests: [
      { id: 'A', arriveAt: 0, promptTokens: 24, outputTokens: 10, prefixTag: 'a' },
      { id: 'B', arriveAt: 1, promptTokens: 24, outputTokens: 10, prefixTag: 'b' },
      { id: 'C', arriveAt: 1, promptTokens: 24, outputTokens: 10, prefixTag: 'c' },
    ], blockSize: 8, totalBlocks: 9, prefixCaching: false },
  },
  {
    id: 'prefix',
    label: 'A shared prefix, cached',
    explains: 'The second request reuses the aligned prefix blocks and recomputes only the tail: the gap chapter four measures.',
    config: { requests: [
      { id: 'A', arriveAt: 0, promptTokens: 32, outputTokens: 4, prefixTag: 'shared' },
      { id: 'B', arriveAt: 7, promptTokens: 32, outputTokens: 4, prefixTag: 'shared' },
    ], blockSize: 8, totalBlocks: 12, prefixCaching: true },
  },
];
