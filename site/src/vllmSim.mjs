// A teaching model of vLLM V1's KV block pool and scheduler, pinned to
// vllm-project/vllm main at 05d8963. It is a separate module from `engineSim.mjs`
// on purpose: that one is engine-agnostic, this one follows one engine's rules.
//
// Kept faithful to vLLM:
// - the free queue order: a block whose reference count reaches zero goes to the
//   back if it is full and hashed, to the front otherwise; a request frees its
//   blocks tail first (block_pool.py free_blocks)
// - lazy eviction: a hashed block keeps its contents until it is taken off the
//   front for someone else (block_pool.py _maybe_evict_cached_block)
// - prefix hits pull blocks back out of the free queue (touch), capped one token
//   short of the sequence
// - admission only when the whole sequence fits, minus reused blocks
// - the FCFS victim is running[-1], which can be the requester itself; it is
//   requeued at the front with its progress reset; no admissions in a step that
//   preempted (sched/scheduler.py)
// Simplified: each prefill runs in one step (no chunking), one KV cache group, no
// speculative decoding, no watermark, no async scheduling.
//
// Every frame is self-contained, so stepping, seeking and testing all work on
// the same thing the eye sees.

export const VLLM_COMMIT = '05d89636fca80d806732ced636ef505f42e6fe35';

/** A GitHub permalink for a frame's `code` field, e.g. `vllm/v1/core/block_pool.py:776`. */
export function codeUrl(code) {
  if (!code) return null;
  const [path, line] = code.split(':');
  return `https://github.com/vllm-project/vllm/blob/${VLLM_COMMIT}/${path}${line ? `#L${line}` : ''}`;
}

export function simulate(config) {
  const { blockSize: bs, totalBlocks: nBlocks, prefixCaching: caching, requests } = config;
  const reqs = requests.map(r => ({ id: r.id, arrive: r.arriveStep, prompt: r.promptTokens, output: r.outputTokens, prefix: r.prefixTag, shared: r.sharedTokens || 0 }));
  const blocks = Array.from({ length: nBlocks }, (_, id) => ({ id, owner: null, hash: null, ref: 0, fill: 0 }));
  let freeQ = blocks.map(b => b.id);
  const hashMap = new Map();
  const R = {};
  const order = reqs.map(r => r.id);
  for (const r of reqs) R[r.id] = { ...r, status: 'future', len: r.prompt, generated: 0, computed: 0, blocks: [], preemptions: 0, hit: 0, recompute: 0 };
  let running = [], waiting = [];
  const frames = [];
  let step = 0;

  const hashOf = (r, j) => ((j + 1) * bs <= (r.shared || 0) ? `${r.prefix}·${j}` : `${r.id}·${j}`);
  const snap = (kind, text, code, hl = {}) => frames.push({
    index: frames.length, step, kind, text: text.trim(),
    code: code ? `vllm/${code}` : null,
    focus: { request: hl.req ?? null, requests: hl.reqs ?? [], blocks: hl.blocks ?? [], victim: !!hl.victim },
    pool: blocks.map(b => ({ id: b.id, owner: b.owner, hash: b.hash, ref: b.ref, tokens: b.fill })),
    freeQueue: [...freeQ],
    running: [...running], waiting: [...waiting],
    requests: Object.fromEntries(order.map(id => { const r = R[id]; return [id, { status: r.status, length: r.len, promptTokens: r.prompt, outputTokens: r.output, generated: r.generated, computed: r.computed, blocks: [...r.blocks], preemptions: r.preemptions, fromCache: r.hit }]; })),
  });

  const takeNew = (r, n) => {
    const got = [], evicted = [];
    for (let k = 0; k < n; k++) {
      const id = freeQ.shift();
      const b = blocks[id];
      if (b.hash) { evicted.push({ id, hash: b.hash, was: b.owner }); hashMap.delete(b.hash); b.hash = null; }
      b.ref = 1; b.owner = r.id; b.fill = 0;
      r.blocks.push(id); got.push(id);
    }
    return { got, evicted };
  };
  const freeReq = r => {
    const front = [], back = [];
    for (const id of [...r.blocks].reverse()) {
      const b = blocks[id];
      b.ref -= 1;
      if (b.ref === 0) {
        if (b.hash && caching) back.push(id);
        else { b.hash = null; b.owner = null; b.fill = 0; front.push(id); }
      }
    }
    freeQ = [...front, ...freeQ, ...back];
    const ids = r.blocks; r.blocks = [];
    const shared = ids.filter(id => blocks[id].ref > 0);
    return { ids, front, back, shared };
  };
  const fillAndHash = r => {
    r.blocks.forEach((id, j) => {
      const b = blocks[id];
      if (b.ref > 1) return; // shared prefix block already full
      b.fill = Math.max(0, Math.min(bs, r.computed - j * bs));
      if (caching && b.fill === bs && !b.hash) {
        const h = hashOf(r, j);
        if (!hashMap.has(h)) { b.hash = h; hashMap.set(h, id); }
      }
    });
  };
  const blocksFor = t => Math.ceil(t / bs);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  snap('idle', 'An empty pool. Every block sits in the free queue in ID order, waiting to be handed out from the front.', 'v1/core/block_pool.py:135');

  const guard = 200;
  while (order.some(id => R[id].status !== 'done') && step < guard) {
    step += 1;
    for (const id of order) {
      const r = R[id];
      if (r.status === 'future' && r.arrive <= step) {
        r.status = 'waiting'; waiting.push(id);
        snap('arrive', `${id} arrives with a ${r.prompt}-token prompt${r.shared ? ` (the first ${r.shared} tokens are the shared "${r.prefix}" prompt)` : ''} and joins the back of the waiting queue.`, 'v1/core/sched/scheduler.py:2557', { req: id });
      }
    }
    const stepFrame = frames.length;
    snap('step', `Engine step ${step}. The scheduler serves running requests first, oldest first, then looks at the waiting queue.`, 'v1/core/sched/scheduler.py:562');

    const scheduled = {};
    let preempted = false;
    for (let i = 0; i < running.length; i++) {
      const r = R[running[i]];
      const newTokens = r.len - r.computed;
      let need = blocksFor(r.computed + newTokens) - r.blocks.length;
      let selfPreempted = false;
      while (need > freeQ.length) {
        snap('nospace', `${r.id} needs ${plural(need, 'new block')} for its next token, but ${freeQ.length === 0 ? 'the free queue is empty' : `only ${freeQ.length} ${freeQ.length === 1 ? 'is' : 'are'} free`}. allocate_slots returns None: that is the whole pressure signal.`, 'v1/core/kv_cache_manager.py:566', { req: r.id });
        const vid = running[running.length - 1];
        const v = R[vid];
        running.pop();
        const self = vid === r.id;
        snap('victim', self
          ? `The victim is running[-1], the most recently admitted request, which here is ${vid} itself. It preempts itself.`
          : `The victim is running[-1], the most recently admitted request: ${vid}.`, 'v1/core/sched/scheduler.py:803', { req: vid, victim: true });
        const { ids, front, back } = freeReq(v);
        v.computed = 0; v.status = 'waiting'; v.preemptions += 1; v.hit = 0; v.recompute = 0;
        waiting.unshift(vid);
        preempted = true;
        snap('free', `${vid} gives back ${plural(ids.length, 'block')}, tail first. ${back.length ? `${plural(back.length, 'full block')} keep their contents and hash and go to the back of the free queue (evicted last). ` : ''}${front.length ? (caching ? `${plural(front.length, 'partly filled block')} ${front.length === 1 ? 'has' : 'have'} no hash and ${front.length === 1 ? 'goes' : 'go'} to the front, to be reused first.` : `With prefix caching off nothing has a hash, so all of them go to the front and their contents are as good as gone.`) : ''}`, 'v1/core/block_pool.py:776', { blocks: ids, req: vid });
        snap('requeue', `${vid} goes to the front of the waiting queue with its progress reset to 0. Its ${plural(v.generated, 'generated token')} are kept as text; their KV will have to come back from the cache or be recomputed.`, 'v1/core/sched/scheduler.py:1538', { req: vid });
        if (self) { selfPreempted = true; break; }
        need = blocksFor(r.computed + newTokens) - r.blocks.length;
      }
      if (selfPreempted) { i -= 1; break; }
      if (need > 0) {
        const { got, evicted } = takeNew(r, need);
        snap('alloc', `${r.id} takes ${got.length === 1 ? `block ${got[0]}` : `blocks ${got.join(', ')}`} from the front of the free queue.`, 'v1/core/block_pool.py:668', { blocks: got, req: r.id });
        for (const e of evicted) snap('evict', `Block ${e.id} was a ghost still holding ${e.was}'s tokens (hash ${e.hash}). Handing it to ${r.id} erases that. Only now is the cached copy gone.`, 'v1/core/block_pool.py:731', { blocks: [e.id], req: r.id, evict: true });
      }
      scheduled[r.id] = newTokens;
    }

    if (preempted && waiting.length) {
      snap('hold', `A request was preempted this step, so the scheduler admits nobody from the waiting queue until the next step.`, 'v1/core/sched/scheduler.py:873');
    } else {
      while (waiting.length) {
        const r = R[waiting[0]];
        const hits = [];
        if (caching) {
          const maxHit = Math.floor((r.len - 1) / bs);
          for (let j = 0; j < maxHit; j++) {
            const id = hashMap.get(hashOf(r, j));
            if (id === undefined) break;
            hits.push(id);
          }
        }
        const need = blocksFor(r.len) - hits.length;
        const hitsInFree = hits.filter(id => blocks[id].ref === 0).length;
        const avail = freeQ.length - hitsInFree;
        if (need > avail) {
          snap('wait', `${r.id} needs ${plural(need, 'block')} to hold its whole sequence${hits.length ? ` beyond ${plural(hits.length, 'cached block')}` : ''}, but only ${avail} ${avail === 1 ? 'is' : 'are'} free. The full-sequence check keeps it waiting instead of admitting it and preempting later.`, 'v1/core/kv_cache_manager.py:515', { req: r.id });
          break;
        }
        waiting.shift();
        if (hits.length) {
          for (const id of hits) { const b = blocks[id]; if (b.ref === 0) freeQ = freeQ.filter(x => x !== id); b.ref += 1; r.blocks.push(id); }
          const capped = caching && Math.floor((r.len - 1) / bs) < Math.floor(r.len / bs) && hits.length === Math.floor((r.len - 1) / bs);
          snap('hit', `Prefix cache hit: ${r.id} finds ${plural(hits.length, 'block')} (${hits.map(id => blocks[id].hash).join(', ')}) still holding its tokens. touch() pulls ${hits.length === 1 ? 'it' : 'them'} out of the free queue and raises the reference count, so nothing is recomputed there.${capped ? ` The hit stops one token short of the sequence, because the last token still needs its logits, so the final full block is recomputed anyway.` : ''}`, 'v1/core/block_pool.py:754', { blocks: hits, req: r.id, hit: true });
        }
        r.computed = hits.length * bs;
        r.hit = r.computed;
        const { got, evicted } = takeNew(r, need);
        r.status = 'running'; running.push(r.id);
        r.recompute = r.len - r.computed;
        scheduled[r.id] = r.len - r.computed;
        snap('admit', `${r.id} is admitted${r.preemptions ? ' again' : ''}: ${r.hit ? `${r.hit} tokens from cache, ` : ''}${r.len - r.computed} tokens to prefill, into ${got.length ? (got.length === 1 ? `block ${got[0]}` : `blocks ${got.join(', ')}`) : 'no new blocks'}.`, 'v1/core/sched/scheduler.py:1209', { blocks: got, req: r.id });
        for (const e of evicted) snap('evict', `Block ${e.id} was a ghost still holding ${e.was}'s tokens (hash ${e.hash}). Handing it to ${r.id} erases that.`, 'v1/core/block_pool.py:731', { blocks: [e.id], req: r.id, evict: true });
      }
    }

    const ids = Object.keys(scheduled);
    if (!ids.length) { snap('idle', 'Nothing could run this step.', 'v1/core/sched/scheduler.py:562'); continue; }
    const desc = ids.map(id => (scheduled[id] > 1 ? `${id} prefills ${scheduled[id]}` : `${id} decodes 1`)).join(', ');
    for (const id of ids) { const r = R[id]; r.computed += scheduled[id]; fillAndHash(r); r.generated += 1; r.len += 1; }
    const quiet = frames.length === stepFrame + 1;
    const filled = [];
    for (const id of ids) for (const bid of R[id].blocks) { const b = blocks[bid]; if (b.hash && !frames[frames.length - 1].pool[bid].hash) filled.push(bid); }
    if (quiet) frames.pop();
    snap('forward', `${quiet ? `Engine step ${step}. ` : ''}Forward pass: ${desc}.${filled.length ? ` ${filled.length === 1 ? `Block ${filled[0]} is` : `Blocks ${filled.join(', ')} are`} now full, so ${filled.length === 1 ? 'it gets' : 'they get'} a hash and the prefix cache can find ${filled.length === 1 ? 'it' : 'them'}.` : ''}`, 'v1/worker/gpu_model_runner.py', { reqs: ids, blocks: filled });
    for (const id of ids) {
      const r = R[id];
      if (r.generated >= r.output) {
        running = running.filter(x => x !== id);
        r.status = 'done';
        const { ids: fb, front, back, shared } = freeReq(r);
        const parts = [];
        if (back.length) parts.push(`${plural(back.length, 'full block')} ${back.length === 1 ? 'stays' : 'stay'} cached as ${back.length === 1 ? 'a ghost' : 'ghosts'} at the back of the free queue`);
        if (front.length) parts.push(caching ? `${plural(front.length, 'block')} with no hash ${front.length === 1 ? 'goes' : 'go'} to the front` : `with prefix caching off, all ${front.length === 1 ? 'of it goes' : 'of them go'} to the front with nothing worth keeping`);
        if (shared.length) parts.push(`${plural(shared.length, 'shared block')} ${shared.length === 1 ? 'is' : 'are'} still in use by another request, so only the reference count drops`);
        snap('finish', `${id} finishes and releases ${plural(fb.length, 'block')}, tail first. ${parts.join('; ')}.`, 'v1/core/sched/scheduler.py:2650', { blocks: fb, req: id });
      }
    }
  }
  snap('done', caching ? 'Every request has finished. Blocks with a hash are still sitting in the free queue, ready to be found again by the next request that shares their tokens.' : 'Every request has finished. With prefix caching off, the free queue is just a list of empty slots.', 'v1/core/block_pool.py:776');
  return frames;
}

export const SCENARIOS = [
  {
    id: 'return',
    label: 'Preempted, then back',
    explains: 'Two requests outgrow an eight-block pool. The newest is preempted, the survivor grows into some of its freed blocks, and when it comes back it finds the rest still cached.',
    config: {
      blockSize: 4, totalBlocks: 8, prefixCaching: true,
      requests: [
        { id: 'A', arriveStep: 1, promptTokens: 12, outputTokens: 10 },
        { id: 'B', arriveStep: 1, promptTokens: 12, outputTokens: 6 },
        { id: 'C', arriveStep: 5, promptTokens: 5, outputTokens: 3 },
      ],
    },
  },
  {
    id: 'no-cache',
    label: 'Same, caching off',
    explains: 'The same three requests with prefix caching off. Nothing freed keeps a hash, so the preempted request comes back to an empty cache and recomputes every token.',
    config: {
      blockSize: 4, totalBlocks: 8, prefixCaching: false,
      requests: [
        { id: 'A', arriveStep: 1, promptTokens: 12, outputTokens: 10 },
        { id: 'B', arriveStep: 1, promptTokens: 12, outputTokens: 6 },
        { id: 'C', arriveStep: 5, promptTokens: 5, outputTokens: 3 },
      ],
    },
  },
  {
    id: 'shared',
    label: 'Shared system prompt',
    explains: 'Three requests share a twelve-token system prompt. B reuses A\'s live blocks. C arrives after both finish and finds the prompt cached, but still recomputes its last block.',
    config: {
      blockSize: 4, totalBlocks: 12, prefixCaching: true,
      requests: [
        { id: 'A', arriveStep: 1, promptTokens: 14, outputTokens: 4, prefixTag: 'sys', sharedTokens: 12 },
        { id: 'B', arriveStep: 2, promptTokens: 15, outputTokens: 3, prefixTag: 'sys', sharedTokens: 12 },
        { id: 'C', arriveStep: 5, promptTokens: 12, outputTokens: 2, prefixTag: 'sys', sharedTokens: 12 },
      ],
    },
  },
];
