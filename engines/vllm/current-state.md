# Engine support and first source investigation

Last researched: 2026-09-29

## Support evidence, not deployment certification

Separate architecture recognition, successful loading, numerical correctness, backend compatibility, acceptable speed, and production readiness. Generated Hugging Face “use this model” commands are not evidence for the full chain.

| Model | vLLM evidence | SGLang evidence | Classification / unresolved work |
|---|---|---|---|
| Qwen3.6-35B-A3B | Official recipe covers BF16, FP8, and NVFP4, with hardware/variant-specific requirements | Not audited for this checkpoint in this pass | vLLM documented; recipe lists BF16/FP8 support from 0.17.0 and additional NVFP4 constraints. Reverify exact deployment pin |
| GLM-5.3 | Recipe documents FP8 configurations for H200, Blackwell, and AMD | Official cookbook documents DSA/MTP deployments and experimental NVFP4 | Documented support. vLLM page's 0.29.0+ badge conflicts with its 0.28.0 prerequisites/install example; minimum version unresolved |
| Mistral Medium 3.5 | Author's card recommends a nightly build and identifies dependency/configuration fixes | Author's card gives separate development images for Hopper and Blackwell | Model-specific published instructions; lowest working stable versions not established |
| DeepSeek V4.1 Flash | **SOURCE-CODE OBSERVATION:** `DeepseekV41ForCausalLM` is registered in [`registry.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/registry.py#L378-L381) and implemented in [`vllm/models/deepseek_v41/`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41), which has separate `nvidia/` and `amd/` trees. The recipe (updated 2026-09-22, read 2026-09-29) asks for vLLM 0.30.0 or later as an image, since no pip wheel serves the architecture: on NVIDIA any `vllm/vllm-openai:nightly` from 2026-09-10 on, after the architecture landed in `main` in vllm-project/vllm#56228; on AMD `vllm/vllm-openai-rocm:nightly` | Repository cookbook said support had not yet shipped in a release (read 2026-09-15, not rechecked) | Documented and present in `main`; no local validation |
| MiMo V2.6 Flash (`MiMo-V2.6-Flash-RL`) | **SOURCE-CODE OBSERVATION:** `MiMoV2ForCausalLM` is in [`mimo_v2.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/mimo_v2.py#L991). When the config has a vision tower, `MimoV2ModelArchConfigConvertor` rewrites the architecture to `MiMoV2OmniForCausalLM` ([`model_arch_config_convertor.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/transformers_utils/model_arch_config_convertor.py#L635-L645)). The recipe (updated 2026-09-23, read 2026-09-29) says stable vLLM up to 0.29.0 cannot load the MXFP4-stored weights; it asks for the `vllm/vllm-openai:mimo-v26` image or a nightly wheel built after 2026-09-20 (vllm-project/vllm#57784) | Model card points to the SGLang MiMo-V2.5 cookbook; not audited for this checkpoint | Documented by recipe; the V2 family is present in `main`. **Engineering inference:** no string under `vllm/` names V2.6, so that V2.6 takes this path, and loads as `MiMoV2OmniForCausalLM` because its pinned config carries a `vision_config`, is read from the code rather than confirmed. No local validation |

Sources: [Qwen recipe](https://recipes.vllm.ai/Qwen/Qwen3.6-35B-A3B), [GLM vLLM recipe](https://recipes.vllm.ai/zai-org/GLM-5.3), [GLM SGLang cookbook](https://docs.sglang.io/cookbook/autoregressive/GLM/GLM-5.3), [Mistral model card](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B), [DeepSeek vLLM recipe](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4.1-Flash), [DeepSeek SGLang cookbook source](https://github.com/sgl-project/sglang/blob/main/docs/cookbook/autoregressive/DeepSeek/DeepSeek-V4_1.mdx), [MiMo vLLM recipe](https://recipes.vllm.ai/XiaomiMiMo/MiMo-V2.6-Flash-RL), [MiMo model card](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL).

The first three rows and the SGLang column were read on 2026-09-15. The DeepSeek V4.1 Flash and MiMo rows were read on 2026-09-29, with source observations at vLLM commit `05d8963`. The investigation below was read at vLLM commit `836bb38`.

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

For a concrete eviction and recompute example, read at `05d8963`, see [When the cache is full](kv-pressure.md).
