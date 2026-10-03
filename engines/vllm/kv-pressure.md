# When the cache is full

Last researched: 2026-09-29

## The question

A model server keeps a cache of attention state for every request it is serving. This is the KV cache: for each token already processed, the keys and values that later tokens need to look back at. It lives in GPU memory, and that memory is finite. So what does vLLM do when a request needs more cache and there is none left? And what does that cost the request that loses out?

Chapter 04 answers this with a deliberately simple simulation that says outright it is not a model of vLLM. This page answers it for vLLM itself, and then lists where the two differ.

## How this was examined

Nothing here was run on a GPU. The answer comes from reading vLLM's source code and tests at one fixed commit, [`05d8963`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35) (29 September 2026), and following one request through the scheduler and the cache allocator. Every link below points at that commit, so the line numbers will not drift. The earlier prefix-caching investigation on the [engine page](current-state.md) used an older commit, `836bb38`, so its line numbers differ.

Each finding carries a label. **Source-code observation** means the code says it directly. **Engineering inference** means it follows from several pieces of code together but no test or measurement confirms it. Where a step needs real hardware to settle, the page says so at that point.

## The pool is a fixed size

vLLM does not grow the cache as demand rises. **SOURCE-CODE OBSERVATION:** when the server starts, it runs one forward pass with dummy inputs to see how much memory the model needs at its peak ([`determine_available_memory`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/worker/gpu_worker.py#L571-L626)). It is allowed to use 92% of the GPU's memory by default ([`gpu_memory_utilization`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/cache.py#L103-L108)), and whatever is left inside that 92% after the weights and the peak activations becomes the KV cache. That space is cut into fixed-size blocks, each holding the cache for a few tokens ([`get_kv_cache_configs`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_utils.py#L2628)). An operator can skip the measurement and name a size directly with [`kv_cache_memory_bytes`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/cache.py#L249-L256).

The number of blocks is then fixed for the life of the server. Pressure never means the pool shrinking. It means more requests, or longer ones, asking for the same number of blocks.

## How the scheduler finds out it has run out

The scheduler runs in steps. In each step it first serves the requests that are already running, oldest first, and only then looks at the queue of requests waiting to start ([`schedule()`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L562)).

For each running request it asks the cache manager for the blocks that request's next tokens need ([`allocate_slots`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L371)). **SOURCE-CODE OBSERVATION:** if the request needs more blocks than are free, the call simply returns `None` ([lines 564 to 570](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L564-L570)). There is no warning level and no gradual slowdown. The scheduler learns the pool is full at the moment an allocation fails.

Waiting requests are treated more gently. A waiting request that does not fit just stays in the queue, and nothing is taken from anyone else to make room for it ([line 1209](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L1209-L1230)). Under the default first-come, first-served policy, the queue also stops there: the requests behind it are not tried in that step, even if they would fit.

## Preemption: taking blocks back

When a *running* request cannot get a block, the scheduler takes blocks away from another running request. This is preemption. The request that loses its blocks is the victim.

**SOURCE-CODE OBSERVATION:** under first-come, first-served, the victim is the most recently admitted running request, `running[-1]` in the code ([scheduler.py lines 765 to 771](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L765-L771)). That can be the very request that asked for the block, in which case it preempts itself and stops for this step. Under the priority policy, the victim is the lowest-priority request, and among equals the one that arrived last. The scheduler repeats this until the allocation fits, so one shortage can preempt several requests. It holds back in two cases: when blocks are already on their way back from a transfer, and when the victim's blocks cannot be released until a later step. The full loop is quoted in the appendix.

Being preempted does not throw the request away ([`_preempt_request`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L1538-L1581)). The request keeps its prompt and every token it has generated so far. What it loses is the KV cache for those tokens. vLLM releases its blocks, resets its count of processed tokens to zero, and puts it back at the **front** of the waiting queue, ahead of requests that have not started yet. Nothing new is admitted in a step that preempted ([line 873](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L873)).

**VERIFIED FACT at `05d8963`:** recomputation is the only kind of preemption. Older vLLM versions could also copy a victim's cache to CPU memory ("swap"), but no such mode exists anywhere under `vllm/v1` or `vllm/config`.

For the person waiting on that request, preemption means the response stops part-way. It resumes only after the request is readmitted and its cache has been rebuilt. How long that takes depends on how much has to be rebuilt, which is the next section.

## A freed block is not wiped

This is the part of the mechanism that surprises people. With prefix caching on, which is vLLM's default, a freed block keeps its contents until another request needs the space.

Prefix caching lets a request reuse cache that an earlier request already computed for the same tokens. To make that possible, every full block gets a hash, a fingerprint of the tokens it holds. When a block is freed, vLLM puts it on a free queue rather than clearing it. **SOURCE-CODE OBSERVATION:** blocks with a hash go to the back of the queue, and blocks without one (a half-filled final block, say) go to the front ([`free_blocks`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L776-L807)). A request's blocks are released tail first ([`free`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L576-L584)), so the beginning of its prompt ends up furthest back and survives longest.

New blocks are always taken from the front of the queue. Only at that moment does a block lose its hash and its old contents ([`get_new_blocks`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L668-L702) and [`_maybe_evict_cached_block`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L731-L752)). Until then, a request that finds a matching hash can pull the block straight back out of the middle of the queue ([`touch`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L754-L770)). The queue is a doubly linked list precisely so that this is cheap ([`FreeKVCacheBlockQueue`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_utils.py#L247-L263)).

**Engineering inference:** a preempted request that comes back before its blocks are reused recomputes only the blocks that were taken. The steps connecting this are all in the source. A readmitted request starts with zero processed tokens, and that triggers a prefix-cache lookup ([scheduler.py line 930](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L929-L934)). Its own full blocks are still hashed in the free queue, so the lookup finds them. vLLM's tests confirm the first half: a preempted request goes through the lookup again when it returns ([`test_preemption_re_records_prefix_cache_query`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/tests/v1/core/test_scheduler.py#L1397-L1430)). No test checks how much of a victim's own cache it gets back, which is why this stays an inference.

Two limits apply even when every block survives. Only confirmed tokens are cached, so draft tokens from speculative decoding never are ([lines 597 to 606](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L597-L606)). And the lookup always stops one token short, because the last token must be computed to produce the next one. The final block is therefore recomputed in any case ([lines 289 to 295](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L289-L295)), the same rule chapter 04 measures for an ordinary cache hit.

### A worked example

FIG. 17 in [chapter 04](#engine) plays this out step by step. It uses a teaching model built on the rules above (**Conceptual**: an illustration of the mechanism, not a measurement). The pool has eight blocks of four tokens. Two requests, A and B, each arrive with a 12-token prompt.

Both start running, and their prompts fill six of the eight blocks. Each takes one more block as it generates, and the pool is full. A third request, C, arrives with a short prompt and has to wait. At step 6, A needs another block and none is free. B was admitted after A, so B is preempted. It gives back its four blocks, all of them full, so all four keep their contents at the back of the free queue. B goes to the front of the waiting queue, ahead of C, which has been waiting longer.

A keeps generating and takes blocks from the front of the free queue as it needs them. Two of the blocks it takes held B's tokens, and those are now gone. When A finishes at step 10, B is readmitted. Its sequence is 17 tokens long by then: the 12-token prompt plus 5 tokens it had already generated. It finds its first two blocks, 8 tokens, still cached, and recomputes the other 9. C is admitted in the same step.

Run the same three requests with prefix caching off, and nothing freed keeps a hash. B recomputes all 17 tokens. The requests and the pool are identical in both runs; only the cache setting changes. So the cost of a preemption is not fixed. It depends on what ran while the victim was waiting.

## Freeing blocks before a request finishes

Some blocks can be released while a request is still running. **SOURCE-CODE OBSERVATION:** every allocation first drops blocks the request no longer needs, and only then checks whether there is room ([line 547](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L538-L551)). A request therefore makes room for itself before anyone else is touched. (This happens after the admission check described in the next section, not before it.)

Whether anything can be dropped depends on the attention type. A full-attention layer looks back at every earlier token, so it never releases anything early ([lines 704 to 733](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L704-L733)). A sliding-window layer only looks back a fixed number of tokens, so whole blocks that fall behind the window can go ([`SlidingWindowManager`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L946)). Its docstring has a worked example ([lines 1148 to 1183](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L1148-L1183)): with a window of 4 tokens and 7 tokens processed, tokens 0 to 3 are no longer needed. vLLM counts only tokens it has finished processing when deciding this, not tokens scheduled in a step still running, because that step may still read them. Models that mix both layer types share one pool through the [hybrid KV cache manager](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/design/hybrid_kv_cache_manager.md).

## Settings that keep preemption rare

Preemption wastes work already done, so vLLM tries to avoid it at the door instead. **SOURCE-CODE OBSERVATION:** four settings move the point of failure from the middle of a request to its admission, where waiting costs nothing already computed.

| Setting | Default | What it does |
|---|---|---|
| [`scheduler_reserve_full_isl`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/scheduler.py#L191-L195) | on | Admits a request only if its whole prompt fits, not just the first piece of it ([check](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L515-L531)) |
| [`watermark`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/scheduler.py#L197-L202) | 0, so off | Keeps a fraction of blocks spare when admitting new or preempted requests |
| [`reserved_blocks`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L1194-L1204) | worked out each step | When cache is being loaded from elsewhere, admits the load only if prompts already in progress keep their room |
| [`num_lookahead_tokens`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L747-L751) | set by speculative decoding | Reserves room for draft tokens in every allocation |

None of these makes the pool bigger. They only change when a shortage is discovered.

## Beyond GPU memory

Recomputation is the only remedy inside GPU memory, but vLLM can also keep cache outside it. The [OffloadingConnector](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/kv_offloading_usage.md) copies completed blocks to CPU memory as they are produced. A block lost on the GPU can then be copied back instead of recomputed. [HiSparse](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/design/hisparse.md), still experimental, keeps the most-used cache on the GPU in front of a larger store in CPU memory.

**Engineering inference:** the choice of victim ignores both how many blocks a request holds and how expensive it would be to restore. Without an offload tier those matter less, because everything lost is recomputed anyway. With one, two requests can differ a lot in what it costs to bring them back, and the two lines that pick the victim are where an offload-aware policy would go. Whether that would help is a question for hardware.

## Where chapter 04's model differs

The simulation in chapter 04 keeps what that chapter teaches and simplifies the rest. Against vLLM at `05d8963`:

| Behaviour | Chapter 04 simulation (`engineSim.mjs`) | vLLM at `05d8963` |
|---|---|---|
| Admission | the whole prompt must fit | the whole prompt must fit, by default |
| A waiting request that does not fit | later requests may go past it | the queue stops at it |
| Who is preempted | the most recently admitted *other* request | the most recently admitted request, which can be the one asking |
| Where the victim goes | the back of the queue | the front of the queue |
| Tokens it had generated | discarded and generated again | kept; only their cache is recomputed |
| Freed blocks | gone | kept, with their hash, until reused |
| Cost of coming back | everything recomputed | everything without prefix caching; with it, only the blocks that were taken (inferred above) |
| Admissions in a step that preempted | allowed | none |

FIG. 17 in [chapter 04](#engine) is a second teaching model, `site/src/vllmSim.mjs`, that follows the right-hand column and links each event to the line at `05d8963` it comes from. It still simplifies: each prompt is processed in one step, there is one cache group, and there is no speculative decoding, watermark or asynchronous scheduling.

## Takeaway

In vLLM, a full cache shows up as one failed allocation, and the answer is to take blocks from the newest running request and recompute later. What that costs is not fixed. Freed blocks keep their contents until someone else needs the space, so a preempted request can come back to most of its cache or to none of it, depending on what ran in the meantime.

## Evidence

- vLLM at [`05d8963`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35), with the quoted files saved in the [source snapshot](../../research/sources/2026-09-29/README.md)
- [Chapter 04](#engine), its simulation `site/src/engineSim.mjs`, and FIG. 17's `site/src/vllmSim.mjs`, each with its assumptions stated in the file
- The earlier [prefix-caching investigation](current-state.md) at `836bb38`

## Next

Chapter 05, [Measurement](#measure), turns this into numbers a user would notice. A preemption shows up as a pause in the stream of output tokens, and when it happens before the first token, as a longer wait for the response to start.

## Appendix: the code, quoted

The preemption loop, from [scheduler.py lines 745 to 817](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L745-L817), trimmed to its decisions:

```python
while True:
    new_blocks = self.kv_cache_manager.allocate_slots(
        request, num_new_tokens, num_lookahead_tokens=self.num_lookahead_tokens)
    if new_blocks is not None:
        break                                   # it fits

    if self.connector is not None and self.connector.has_pending_block_frees():
        break                                   # wait for frees already on the way

    if self.policy == SchedulingPolicy.PRIORITY:
        preempted_req = max(self.running, key=lambda r: (r.priority, r.arrival_time))
    else:
        preempted_req = self.running[-1]        # FCFS: most recently admitted

    if not self._request_blocks_can_be_freed(preempted_req):
        break                                   # a deferred free will not help now

    ...                                         # remove it from running
    self._preempt_request(preempted_req, ...)
    preempted_reqs.append(preempted_req)
    if preempted_req == request:
        break                                   # it preempted itself; give up this step
```

The layout of a request's cache slots, from the `allocate_slots` docstring ([lines 417 to 449](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L417-L449)). Read left to right: tokens already processed, new prefix-cache hits, tokens a connector will supply, tokens to compute in this step, and room for draft tokens. Only the last three need new blocks.

```
----------------------------------------------------------------------
| < comp > | < new_comp > | < ext_comp >  | < new >  | < lookahead > |
----------------------------------------------------------------------
                                          |   < to be computed >     |
----------------------------------------------------------------------
                          |            < to be allocated >           |
----------------------------------------------------------------------
```

`_preempt_request` ([lines 1538 to 1581](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L1538-L1581)) also releases the request's encoder cache, counts the preemption, and marks any output still in flight from asynchronous scheduling as stale, so that it is delivered but does not move the reset counters.
