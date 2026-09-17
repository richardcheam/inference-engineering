# Benchmark methodology

Last researched: 2026-09-15

## Purpose

Determine which configuration serves a defined workload correctly under latency, throughput, memory, and operational constraints. No benchmark has run in this workspace. GPU-dependent work is blocked on access; protocol design is ready.

Use vLLM's benchmark tooling for rapid engine iteration and NVIDIA AIPerf for independent API-based comparisons when supported. Verify CLI options at the installed version. AIPerf documents load controls, streaming metrics, and server-metric collection; these are separate from kernel profiling. [CLI reference](https://docs.nvidia.com/aiperf/reference/command-line-options), [metrics](https://docs.nvidia.com/aiperf/reference/ai-perf-metrics-reference), [server metrics](https://docs.nvidia.com/aiperf/server-metrics/server-metrics-collection).

## 1. Establish correctness

Before timing: verify tokenizer/chat template, reasoning mode, stop behavior, output completeness, streaming, and tool-call parsing where required. Pin a small task set with expected behavior; include a long-context retrieval task and representative code/tool cases. Record numerical/output-quality differences for quantization or speculative changes. Timing only truncated or invalid answers is not useful performance evidence.

Keep two workload tracks:

- **Controlled systems track:** fixed token-length distributions, fixed output budget, and explicitly controlled stopping where the tool permits. This isolates engine behavior but may not resemble normal use.
- **Application track:** representative natural prompts and stopping behavior; report actual input/output lengths and task success. Different models can tokenize identical text differently and use different reasoning lengths.

## 2. Minimal workload matrix

These are proposed exercise settings, not measured production demand. Freeze the selected subset before running; do not execute every combination blindly.

| Workload | Prompt / output target | Initial load sweep | Purpose |
|---|---|---|---|
| Interactive | 2,048 / 256 tokens | Closed-loop concurrency 1, 4, 8, 16, 32 | Find low-latency region and saturation onset |
| Prefill-heavy | 32,768 / 128 | 1, 4, 8 | Expose prefill cost and queue interference |
| Decode-heavy | 512 / 2,048 | 1, 8, 32 | Weight/KV traffic, batching, speculation |
| Long context | 131,072 / 256 | 1, then 4 only if memory permits | Validate context capacity and scaling |
| Prefix reuse | 16,384-token shared prefix + 512 unique / 256 | Matched cold/warm runs at 1 and 8 | Isolate reusable prefill work |
| Agentic | Repeated tool turns with growing prompts | Small fixed trace set | Observe prefix locality, reasoning, and end-to-end success |

Once a concurrency sweep locates a knee, use an open-loop arrival-rate sweep around it. Closed-loop clients slow their submissions when the server slows; open-loop arrivals reveal backlog and overload. Record arrival distribution, offered rate, achieved rate, timeouts, and dropped requests. Do not equate concurrency with requests/second.

## 3. Timing and SLO definitions

Declare whether timing is client-observed or server-side. TTFT includes queueing and network effects at the client boundary. Per-request TPOT averages the decode interval for requests with more than one output token. ITL describes gaps, but streaming chunks can contain multiple tokens; report the harness's exact definition and tokenizer method.

Provisional interactive exercise limits: **TTFT ≤ 2 seconds and per-request TPOT ≤ 50 ms**, with successful complete output. These are chosen teaching thresholds, not a recommended universal SLO. Confirm the real application's limits before a deployment decision.

Report both:

1. Population p50/p95/p99 TTFT, TPOT, ITL, and end-to-end latency, plus sample counts and errors.
2. Joint request goodput: completed requests meeting **both** per-request limits divided by elapsed time.

Separate percentile compliance does not establish the fraction of requests meeting both constraints. Exclude undefined TPOT values explicitly rather than inserting zero. Do not interpret a p99 from a tiny run as a reliable tail estimate.

## 4. Control the experiment

Pin model revision, exact checkpoint/quantization, tokenizer and template, engine commit/version, image digest, kernels, driver/CUDA or ROCm, hardware/topology, CPU/NUMA placement, server flags/env, precision, context limit, scheduler settings, workload seed/distribution, output settings, and client location/version.

Separate cold startup, kernel warmup, and prefix-cache warmup. Warm kernels using disjoint inputs when testing a cold prefix cache. Keep explicit warm-prefix priming and eviction/reset procedures. A server restart may reset both kernels and caches, so design the controls accordingly.

Use at least three measured repetitions as an initial check, alternating baseline and treatment order to reduce drift. Choose duration/request count to cover the target operating regime; record both and extend if too few observations or unstable tails remain. Treat small movements as unresolved until run-to-run variation supports them. Change one primary factor per experiment.

## 5. Report measurements and mechanisms

Record input/output/total token throughput separately, completed requests/s, goodput, latency distributions, errors, actual length distributions, queue depth, batch sizes, cache usage, GPU/CPU memory, memory bandwidth evidence, clocks/power, and communication observations when relevant. Average utilization alone is insufficient to locate the bottleneck.

Progress from service metrics → system telemetry → timeline → kernel profiler. Connect a speedup to reduced work/traffic, greater reuse, reduced waiting, or improved execution. Record quality and operational costs alongside it.

## 6. Reproducible records

Each real experiment gets a new directory containing a question/hypothesis, controls, prediction made before measurement, exact server and benchmark commands, environment manifest, immutable raw outputs, analysis, confounders, and KEEP/REJECT/INVESTIGATE decision. Include trial identifiers and timestamps. Never overwrite raw results.

The first [feasibility record](../experiments/001-feasibility/README.md) is explicitly analytical. It does not substitute for this measured protocol.
