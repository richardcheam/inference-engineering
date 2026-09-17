# Inference radar

Last researched: 2026-09-15

Scope: a focused first pass around model/hardware feasibility. Publisher claims are not independent quality rankings. No performance claim below is our measurement.

| Item | What changed / evidence | Engineering relevance | Action |
|---|---|---|---|
| GLM-5.3 | Publisher describes post-training gains on the GLM-5.2 base; default checkpoint is FP8 | Same architecture can still change serving cost through output lengths and reasoning policy | **LEARN:** large MoE/DSA case in our study |
| GLM-5.3-Flash | Publisher describes a new 320B/18B-active multimodal base with hybrid sparse/linear attention and mHC | A “Flash” suffix does not imply the same cache or execution model as the larger sibling | **WATCH, then audit:** compare its state representation after the first worked example |
| Qwen3.8-Flash-Next | Official open-weight model repository is available | New candidates must be checked against pinned metadata and backend support before replacing a known reference | **WATCH:** next comparative audit; no feasibility claim yet |
| DeepSeek V4.1 Flash | Report combines phase-dependent computation, shared compressed KV, conditional memory, and DSpark | Makes ordinary parameter/KV estimates unreliable without component accounting | **LEARN:** advanced contrast, after conventional/hybrid cache budgets |
| New-model engine support | GLM recipe has an internal version mismatch; DeepSeek has dedicated/pre-release paths | “Supported” needs an exact model/format/hardware/version tuple | **VERIFY before running:** compatibility is its own gate |
| Standard toolchain | Accelerate offers empty-weight size estimates; AIPerf measures endpoints; Vidur offers simulations | Different tools answer different questions; no local GPU is needed for the first analytical work | **USE NOW:** metadata and arithmetic. **LATER:** benchmarks and calibrated simulation |

Primary sources: [GLM-5.3](https://huggingface.co/zai-org/GLM-5.3), [GLM-5.3-Flash](https://huggingface.co/zai-org/GLM-5.3-Flash), [Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next), [DeepSeek report](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf), [GLM recipe](https://recipes.vllm.ai/zai-org/GLM-5.3), [DeepSeek recipe](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4.1-Flash), [Accelerate](https://huggingface.co/docs/accelerate/usage_guides/model_size_estimator), [AIPerf](https://docs.nvidia.com/aiperf/welcome-to-ai-perf-documentation), [Vidur](https://github.com/microsoft/vidur).

## Hardware radar

The [initial hardware reference](../hardware/reference.md) spans consumer GPUs, Hopper/GH200, Blackwell, and AMD. AMD's current optimization guide also covers MI350-series differences, including memory and low-precision capabilities. Add a newer accelerator only when its capacity, backend, topology, or economics changes a specific design decision. [AMD optimization guide](https://rocm.docs.amd.com/projects/ai-ecosystem/en/latest/optimization/workload-optimization.html).

## Ignore for now

Uncontextualized tokens/second rankings, speculative-decoding speedup claims without acceptance/cost data, and custom kernel work without profiling evidence. Revisit each when it addresses a concrete workload or bottleneck.

Next refresh: after the first learning cycle or before a deployment decision. No automatic weekly research job is configured.
