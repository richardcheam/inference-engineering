# Engine support and first source investigation

Last researched: 2026-09-15

## Support evidence, not deployment certification

Separate architecture recognition, successful loading, numerical correctness, backend compatibility, acceptable speed, and production readiness. Generated Hugging Face “use this model” commands are not evidence for the full chain.

| Model | vLLM evidence | SGLang evidence | Classification / unresolved work |
|---|---|---|---|
| Qwen3.6-35B-A3B | Official recipe covers BF16, FP8, and NVFP4, with hardware/variant-specific requirements | Not audited for this checkpoint in this pass | vLLM documented; recipe lists BF16/FP8 support from 0.17.0 and additional NVFP4 constraints. Reverify exact deployment pin |
| GLM-5.3 | Recipe documents FP8 configurations for H200, Blackwell, and AMD | Official cookbook documents DSA/MTP deployments and experimental NVFP4 | Documented support. vLLM page's 0.29.0+ badge conflicts with its 0.28.0 prerequisites/install example; minimum version unresolved |
| Mistral Medium 3.5 | Author's card recommends a nightly build and identifies dependency/configuration fixes | Author's card gives separate development images for Hopper and Blackwell | Model-specific published instructions; lowest working stable versions not established |
| DeepSeek V4.1 Flash | Recipe requires a dedicated NVIDIA image or ROCm nightly for this new architecture | Repository cookbook says support has not yet shipped in a release | Model-specific/experimental deployment path; no local validation |

Sources: [Qwen recipe](https://recipes.vllm.ai/Qwen/Qwen3.6-35B-A3B), [GLM vLLM recipe](https://recipes.vllm.ai/zai-org/GLM-5.3), [GLM SGLang cookbook](https://docs.sglang.io/cookbook/autoregressive/GLM/GLM-5.3), [Mistral model card](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B), [DeepSeek vLLM recipe](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4.1-Flash), [DeepSeek SGLang cookbook source](https://github.com/sgl-project/sglang/blob/main/docs/cookbook/autoregressive/DeepSeek/DeepSeek-V4_1.mdx).

The architecture and storage study does not depend on resolving these version questions today. Before running anything, select a specific release/commit and container digest, inspect the relevant implementation, and execute correctness checks on the target hardware. A moving `main` or image tag is not a reproducible experiment pin. TensorRT-LLM support for these four exact checkpoints was not audited.

## First investigation: why prefix reuse is not zero-cost prefill

**SOURCE-CODE OBSERVATION:** inspected vLLM commit `836bb3839ffefcda8283ea7d41671a89e1a613df`, not an installed engine. Four source/test files are saved in the [source directory](../../research/sources/2026-09-15/README.md).

| Question | Observed answer |
|---|---|
| Feature/config entry | `CacheConfig.enable_prefix_caching` in `vllm/config/cache.py`; CLI-to-config parsing not traced in this pass |
| Main abstraction | `KVCacheManager`, initialized by `Scheduler` using cache configuration |
| Important implementation | `get_computed_blocks`, `allocate_slots`, `free`; coordinator handles cache groups |
| Runtime path inspected | Scheduler asks for computed blocks, then attempts allocation for scheduled tokens |
| Performance-sensitive work | Prefix lookup, group compatibility, capacity/admission, recomputation, allocation |
| Existing tests located | `tests/v1/core/test_prefix_caching.py`; downloaded and inspected, not executed |
| Boundary of investigation | API preprocessing, engine initialization beyond scheduler, model runner, and kernels remain outside this trace |

Pinned sources: [cache config](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/vllm/config/cache.py), [scheduler](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/vllm/v1/core/sched/scheduler.py), [cache manager](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/vllm/v1/core/kv_cache_manager.py), [tests](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/tests/v1/core/test_prefix_caching.py).

The inspected cache manager limits a lookup to `request.num_tokens - 1`: logits still need computation even if the prompt matches cached state. Block alignment can increase recomputation. The method also carries a shared-prefix boundary for sparse-retention groups. Thus, a cache-hit percentage by itself does not specify how much computation remains.

**Engineering inference:** changing the cache state can change TTFT without changing weights, model quality, or hardware. For hybrid models, align prefix reuse with the required recurrent/window states as well as full-attention blocks. [Design background](https://docs.vllm.ai/en/latest/design/hybrid_kv_cache_manager/).

**Next learning task:** explain a request with a cached prefix and uncached suffix, identify which states can be reused, and predict which metric improves. Later compare cold and warm requests using identical tokenized content and explicit cache state. Do not modify the cache manager before this explanation and baseline exist.
