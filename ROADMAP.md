# Roadmap

Started: 2026-09-15

Ten flexible learning cycles, roughly one per week. Learn directly through explanations and worked examples at your own pace. There are no exercises, quizzes, or assessment gates. We can prepare all ten locally; GPU debugging, performance validation, and production competence require later execution evidence.

| Cycle | Concepts (3–5) | Primary research | Hands-on work available now | Evidence to produce | Later hardware validation |
|---|---|---|---|---|---|
| 1. Feasibility | Total vs active parameters; storage formats; per-device memory; KV geometry | Pinned configs and indices in the [first study](models/feasibility-study.md) | Recalculate checkpoint and cache budgets; compare plausible placements | Explain a capacity rejection and a conditional fit, including missing terms | Compare predicted weight/cache allocations with startup logs |
| 2. Hardware | Roofline; memory hierarchy; precision; topology | [Hardware reference and vendor sources](hardware/reference.md) | Draw HBM/host/interconnect paths for GH200, H200, Blackwell, AMD, and a consumer GPU | A resource model with bounds and declared assumptions | Measure bandwidth and collectives on the actual topology |
| 3. Prefill and decode | Arithmetic intensity; batching; expert reuse; context-dependent attention | Configs plus the [DeepSeek report](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf), sections 2 and 3 | Estimate how batch and context change bytes and operations per step | Predict which bottleneck changes across three workload shapes | Short/long input and output sweeps |
| 4. Engine internals | Request lifecycle; token budgets; block allocation; prefix reuse | [Pinned vLLM investigation](engines/vllm/current-state.md) and [hybrid cache design](https://docs.vllm.ai/en/latest/design/hybrid_kv_cache_manager/) | Trace one request through scheduler/cache source and read existing tests | Annotated call path plus a concrete eviction/recompute example | Prefix-cache cold/warm control |
| 5. Benchmarking | Load models; streaming timing; goodput; variance | [AIPerf metrics](https://docs.nvidia.com/aiperf/reference/ai-perf-metrics-reference) and [our protocol](benchmarking/methodology.md) | Specify workload manifest and analyze synthetic timestamps by hand | Distinguish TTFT, TPOT, ITL, output throughput, and joint SLO compliance | Execute matched concurrency and arrival-rate sweeps |
| 6. Profiling/debugging | Critical path; queueing; synchronization; memory pressure | [vLLM profiling](https://docs.vllm.ai/en/latest/contributing/profiling/) and vendor profiler docs, rechecked before use | Analyze a supplied/public trace with known provenance; otherwise write a discriminating measurement plan | One bottleneck hypothesis, counter-hypothesis, and falsifying test | Capture a timeline, reproduce and minimize one failure |
| 7. Parallelism/offload | TP; DP; EP; locality; transfer overlap | [vLLM parallelism](https://docs.vllm.ai/en/latest/serving/parallelism_scaling/) and hardware topology sources | Account for sharded and replicated tensors; estimate communication for alternative placements | Explain why more aggregate memory need not improve latency | TP/DP/EP or offload A/B, one factor at a time |
| 8. Quantization | Storage vs execution format; scale overhead; backend support; quality | [vLLM quantization](https://docs.vllm.ai/en/latest/features/quantization/) and selected checkpoint config | Compare exact checkpoint formats and hardware/backend support | A capacity, performance, and quality validation proposal | Matched quality set and measured memory/latency comparison |
| 9. Speculation and agentic state | Draft/verify cost; acceptance; prefix locality; recurrent-state checkpoints | [vLLM speculation](https://docs.vllm.ai/en/latest/features/spec_decode/) and selected model implementation | Derive a break-even condition; reason about changing context and tool turns | Explain when speculation loses, and how to measure that | Speculation off/on at low and high concurrency |
| 10. Production capstone | Admission control; observability; reproducibility; rollout; recovery | [vLLM production metrics](https://docs.vllm.ai/en/latest/usage/metrics/) and current engine operational docs | Design a deployment for a newly selected open-weight model, including failure handling | Reviewable design with uncertainty register and benchmark acceptance criteria | Deploy, inject a controlled failure, recover, and compare to the baseline |

Source links for later cycles are reading starting points, not claims that their flags or APIs were audited in this session. Reverify at execution time.

## Current checkpoint

- [x] Establish broader model/hardware scope and actual access constraints.
- [x] Collect and pin four model configurations and tensor indices.
- [x] Calculate storage and selected KV lower bounds.
- [x] Record support uncertainties and prepare the first worked example.
- [x] Read the illustrated feasibility lesson (cycle 1).
- [x] Derive the memory-traffic bound on a decode step, and build cycle 2 as a taught chapter.
- [x] Contrast prefill and decode through arithmetic intensity, and build cycle 3 as a taught chapter.
- [x] Derive expert reuse from the pinned MoE configs and cross-check the expert footprint against each checkpoint.
- [x] Trace prefix reuse through the pinned vLLM cache manager, and build cycle 4 as a taught chapter.
- [x] Define the serving metrics from timestamps and build cycle 5, including goodput against joint limits.
- [x] Build the bottleneck differential for cycle 6, with a discriminating test for every candidate.
- [x] Model sharding, replication and KV-head limits for cycle 7.
- [x] Separate stored from executed precision, including scale overhead, for cycle 8.
- [x] Derive the speculation break-even condition for cycle 9.
- [x] Chain all nine questions into a reviewable deployment design for cycle 10.
- [ ] Establish actual hardware access before any measured baseline. **This is the remaining boundary: all ten chapters are analytical, and every open item in the chapter 10 checklist is waiting on it.**

## Ongoing cadence

During active work: explain → show a worked example → explore the consequences → connect to real engineering. Once per learning week: one deep concept, one meaningful deliverable, and at most 15–30 minutes of radar reading. Monthly: reassess skill evidence and model/engine choices. No automatic recurring task has been scheduled.
