# Engine support and first source investigation

Last researched: 2026-09-29

## The question

Can each of the models studied here be served by vLLM or SGLang, the two open-source serving engines this workspace follows? And what does "supported" actually promise?

"Supported" covers a chain of separate claims. An engine can recognise a model's architecture without loading it successfully. It can load it and still produce wrong outputs. It can produce right outputs with kernels that do not work on your GPU, or work but too slowly, or be fast but not ready for production. A Hugging Face "use this model" button generates a command, not evidence for any link in that chain. This page records how far along the chain the published evidence goes for each model.

## How this was checked

Nothing on this page was run. The evidence is each engine's published deployment recipe or cookbook, and the model authors' own model cards, read on the dates given. For the two newest models, vLLM's source code was also read at a fixed commit. Recipes change without a version number, so a date is the only way to say which version was read.

## Support, model by model

| Model | vLLM | SGLang | Where it stands |
|---|---|---|---|
| Qwen3.6-35B-A3B | The official recipe covers 16-bit (BF16), 8-bit (FP8) and 4-bit (NVFP4) weights, with requirements that depend on the hardware and the variant | Not checked for this checkpoint | Documented. The recipe lists BF16 and FP8 support from vLLM 0.17.0, with extra conditions for NVFP4. The exact version to deploy still needs checking |
| GLM-5.3 | The recipe documents FP8 setups for H200, Blackwell and AMD GPUs | The official cookbook documents deployments with sparse attention (DSA) and multi-token prediction (MTP), and experimental NVFP4 | Documented. The vLLM recipe's badge says 0.29.0 or later, but its prerequisites and install example use 0.28.0, so the minimum version is unclear |
| Mistral Medium 3.5 | The model card recommends a nightly build and lists dependency and configuration fixes | The model card gives separate development images for Hopper and Blackwell GPUs | Instructions come from the model's authors; the oldest stable versions that work are not established |
| DeepSeek V4.1 Flash | In vLLM's main code; the recipe needs vLLM 0.30.0 or later, as a container image only | The repository cookbook said support had not yet shipped in a release (read 2026-09-15, not rechecked) | Documented and present in vLLM; not tried here |
| MiMo V2.6 Flash (`MiMo-V2.6-Flash-RL`) | The MiMo V2 family is in vLLM's main code; the recipe needs a September 2026 build | The model card points to the SGLang MiMo V2.5 cookbook; not checked | Documented by recipe; that V2.6 uses the V2 code is inferred; not tried here |

The first three rows and the SGLang column were read on 2026-09-15. The DeepSeek and MiMo rows were read on 2026-09-29.

Sources: [Qwen recipe](https://recipes.vllm.ai/Qwen/Qwen3.6-35B-A3B), [GLM vLLM recipe](https://recipes.vllm.ai/zai-org/GLM-5.3), [GLM SGLang cookbook](https://docs.sglang.io/cookbook/autoregressive/GLM/GLM-5.3), [Mistral model card](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B), [DeepSeek vLLM recipe](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4.1-Flash), [DeepSeek SGLang cookbook source](https://github.com/sgl-project/sglang/blob/main/docs/cookbook/autoregressive/DeepSeek/DeepSeek-V4_1.mdx), [MiMo vLLM recipe](https://recipes.vllm.ai/XiaomiMiMo/MiMo-V2.6-Flash-RL), [MiMo model card](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL).

### What the two newer rows rest on

The DeepSeek and MiMo rows were added on 2026-09-29, by reading vLLM's source at commit `05d8963` and each model's vLLM recipe.

**SOURCE-CODE OBSERVATION:** DeepSeek V4.1 Flash is registered as `DeepseekV41ForCausalLM` ([`registry.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/registry.py#L378-L381)) and has its own code directory, with separate versions for NVIDIA and AMD GPUs ([`vllm/models/deepseek_v41/`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41)). Its recipe, updated on 2026-09-22, asks for vLLM 0.30.0 or later. No pip package serves the architecture yet, so it has to be a container image: on NVIDIA, any `vllm/vllm-openai:nightly` image from 2026-09-10 onwards, the date the code was merged (vllm-project/vllm#56228); on AMD, `vllm/vllm-openai-rocm:nightly`.

**SOURCE-CODE OBSERVATION:** MiMo's V2 models are implemented in [`mimo_v2.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/mimo_v2.py#L991). When a MiMo configuration includes a vision encoder, vLLM loads it as the multimodal variant `MiMoV2OmniForCausalLM` instead ([`model_arch_config_convertor.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/transformers_utils/model_arch_config_convertor.py#L635-L645)). Its recipe, updated on 2026-09-23, says released vLLM up to 0.29.0 cannot read the checkpoint's 4-bit stored weights. It asks for the `vllm/vllm-openai:mimo-v26` image, or a nightly build from after 2026-09-20 (vllm-project/vllm#57784). **Engineering inference:** nothing in vLLM names version 2.6, so the claim that V2.6 takes this path, and loads as the multimodal variant because its configuration has a vision encoder, comes from reading the code. No test or run confirms it.

### Before running any of them

The study of architectures and storage does not need these version questions settled. Running a model does. Before any run, pick a specific engine release or commit and a specific container image digest, read the relevant code, and check the outputs for correctness on the target hardware. A moving branch such as `main`, or an image tag like `nightly`, points at different code from one week to the next, so it cannot be the basis of a repeatable experiment. Support in a third engine, TensorRT-LLM, was not checked for any of these checkpoints.

## First investigation: why a cache hit is not a free prompt

### The question

Prefix caching lets vLLM reuse the cache an earlier request already computed for the same opening tokens, so that part of a new prompt does not have to be processed again. Engines report how often this happens as a cache-hit rate. The question was whether a hit rate tells you how much prompt processing was actually skipped.

### How it was examined

**SOURCE-CODE OBSERVATION:** vLLM's source was read at commit `836bb3839ffefcda8283ea7d41671a89e1a613df` (`836bb38`), not run as an installed engine. Four source and test files are saved in the [source directory](../../research/sources/2026-09-15/README.md): the [cache configuration](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/vllm/config/cache.py), the [scheduler](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/vllm/v1/core/sched/scheduler.py), the [cache manager](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/vllm/v1/core/kv_cache_manager.py) and its [tests](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/tests/v1/core/test_prefix_caching.py). The tests were read but not executed.

The trace followed one path. The feature is switched on by `CacheConfig.enable_prefix_caching` in `vllm/config/cache.py`; how the command-line flag reaches that setting was not traced. The `Scheduler` creates a `KVCacheManager` from the cache settings. For each request, the scheduler first asks the manager which blocks are already cached (`get_computed_blocks`), then asks for room for the tokens it will compute (`allocate_slots`), and finally releases the blocks (`free`). A coordinator handles models with more than one cache group. The costly work along this path is the lookup itself, checking that the groups agree, deciding whether there is room, recomputing, and allocating. The request handling before the scheduler, engine start-up beyond the scheduler, the model runner and the GPU kernels were outside this trace.

### What it found

The cache manager never looks up more than `request.num_tokens - 1` tokens. Even when the whole prompt is already cached, the last token must be processed again, because its output is what produces the next token. Reuse also has to end on a block boundary, which can push more of the prompt back into recomputation. And for models with some layers that keep only partial state, such as a sliding window, the method records the point up to which those layers can share a prefix. So a cache-hit percentage, on its own, does not say how much computation remains.

**Engineering inference:** changing nothing but the state of the cache can change the time to the first token, with the same weights, the same model quality and the same hardware. For hybrid models, reuse has to line up with the recurrent or sliding-window state those layers need, not only with the full-attention blocks ([design background](https://github.com/vllm-project/vllm/blob/836bb3839ffefcda8283ea7d41671a89e1a613df/docs/design/hybrid_kv_cache_manager.md)).

### What comes next

The next learning task is to take one request with a cached opening and an uncached remainder, say which state can be reused, and predict which metric should improve. After that, compare a cold request with a warm one, using identical tokenised content and a stated cache state. Changes to the cache manager should wait until that explanation and that baseline exist.

For a concrete example of eviction and recomputation, read at the newer commit `05d8963`, see [When the cache is full](kv-pressure.md).
