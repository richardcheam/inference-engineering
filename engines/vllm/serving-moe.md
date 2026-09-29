# Serving two new MoE models in vLLM

Last researched: 2026-09-29

## Four decisions

Every serving decision vLLM makes for a large mixture-of-experts model is one of four:

1. which attention kernel reads the cache
2. which expert kernel multiplies the quantized weights
3. how experts are spread over devices
4. how many tokens to guess ahead

This page follows those four decisions through vLLM for DeepSeek V4.1 Flash and MiMo V2.6 Flash. The concepts are taught in chapters [07](#parallel), [08](#quantize) and [09](#speculate). This page adds only the engine-specific layer: which code makes each decision, and what it chooses.

Every code reference is to vLLM commit [`05d89636fca80d806732ced636ef505f42e6fe35`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35) (`05d8963`), read on 2026-09-29. Nothing was run. Where this page says what vLLM *would* choose on a given GPU, that is read from the code and is a question for hardware, not a result.

TODO: link the two model reviews on the personal site once they are published. Neither was published on 2026-09-29.

## The two models, as vLLM sees them

Both configurations are pinned in the [2026-09-29 source snapshot](../../research/sources/2026-09-29/README.md). DeepSeek V4.1 Flash's configuration is unchanged since 2026-09-15: same revision, same SHA-256.

| | DeepSeek V4.1 Flash | MiMo V2.6 Flash (`MiMo-V2.6-Flash-RL`) |
|---|---|---|
| vLLM class | `DeepseekV41ForCausalLM` | `MiMoV2ForCausalLM` in the config; loaded as `MiMoV2OmniForCausalLM` because the config has a vision tower (**Engineering inference**, see the [engine page](current-state.md)) |
| Parameters (model card) | 552B backbone; 8B active per token in prefill, 16B in decode | 309B total, 15B active |
| Experts and routing | 384 routed plus 1 shared, top-6 | 256 routed, top-8, no shared expert |
| Attention | Compressed sparse attention (CSA2) with a sliding window, 40 layers as a 20-layer causal encoder and a 20-layer decoder | 48 layers: 39 sliding-window layers (window 128, 8 KV heads) and 9 global layers (4 KV heads); QK head 192, V head 128 |
| KV per token | about 890 B of global KV (model card) | 23,040 B in BF16 or 11,520 B in FP8 for the 9 global layers (derived below) |
| Weight formats | routed experts MXFP4, the rest MXFP8 block-scaled, embedding and LM head BF16 (recipe) | stored as MXFP4, computed as FP8 with 128 × 128 blocks (config and recipe) |
| Drafter | DSpark | a DFlash drafter shipped in the checkpoint, and an MTP layer |
| Context | 1M tokens | 1,048,576 tokens |

**VERIFIED FACT:** DeepSeek's 890 bytes of global KV per token is the [model card's](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/README.md) figure, stated as roughly a quarter of DeepSeek V4 Flash's. At 1M tokens that is 0.93 GB per sequence.

**SOURCE-CODE OBSERVATION:** vLLM stores DeepSeek V4.1's cache in its own per-record formats. The sliding-window record is 528 B per token when the V4.1 MXFP8 record is in use and 584 B otherwise. The compressed record is 288 B per token under `nvfp4_ds_mla` ([`attention.py` lines 512 to 518](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/attention.py#L512-L518)). These are the engine's storage records, not the model card's accounting, so the two numbers are not expected to match.

**Derived:** MiMo's global layers hold 9 layers × 4 KV heads × (192 + 128) = 11,520 values per token, from `attentionCache` in `site/src/memory.mjs`, which is tested against the pinned Mistral and Qwen figures. That is 23,040 B in BF16 and 11,520 B in FP8, which grows to 24.2 GB and 12.1 GB per sequence at 1M tokens. The 39 sliding-window layers hold at most 128 tokens each. **Bounded:** they add at most 25.6 MB per sequence in BF16 however long the context, before block rounding. Neither figure includes the vision or audio encoders, or any record format vLLM adds.

## Attention: hard-wired versus registry

The two models reach their attention kernels by different routes.

**DeepSeek V4.1 picks its own class.** **SOURCE-CODE OBSERVATION:** [`_select_dsv4_attn_cls`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/nvidia/model.py#L191-L237) exists because, in its own words, "the generic CUDA backend selector does not instantiate DSv4 layers directly". An explicitly requested backend is honoured. Otherwise:

- SM12x takes FlashInfer sparse MLA
- SM100 takes FlashMLA "mega attention" when the topology allows it, which fuses Q RoPE, sparse attention, the output's inverse RoPE and its FP8 cast into one launch
- everything else, including SM100 topologies mega attention declines, takes FlashMLA sparse

Its cache format is `fp8_ds_mla`, or `nvfp4_ds_mla`, which keeps the MXFP8 sliding-window record and stores the compressed cache as NVFP4. The NVFP4 format needs the V4.1 records, "which FlashMLA decodes only on SM100" ([lines 523 to 527](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/attention.py#L523-L527)).

**MiMo goes through the ordinary path.** It uses the hybrid KV cache manager, which gives its sliding-window and global layers separate cache groups in one pool (see [When the cache is full](kv-pressure.md) for how sliding-window blocks are freed early). Three details are specific to it:

- its sliding-window layers carry an attention sink bias and its global layers do not (`add_swa_attention_sink_bias: true`, `add_full_attention_sink_bias: false` in the pinned config)
- its V head (128) is narrower than its QK head (192), which is why the cache arithmetic above counts them separately
- **SOURCE-CODE OBSERVATION:** vLLM deletes the `attention_chunk_size: 128` that MiMo's config sets, because the architecture does not use chunked local attention and leaving the field set would switch the hybrid KV cache manager off ([`model_arch_config_convertor.py` lines 624 to 632](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/transformers_utils/model_arch_config_convertor.py#L624-L632))

## Expert kernels and Marlin

A MoE layer does five things for each token: route it to experts, dispatch it to wherever those experts live, run the expert matrix multiplications, combine the results, and add the shared expert if there is one. vLLM splits this into a "modular kernel" pairing ([`modular_kernel.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/modular_kernel.py#L180)): a `FusedMoEPrepareAndFinalize`, which owns dispatch and combine, and a `FusedMoEExperts`, which owns the multiplications ([line 458](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/modular_kernel.py#L458)).

**Both models end up at the same selector.** **SOURCE-CODE OBSERVATION:** DeepSeek V4.1's quantization config returns `Mxfp4MoEMethod` for its routed experts ([`quant_config.py` line 228](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/quant_config.py#L228)). MiMo's FP8 config does the same when `store_dtype` is `mxfp4` ([`fp8.py` lines 199 to 204](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/quantization/fp8.py#L199-L204)). `Mxfp4MoEMethod` calls [`select_deepseek_v4_mxfp4_moe_backend`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L657-L728). With no backend requested, on NVIDIA it tries [`_get_priority_backends`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L367-L390) in order, and takes the first whose kernel supports the configuration:

| Order | Backend | Weights | Activations ([`_backend_activation_key`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L393-L408)) |
|---|---|---|---|
| 1 | FlashInfer TRTLLM MXFP4 × MXFP8 | MXFP4 | MXFP8 |
| 2 | DeepGEMM MXFP4 | MXFP4 | FP8, 128-wide blocks |
| 3 | Marlin | MXFP4 | BF16 |
| 4 | Batched Marlin | MXFP4 | BF16 |

The selector's docstring says SM100 and newer prefer the first two, and SM90 falls through to Marlin. Marlin needs compute capability 7.5 or newer ([`marlin_moe.py` lines 587 to 589](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/experts/marlin_moe.py#L587-L589)). On ROCm, DeepSeek V4 routing prefers AITER and then an unfused Triton kernel instead. The order belongs to this selector, not to MXFP4 as such: gpt-oss's MXFP4 path uses a different one, with a BF16-activation variant first.

**Marlin is W4A16:** its activation key is BF16, per the table. **Conceptual:** the weights stay 4-bit in HBM and are dequantized to BF16 in registers before a BF16 matrix multiply, which is how Marlin kernels are built. That is chapter 08's distinction between stored and executed precision made concrete. The same MXFP4 checkpoint executes with MXFP8, FP8 or BF16 activations depending on which row of the table is chosen. MiMo's recipe describes its weights as "computed as FP8", but in vLLM the executed precision is whatever the chosen backend multiplies in. **Engineering inference:** on Hopper, Marlin is the expected path for these FP4 experts. On Blackwell, a Marlin line in the start-up log means the faster backends declined, and is worth investigating.

**The mega-MoE backends are wired by very few models.** **SOURCE-CODE OBSERVATION:** `deep_gemm_mega_moe` runs a fused expert module that "any model with a mega-MoE module may use" ([`config/kernel.py` lines 143 to 157](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/kernel.py#L143-L157)). At the pin, only DeepSeek V4, DeepSeek V4.1 and Kimi K3 have one. The FlashInfer `flashinfer_moe_ep_mega_*` variants are limited to DeepSeek V4 and V4.1 architectures ([lines 171 to 177](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/kernel.py#L171-L177)).

## FlashInfer is five things

"FlashInfer" in a vLLM log can mean any of five unrelated components, so it is worth knowing which one a line refers to.

| Role | Where it appears at `05d8963` |
|---|---|
| Attention backend | FlashInfer sparse MLA for DeepSeek V4.1 on SM12x, above |
| MoE experts | the TRTLLM MXFP4 × MXFP8 backend, first in the table above |
| Expert-parallel all-to-all | `flashinfer_nvlink_one_sided` and `flashinfer_nvlink_two_sided` ([`config/parallel.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/parallel.py#L56-L58)) |
| Sampler | `VLLM_USE_FLASHINFER_SAMPLER`, on unless set to 0 ([`envs.py` lines 873 to 877](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/envs.py#L873-L877)) |
| All-reduce plus RMSNorm fusion | the `fuse_allreduce_rms` compilation pass ([`config/compilation.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/compilation.py#L142)), which uses FlashInfer's communication kernels |

## Parallelism

**Expert parallelism is not a size of its own.** Per vLLM's [expert-parallel deployment guide](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/serving/expert_parallel_deployment.md), once `--enable-expert-parallel` is set the expert layers form one EP group of size TP × DP. Attention stays tensor-parallel within each DP group, or is replicated when TP is 1. Without the flag, expert layers are tensor-parallel across all TP × DP devices, like a dense model.

**Derived:** with vLLM's distribution formula, (experts + redundant experts) ÷ EP ranks, implemented as `expertsPerRank` in `site/src/parallel.mjs`, EP 2 gives DeepSeek V4.1 192 of its 384 routed experts per device and MiMo 128 of its 256.

The tokens routed to an expert have to reach its device and come back, which is what the all-to-all backend decides:

| Backend | Guide's use case |
|---|---|
| `allgather_reducescatter` | the default; any EP and DP configuration |
| `deepep_high_throughput` | multi-node, prefill-dominated |
| `deepep_low_latency` | multi-node, decode-dominated, with CUDA graphs |
| `flashinfer_nvlink_one_sided` | multi-node NVLink systems, high throughput |
| `flashinfer_nvlink_two_sided` | multi-node NVLink systems |

- **EPLB** rebalances experts over time and can add redundant experts. Those cost memory on every EP rank: the guide gives the overhead as layers × bytes per expert × (experts + redundant) ÷ EP ranks.
- **DBO**, dual batch overlap, splits a batch in two so one half's all-to-all overlaps the other half's compute (`--enable-dbo`). **SOURCE-CODE OBSERVATION:** DeepSeek V4.1's Engram does not support DBO or microbatching ([`docs/features/engram.md`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/engram.md#L145-L146)).
- **Sequence parallelism** turns on automatically for DeepSeek V4.1 when pipeline parallelism is 1, expert parallelism is enabled, TP is greater than 1, and either a mega-MoE backend is in use or DP is greater than 1 ([`_use_sequence_parallel`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/nvidia/model.py#L240-L248)).

Chapter [07](#parallel) teaches what each of these divides and what it costs on the critical path.

## Speculation

Every drafter feeds the same verifier: the target model scores the drafted tokens in one pass and keeps the prefix it agrees with. What differs is how the draft is made. **SOURCE-CODE OBSERVATION:** the speculative methods at the pin ([`config/speculative.py` lines 68 to 84](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/speculative.py#L68-L84)) include:

| Drafter | How it drafts | Here |
|---|---|---|
| n-gram, suffix | matches the context; no model | either model |
| MTP | extra prediction layers trained with the target | MiMo ships one; vLLM "currently supports only the first MiMo-V2 MTP layer" ([lines 737 to 760](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/speculative.py#L737-L760)) |
| EAGLE-3 | a small head reading the target's hidden states | neither checkpoint ships one |
| DFlash | a whole block in one parallel pass | MiMo: `dflash/` in the checkpoint, a 5-layer `DFlashDraftModel` with blocks of 8, which vLLM maps to `qwen3_dflash` ([`registry.py` line 635](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/registry.py#L635)); the recipe verifies 7 tokens |
| DSpark | a DFlash-style parallel block, then a sequential correction | DeepSeek V4.1 ([`nvidia/dspark.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/nvidia/dspark.py)) |

**DSpark,** from its docstring in [`qwen3_dspark.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/qwen3_dspark.py#L3-L16), drafts a whole block in one parallel pass. It then adds a low-rank Markov head, sampled left to right, that injects dependency between the drafted tokens. A confidence head estimates, for each position, the probability that it will be accepted.

**Adaptive verification** uses that confidence ([`adaptive_verification.md`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/speculative_decoding/adaptive_verification.md)). Each (request, position) slot is scored by its survival probability, the running product of that request's per-position confidences. Slots from the whole batch are admitted in order of that score until a verification budget is spent. The budget comes from a cost model profiled at start-up over captured CUDA graphs, so `--enforce-eager` is rejected. At the pin it works only with DSpark drafters that have a confidence head, and not with LoRA or pipeline parallelism.

Chapter [09](#speculate) derives the break-even for one request. Adaptive verification applies the same trade to a whole batch at once: a confident request's fifth position can outrank a doubtful request's first.

## Memory tiers

**VERIFIED FACT** from vLLM's [Engram documentation](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/engram.md): DeepSeek V4.1 carries two Engram layers of roughly 384M table rows each. The rows are 256-byte FP8 entries plus block scales, about 200 GB of table weights. The lookup indices are known from the token IDs alone, before the forward pass, so the tables need not sit in GPU memory. By default vLLM keeps them in pinned host memory and reads them over unified virtual addressing, prefetching on a side stream so the transfers overlap earlier layers' compute. The GPU memory saved goes to the KV cache.

| `--engram-config` field | Default | Effect |
|---|---|---|
| `cpu_offload` | on | tables in pinned host memory rather than HBM |
| `embedding_across_dp` | off | shard one table copy across all TP × DP ranks, at the cost of per-step DP collectives |
| `dp_shared_memory` | on when allowed | one host copy per node in `/dev/shm`, shared by co-located DP replicas |

The same idea, keeping cold state in host memory and moving it only when it is needed, applies to the KV cache as well. [When the cache is full](kv-pressure.md) covers the OffloadingConnector and HiSparse.

## What did I actually get?

This section is a **question to check on hardware**, not a result. The code says what vLLM *should* choose; only a start-up log says what it did.

- The expert backend is logged as `Using '<backend>' Mxfp4 MoE backend.` ([oracle, lines 436 and 721](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L436-L437)).
- With `VLLM_LOGGING_LEVEL=DEBUG`, every backend that was skipped is logged with its reason: `Mxfp4 MoE backend '<backend>' does not support the deployment configuration since <reason>.` That line is what explains a Marlin fallback on Blackwell.
- DeepSeek V4.1 writes the KV cache format it resolved back onto the cache configuration ([`attention.py` lines 138 to 146](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/attention.py#L138-L146)), so the running configuration, not the `--kv-cache-dtype` flag, says which format is in use.

## Reading a new model in vLLM

The order that worked for both models, and that should work for the next one:

1. **The registry** (`vllm/model_executor/models/registry.py`): which class serves the architecture, and whether a config convertor rewrites it first.
2. **The attention class and its `KVCacheSpec`:** whether the model picks its own kernel, and what the engine stores per token.
3. **The quantization oracle** under `fused_moe/oracle/`: which expert backends are tried, in what order, and with which activation precision.
4. **`vllm/config/speculative.py`:** which drafters the architecture maps to, and with what limits.
5. **The feature docs and the recipe:** what is supported together, and which version it needs.

## Takeaway

For both models, the engine's choices come down to attention kernel, expert kernel, expert placement and speculation. Each of those choices is made by a small, readable piece of code that depends on the GPU generation. The same checkpoint can execute in three different precisions, and only the start-up log says which one it got.

## Evidence

- vLLM at [`05d8963`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35), with the quoted files and both model configurations saved in the [source snapshot](../../research/sources/2026-09-29/README.md)
- [DeepSeek V4.1 Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/README.md) and [recipe](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4.1-Flash), read on 2026-09-29
- [MiMo V2.6 Flash model card](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL/blob/5711b268169967567844e1e560e8a3966da959b1/README.md) and [recipe](https://recipes.vllm.ai/XiaomiMiMo/MiMo-V2.6-Flash-RL), read on 2026-09-29
- The [engine support table](current-state.md)

## Next

Chapter [10](#production) puts these decisions into one reviewable deployment design, alongside the assumptions each of them rests on.
