# When the cache is full

Last researched: 2026-09-29

## What this page is

Chapter 04 teaches the step loop with a simulation that says outright it is not a model of vLLM's scheduler. This page says what vLLM actually does when KV blocks run out, and where the teaching model differs.

Every code reference is to vLLM commit [`05d89636fca80d806732ced636ef505f42e6fe35`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35) (`05d8963`), read on 2026-09-29 and not run. The earlier prefix-caching investigation on the [engine page](current-state.md) uses commit `836bb38`, and line numbers differ between the two. Nothing here has been measured.

## The pool is fixed at start-up

**SOURCE-CODE OBSERVATION:** the KV pool is sized once, before the first request. [`determine_available_memory`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/worker/gpu_worker.py#L571-L626) runs a forward pass with dummy inputs to measure peak activation memory. Whatever is left under [`gpu_memory_utilization`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/cache.py#L103-L108) (default 0.92) becomes KV cache, and [`get_kv_cache_configs`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_utils.py#L2628) turns those bytes into blocks. Setting [`kv_cache_memory_bytes`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/cache.py#L249-L256) skips the profiling and ignores the utilisation fraction.

The consequence is that the number of blocks does not change while the server runs. Pressure is not the pool shrinking. It is more requests, or longer ones, asking for the same fixed number of blocks.

## One step: running first, waiting second

[`schedule()`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L562) serves requests that are already running before it looks at the queue.

1. Each running request asks for the blocks its next tokens need through `allocate_slots` ([line 747](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L745-L751)). Only this path preempts.
2. Waiting requests are considered only if no preemption happened in this step: [`if not preempted_reqs and ...`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L873).
3. A waiting request that does not fit simply stays in the queue. Nothing is preempted on its behalf: its allocation at [line 1209](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L1209-L1230) returns `None` and the waiting loop stops. The requests behind it are not tried in this step either.

## The pressure signal

**SOURCE-CODE OBSERVATION:** [`KVCacheManager.allocate_slots`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L371) returns `None` when the blocks it needs exceed the free blocks minus any reserved ones ([lines 566 to 570](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L564-L570)). That `None` is the whole signal. There is no pressure level or early warning: the scheduler learns the pool is full when an allocation fails.

The method's docstring carries the best map of what a request's slots are made of ([lines 417 to 449](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L417-L449)):

```
----------------------------------------------------------------------
| < comp > | < new_comp > | < ext_comp >  | < new >  | < lookahead > |
----------------------------------------------------------------------
                                          |   < to be computed >     |
----------------------------------------------------------------------
                          |            < to be allocated >           |
----------------------------------------------------------------------

comp      = request.num_computed_tokens
new_comp  = num_new_computed_tokens
          = len(new_computed_blocks) * block_size
ext_comp  = num_external_computed_tokens, cached by the connector
new       = num_new_tokens, including unverified draft tokens
lookahead = num_lookahead_tokens
```

Read left to right: tokens already computed, new prefix-cache hits, tokens a connector will supply, tokens to compute this step, and slots reserved for speculative tokens. Only the last three need fresh blocks.

## The preemption loop

When a running request's allocation fails, the scheduler takes blocks back from someone. The loop is at [scheduler.py lines 745 to 817](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L745-L817). Trimmed to its decisions:

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

Four things in it are worth holding on to.

- **The loop retries until the allocation fits.** One failure can preempt several requests in turn.
- **Under FCFS the victim is `self.running[-1]`,** the most recently admitted request. That can be the request that is asking. When it is, the request preempts itself and the loop ends.
- **Under PRIORITY the victim is the largest `(priority, arrival_time)`:** the lowest priority, and among equals the latest arrival.
- **Not every preemption helps.** If a connector already has frees pending, the scheduler waits instead of preempting. If the victim's blocks can only be freed later, it stops.

## What preemption does

**SOURCE-CODE OBSERVATION:** [`_preempt_request`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L1538-L1581):

- frees the request's KV blocks and its encoder cache
- sets `num_computed_tokens = 0` and `status = PREEMPTED`, and increments `num_preemptions`
- marks output still in flight from asynchronous scheduling as stale, so it is delivered but does not advance the reset counters
- calls `self.waiting.prepend_request(request)`, which puts the request at the **front** of the waiting queue

The request keeps its prompt and every token it has generated. What it loses is the KV cache for them. Because `num_computed_tokens` is 0, its next admission is treated like a fresh prefill of all those tokens.

**VERIFIED FACT at `05d8963`:** recompute is the only preemption mode. There is no swap preemption and no `PreemptionMode` anywhere under `vllm/v1` or `vllm/config`. The only `SWAP` names under `vllm/v1` belong to batch reordering in the sampler, not to the KV cache.

## Free is not erased

This is the part of the mechanism that surprises people. Freeing a block gives it back to the pool but does not wipe it. With prefix caching on, a freed block keeps both its contents and its hash until another request claims it.

1. **Freeing decrements a count.** [`BlockPool.free_blocks`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L776-L807) decrements `ref_cnt`. At zero, the block joins the free queue. A block with no hash, which could never match a future prefix, is **prepended**, so it is reused first. A hashed block is **appended**, so the queue stays in least-recently-used order.
2. **A request's blocks are freed tail first.** [`SingleTypeKVCacheManager.free`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L576-L584) frees `reversed(...)`, so among one request's hashed blocks the prompt's beginning sits furthest back in the queue. Shared prefixes survive longest.
3. **The hash goes only when the block is reused.** [`get_new_blocks`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L668-L702) pops blocks from the front of the queue and only then calls [`_maybe_evict_cached_block`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L731-L752), which removes the hash. That is the moment the contents are gone.
4. **Until then, a hit can pull the block back.** [`touch`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/block_pool.py#L754-L770) takes a cached block out of the middle of the free queue. [`FreeKVCacheBlockQueue`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_utils.py#L247-L263) is a doubly linked list precisely so that this removal is O(1).

**Engineering inference:** with prefix caching on, a preempted request that is readmitted before its blocks are claimed recomputes only what was overwritten. The chain is in the source. Readmission starts with `num_computed_tokens == 0`, which triggers a prefix-cache lookup ([scheduler.py line 930](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L929-L934)). The request's own full blocks are still hashed in the free queue, and the lookup's hits are touched back out of it. The tests support parts of this: [`test_preemption_re_records_prefix_cache_query`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/tests/v1/core/test_scheduler.py#L1397-L1430) checks that a preempted request goes through the lookup again on return. The `test_cache_hit_local_and_external_*_preempt_and_reallocate` tests in [`test_prefix_caching.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/tests/v1/core/test_prefix_caching.py#L5211-L5250) free and reallocate a request with cached blocks still evictable. Neither test asserts how much of the victim's own cache comes back, and nothing here was run. Two limits apply even when every block survives:

- Only committed tokens are hashed. Draft tokens from speculative decoding are never cached ([kv_cache_manager.py lines 597 to 606](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L597-L606)).
- The lookup stops one token short, so the final block is recomputed regardless ([lines 289 to 295](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L289-L295)). This is the same rule chapter 04 measures for an ordinary cache hit.

So the price of a preemption is not fixed. It depends on what ran between the preemption and the return.

## Freeing before finishing

Some blocks can be freed while a request is still running. **SOURCE-CODE OBSERVATION:** every `allocate_slots` call runs `remove_skipped_blocks` ([line 547](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L538-L551)) before it compares what it needs against the free count, so a request makes room for itself first. It does this after the full-sequence admission gate described below, not before it.

- **Full attention never frees early.** The default `get_num_skipped_tokens` returns 0, so nothing is ever outside the window ([lines 704 to 733](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L704-L733)).
- **Sliding-window layers free whole blocks behind the window.** [`SlidingWindowManager`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L946) carries a worked example in its docstring ([lines 1148 to 1183](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/single_type_kv_cache_manager.py#L1148-L1183)): with a window of 4 and 7 computed tokens, tokens 0 to 3 are skipped.
- **It frees against processed tokens, not scheduled ones.** The call passes `total_computed_tokens - request.num_in_flight_tokens`, because a step still in flight may read blocks below the optimistic boundary, and rejected speculative tokens can move it back.

For a model that mixes both kinds of layer, the [hybrid KV cache manager design](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/design/hybrid_kv_cache_manager.md) explains how the groups share one pool.

## Guards that keep preemption rare

**SOURCE-CODE OBSERVATION:** four settings make the loop above the exception rather than the rule.

| Guard | Default | What it does |
|---|---|---|
| [`scheduler_reserve_full_isl`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/scheduler.py#L191-L195) | on | Admits a request only if its whole input fits, not just the first chunk ([`full_sequence_must_fit`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/kv_cache_manager.py#L515-L531)) |
| [`watermark`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/scheduler.py#L197-L202) | 0.0 | A fraction of blocks kept free when admitting waiting or preempted requests; off by default |
| [`reserved_blocks`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L1194-L1204) | per step | Admits an asynchronous connector load only if it leaves room for prefills already in flight |
| [`num_lookahead_tokens`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L747-L751) | set by speculative decoding | Reserves draft-token slots on every allocation, so a draft never runs out of room mid-step |

None of them grows the pool. Each one moves the moment of failure from the middle of a request to its admission, where waiting costs nothing already computed.

## Beyond HBM

Recompute is the only in-HBM answer to a full pool, but two connectors change what "recompute" costs.

- The [OffloadingConnector](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/kv_offloading_usage.md) copies completed blocks to pinned host memory, and optionally further tiers, as they are produced. A later hit is promoted back to the GPU, so a lost block becomes a host-to-device load instead of a prefill.
- [HiSparse](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/design/hisparse.md), marked experimental, keeps a GPU hot set in front of KV held in host memory.

**Engineering inference:** the victim choice is two lines ([scheduler.py lines 765 to 771](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/v1/core/sched/scheduler.py#L765-L771)) and looks at neither how many blocks the victim holds nor how expensive it would be to restore. With an offload tier, those two quantities differ between requests, so that is where an offload-aware policy would plug in. This is a question for hardware, not a result.

## Where the chapter 04 teaching model differs

The simulation in chapter 04 keeps the points that chapter teaches and simplifies the rest. Against vLLM at `05d8963`:

| Behaviour | Chapter 04 simulation (`engineSim.mjs`) | vLLM at `05d8963` |
|---|---|---|
| Admission check | the whole prompt must fit | the whole prompt must fit, by default (`scheduler_reserve_full_isl`) |
| A waiting request that does not fit | later requests may be admitted past it | the waiting loop stops at it, under FCFS |
| Victim | the most recently admitted *rival* in decode | `running[-1]`, which can be the requester itself |
| Requeue position | back of the queue | front of the queue (`prepend_request`) |
| Generated tokens after preemption | discarded and generated again | kept; only their KV is recomputed |
| Freed blocks | removed from the pool | kept with their hash in an LRU free queue until reused |
| Readmission cost | full recompute | full recompute without prefix caching; with it, only overwritten blocks (inferred, see above) |
| New admissions in a step that preempted | allowed | skipped |

FIG. 17 in [chapter 04](#engine) is a second teaching model, `site/src/vllmSim.mjs`, that follows vLLM's side of this table step by step, with each event linked to the line at `05d8963` it comes from. It still simplifies: prefill runs in one step, there is one cache group, and there is no speculative decoding, watermark or asynchronous scheduling.

## Takeaway

A full pool in vLLM is a failed allocation, answered by recompute. What that recompute costs is not fixed: freed blocks keep their contents until someone else claims them, so a preempted request can come back to anything from almost all of its cache to none of it.

## Evidence

- vLLM at [`05d8963`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35), with the quoted files saved in the [source snapshot](../../research/sources/2026-09-29/README.md)
- [Chapter 04](#engine) and its simulation, `site/src/engineSim.mjs`, whose assumptions are stated at the top of the file
- The earlier [prefix-caching investigation](current-state.md) at `836bb38`

## Next

Chapter 05, [Measurement](#measure), turns the effect of this on a request into numbers: a preemption shows up as a stall in inter-token latency and, if it happens before the first token, in time to first token.
