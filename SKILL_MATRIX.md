# Skill matrix

Updated: 2026-09-15

Levels: **1** familiar; **2** working knowledge; **3** can use/debug independently; **4** can optimize; **5** can design and explain independently. **Unassessed** means no demonstrated level in this workspace, not beginner.

This is an internal planning reference, not a graded course. No quizzes or exercises are required. Your prior experience establishes where to start. It does not justify inventing scores. Reading assistant-written notes does not raise a level.

| Area | Prior experience reported | Demonstrated level here | Next evidence |
|---|---|---|---|
| Architecture | Large MoE, GLM, DeepSeek bring-up | Unassessed | Translate a new config into compute, memory, and cache implications |
| GPU hardware/topology | GH200, NVLink-C2C, NUMA | Unassessed | Compare two hardware paths with capacities and directional bandwidth |
| Memory feasibility | Weight/KV offload, FP8/INT4 | Unassessed | Per-device budget including runtime and allocation uncertainty |
| MoE | Serving large expert models | Unassessed | Explain total, per-token active, and per-batch touched experts |
| Parallelism | TP; EP concepts | Unassessed | Justify TP vs DP/EP for an explicit workload/topology |
| vLLM | Configuration, bring-up, benchmarking | Unassessed | Independently trace and explain a scheduler/cache path |
| SGLang | No concrete independent evidence supplied | Unassessed | Compare one equivalent feature and its support constraints |
| Benchmarking | TTFT, TPOT, throughput, concurrency | Unassessed | Reproducible A/B with load model, tails, failures, and goodput |
| Profiling | No trace supplied | Unassessed | Identify critical-path evidence and reject an alternative hypothesis |
| Quantization | FP8, FP4/NVFP4 concepts, AWQ/INT4 | Unassessed | Connect exact format to memory, kernels, and quality checks |
| Speculative decoding | MTP and DSpark experimentation | Unassessed | Cost/acceptance model followed by controlled measurements |
| Heterogeneous inference | Grace placement and offload experience | Unassessed | Explain traffic granularity, locality, and overlap limits |
| Production | Docker and serving APIs | Unassessed | SLO, capacity, readiness, monitoring, rollback, and recovery evidence |
| Debugging | Model bring-up experience | Unassessed | A minimal reproduction and a discriminating root-cause test |

When updating, link the explanation, trace, experiment, or patch that supports the new level, and record the date. GPU-dependent levels remain unverified until real execution evidence exists.
