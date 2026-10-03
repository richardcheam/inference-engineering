# Serving two new MoE models in vLLM

Last researched: 2026-09-29

## The question

DeepSeek V4.1 Flash and MiMo V2.6 Flash are both mixture-of-experts (MoE) models. Instead of one large feed-forward network in each layer, an MoE layer has many smaller "expert" networks, and a router sends each token to only a few of them. Most of the weights sit idle for any one token, which is what makes these models cheap to run for their size.

If you served either model with vLLM, what would vLLM actually do? Which code would pick the kernels, which kernels would it pick on which GPU, and in what precision would the arithmetic really happen? This page traces those choices through the code. It does not teach the underlying ideas again: chapters [07](#parallel), [08](#quantize) and [09](#speculate) do that, and this page links to them where they apply.

## How this was examined

No GPU was used and nothing was run. The answers come from reading vLLM's source at one fixed commit, [`05d8963`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35) (29 September 2026), the two models' published configurations and model cards, and vLLM's deployment recipes for them, all read on that date. Every code link points at that commit.

So everything below describes what the code says vLLM *should* do. What it does on a particular machine can only be confirmed from that machine's start-up log, and the last section says which log lines to look for. Each finding carries a label: **source-code observation** for what the code states directly, **verified fact** for what a pinned document states, **derived** for arithmetic from a tested function, and **engineering inference** for a conclusion drawn from several sources that nothing has confirmed.

TODO: link the two model reviews on the personal site once they are published. Neither was published on 2026-09-29.

## The two models

Both configurations are saved in the [2026-09-29 source snapshot](../../research/sources/2026-09-29/README.md). DeepSeek V4.1 Flash's configuration has not changed since it was first pinned on 2026-09-15.

| | DeepSeek V4.1 Flash | MiMo V2.6 Flash |
|---|---|---|
| Size (model cards) | 552B parameters; 8B used per token while reading the prompt, 16B while generating | 309B parameters, 15B used per token |
| Experts | 384, plus one shared expert every token uses; each token goes to 6 | 256, no shared expert; each token goes to 8 |
| Attention | a compressed, sparse attention design (CSA2) with a sliding window | 39 sliding-window layers that look back 128 tokens, and 9 global layers that look back over everything |
| Weights | experts in 4-bit MXFP4; most other weights in 8-bit MXFP8 (recipe) | experts stored in 4-bit MXFP4 (config and recipe) |
| Draft model for speculation | DSpark, built in | a DFlash drafter shipped alongside, plus an MTP layer |
| Longest context | about 1M tokens | 1,048,576 tokens |

MXFP4 and MXFP8 are 4-bit and 8-bit floating-point formats in which each small group of numbers shares one scale factor. That keeps them accurate enough to use at a quarter or half the size of 16-bit weights. The checkpoint MiMo publishes is called `MiMo-V2.6-Flash-RL`, because `MiMo-V2.6-Flash` was not publicly accessible on the research date. vLLM loads it through its MiMo V2 code, as the multimodal variant `MiMoV2OmniForCausalLM` because the configuration includes a vision encoder. No string in vLLM names version 2.6, so this is an **engineering inference** (see the [engine page](current-state.md)).

## How much cache a long conversation needs

The KV cache holds, for every token already processed, the values later tokens look back at. For long conversations it can outgrow the weights. The two models make very different choices here.

**VERIFIED FACT:** DeepSeek's model card gives its global cache as about 890 bytes per token, roughly a quarter of its predecessor's ([model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/README.md)). A conversation that has reached one million tokens therefore holds about 0.93 GB of it.

**Derived:** MiMo's nine global layers each keep 4 key-value heads per token. Each head stores a 192-value key and a 128-value value. That makes 9 × 4 × (192 + 128) = 11,520 numbers per token: 23,040 bytes in 16-bit BF16, or 11,520 bytes in 8-bit FP8. The arithmetic is `attentionCache` in `site/src/memory.mjs`, which is tested against the site's pinned Mistral and Qwen figures. At one million tokens, that is 24.2 GB in BF16, about a sixth of an H200's 141 GB, for one conversation. The 39 sliding-window layers add a fixed amount however long the conversation gets, because each keeps only the last 128 tokens: **at most** 25.6 MB per conversation in BF16.

So for a million-token conversation, MiMo's cache is roughly 26 times DeepSeek's. The comparison is rough, because the two figures count different things. DeepSeek's covers only its global cache, and vLLM stores it in records of its own: 528 or 584 bytes per token for the sliding-window part, and 288 bytes per token for the compressed part under the `nvfp4_ds_mla` format (**source-code observation**, [`attention.py` lines 512 to 518](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/attention.py#L512-L518)). The direction is clear, though. At long context, MiMo's cache, not its weights, limits how many conversations fit on a GPU. DeepSeek's design is aimed squarely at that limit.

## Four decisions vLLM makes

Every serving choice vLLM makes for these models comes down to four questions. Which attention kernel reads the cache? Which expert kernel multiplies the 4-bit weights, and in what precision? How are the experts spread over the GPUs? And how many tokens does it guess ahead? The answers depend on the GPU generation, which vLLM identifies by its compute capability: SM90 is Hopper (H100, H200, GH200), SM100 is Blackwell in the data centre (B200), and SM12x is Blackwell in workstation and consumer cards (such as the RTX 5090).

## Decision 1: the attention kernel

An attention kernel is the GPU program that reads the cache and computes attention for each new token. The two models reach theirs by different routes.

**DeepSeek V4.1 chooses its own.** **SOURCE-CODE OBSERVATION:** its code bypasses vLLM's general kernel selector, because, in the code's own words, "the generic CUDA backend selector does not instantiate DSv4 layers directly" ([`_select_dsv4_attn_cls`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/nvidia/model.py#L191-L237)). If the operator names a kernel, it uses that. Otherwise, on SM12x cards it uses FlashInfer's sparse attention. On SM100 it uses FlashMLA's "mega attention" where the setup allows it, which folds several separate steps of attention into one GPU launch. Everywhere else it uses FlashMLA's sparse attention. Its cache can be stored as `fp8_ds_mla`, or as `nvfp4_ds_mla` with the compressed part in 4-bit. The 4-bit option works only on SM100, because only there can FlashMLA read it ([lines 523 to 527](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/attention.py#L523-L527)).

**MiMo goes through vLLM's ordinary path.** Because it mixes sliding-window and global layers, vLLM's hybrid KV cache manager gives the two kinds of layer separate groups within one pool. Sliding-window blocks can then be released as they fall out of the window ([When the cache is full](kv-pressure.md) explains how). One detail is easy to miss. **SOURCE-CODE OBSERVATION:** MiMo's published configuration sets `attention_chunk_size: 128`, a setting for a different kind of local attention that MiMo does not use. Left in place, it would turn the hybrid cache manager off, so vLLM deletes it when it loads the model ([`model_arch_config_convertor.py` lines 624 to 632](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/transformers_utils/model_arch_config_convertor.py#L624-L632)).

## Decision 2: the expert kernel

For every token, an MoE layer routes the token to its experts, sends it to wherever those experts live, runs the experts' matrix multiplications, and combines the results. vLLM splits the moving part from the arithmetic part: one component handles sending and combining, another runs the multiplications ([`modular_kernel.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/modular_kernel.py#L180)).

**Both models end up at the same selector.** **SOURCE-CODE OBSERVATION:** DeepSeek's quantization settings hand its 4-bit experts to `Mxfp4MoEMethod` ([`quant_config.py` line 228](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/quant_config.py#L228)). MiMo's do the same, because its configuration says the experts are stored as MXFP4 ([`fp8.py` lines 199 to 204](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/quantization/fp8.py#L199-L204)). That method tries four kernels in order on NVIDIA GPUs, and takes the first that supports the setup ([selector](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L657-L728), [order](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L367-L390)):

| Tried | Kernel | Weights stored as | Arithmetic done in ([source](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L393-L408)) |
|---|---|---|---|
| first | FlashInfer TRT-LLM | 4-bit MXFP4 | 8-bit MXFP8 |
| second | DeepGEMM | 4-bit MXFP4 | 8-bit FP8 |
| third | Marlin | 4-bit MXFP4 | 16-bit BF16 |
| fourth | Batched Marlin | 4-bit MXFP4 | 16-bit BF16 |

The selector's own comment says Blackwell (SM100 and newer) takes one of the first two, and Hopper (SM90) falls through to Marlin. Marlin runs on anything from compute capability 7.5 up ([`marlin_moe.py` lines 587 to 589](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/experts/marlin_moe.py#L587-L589)). On AMD GPUs, a different order applies.

This table is chapter 08's distinction between stored and executed precision, made concrete. The same 4-bit checkpoint is multiplied in 8-bit on a B200 and in 16-bit on an H200. Marlin keeps the weights 4-bit in GPU memory, which saves space and memory traffic, and expands them to 16-bit just before each multiplication (**conceptual**: this is how Marlin kernels are built, not something this reading verified line by line). MiMo's recipe describes its weights as "computed as FP8", but in vLLM the precision of the arithmetic is whatever the chosen kernel uses. **Engineering inference:** on Hopper, Marlin is the expected kernel for these experts. On Blackwell, seeing Marlin in the start-up log would mean the faster kernels declined the setup, which is worth investigating.

DeepSeek V4.1 can also use "mega-MoE" kernels, which fuse the whole expert step into one program. **SOURCE-CODE OBSERVATION:** at this commit only DeepSeek V4, DeepSeek V4.1 and Kimi K3 are wired for them ([`config/kernel.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/kernel.py#L143-L177)).

## Decision 3: spreading experts over GPUs

A model this size does not fit on one GPU, so the weights are split. vLLM has three ways to split work. Tensor parallelism (TP) cuts every layer's weights across GPUs. Data parallelism (DP) runs separate copies that serve different requests. Expert parallelism (EP) gives each GPU a share of the experts.

**Expert parallelism is not a separate setting with its own size.** According to vLLM's [expert-parallel deployment guide](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/serving/expert_parallel_deployment.md), turning on `--enable-expert-parallel` spreads the experts over all TP × DP GPUs. Attention is still split by tensor parallelism within each data-parallel copy. **Derived:** with two GPUs in the expert group, each holds 192 of DeepSeek's 384 experts, or 128 of MiMo's 256. This uses the guide's formula, total experts plus any spare copies, divided by GPUs, implemented as `expertsPerRank` in `site/src/parallel.mjs`.

Splitting experts creates traffic. Each token has to be sent to the GPUs that hold its experts and the results sent back, an exchange called all-to-all. vLLM offers several implementations, suited to one machine or several and to prompt-heavy or generation-heavy work (listed in the appendix). Two further features shape the cost. The expert load balancer (EPLB) moves or copies popular experts so that no GPU is overloaded, at the price of extra memory for the copies. Dual batch overlap (DBO) splits each batch in two, so one half's all-to-all happens while the other half computes. **SOURCE-CODE OBSERVATION:** DeepSeek V4.1 cannot use DBO, because its Engram memory (below) does not support it ([`engram.md`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/engram.md#L145-L146)). For DeepSeek V4.1, vLLM also switches on sequence parallelism by itself under certain setups: no pipeline parallelism, expert parallelism on, more than one tensor-parallel GPU, and either a mega-MoE kernel or more than one data-parallel copy ([`_use_sequence_parallel`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/nvidia/model.py#L240-L248)).

Chapter [07](#parallel) explains what each kind of splitting costs on every step.

## Decision 4: guessing ahead

Speculative decoding uses a small, fast draft model to guess several tokens ahead. The large model then checks all the guesses in one pass and keeps the ones it agrees with. When the guesses are good, several tokens come out of one pass. The checking step is the same whatever produced the draft. What differs is the draft model.

For these two models, the relevant drafters are as follows (**source-code observation**, [`config/speculative.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/speculative.py#L68-L84)):

- **MTP** (multi-token prediction) layers are trained together with the model. MiMo ships some, but vLLM "currently supports only the first MiMo-V2 MTP layer" ([lines 737 to 760](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/speculative.py#L737-L760)).
- **DFlash** drafts a whole block of tokens in one pass rather than one at a time. MiMo ships a 5-layer DFlash drafter, which vLLM runs with its `qwen3_dflash` code ([`registry.py` line 635](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/registry.py#L635)). The recipe has it propose 7 tokens at a time.
- **DSpark** is DeepSeek V4.1's drafter ([`nvidia/dspark.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/nvidia/dspark.py)). Like DFlash, it drafts a block in one pass. It then runs a small correction, one token at a time, so each guess can take the previous one into account. It also has a confidence head that estimates how likely each guessed position is to be accepted ([description](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/models/qwen3_dspark.py#L3-L16)).

That confidence head enables **adaptive verification** ([documentation](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/speculative_decoding/adaptive_verification.md)). Checking guesses costs compute, and under heavy load that compute could have served other requests. So instead of checking every guess, vLLM scores each guessed position across the whole batch by how likely it is to survive. That is the product of the confidences up to that position. vLLM checks the best-scoring positions until a budget is used up. The budget comes from timing measurements vLLM takes at start-up, which is why the feature needs CUDA graphs, pre-recorded sequences of GPU work, and is refused when they are turned off. At this commit it works only with DSpark.

Chapter [09](#speculate) works out when guessing ahead pays for one request. Adaptive verification applies the same trade to a whole batch at once: a confident request's fifth guess can be checked before a doubtful request's first.

## Memory outside the GPU

DeepSeek V4.1 has one more component that changes the memory picture: Engram, a pair of very large lookup tables that the model consults by the preceding few tokens. **VERIFIED FACT** from vLLM's [Engram documentation](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/features/engram.md): the two tables hold roughly 384 million rows each, about 200 GB in total. That is more than a whole H200.

They do not have to sit in GPU memory. Which rows a step needs is known from the token IDs before the step starts. So vLLM keeps the tables in CPU memory by default and fetches the needed rows while the GPU is still working on earlier layers. The GPU memory this saves goes to the KV cache. Settings for sharing one copy of the tables between several model copies on a node are listed in the appendix. The same idea, keeping cold data in CPU memory and moving it only when needed, can apply to the KV cache too; [When the cache is full](kv-pressure.md) covers how.

## What to check on real hardware

Everything above says what the code should choose. Only a start-up log shows what it did. These are questions to settle on a real machine, not results.

The expert kernel is logged as `Using '<backend>' Mxfp4 MoE backend.` ([oracle](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/model_executor/layers/fused_moe/oracle/mxfp4.py#L436-L437)). If you set `VLLM_LOGGING_LEVEL=DEBUG`, every kernel that was skipped is also logged with its reason, which is how you would explain a Marlin fallback on Blackwell. For DeepSeek V4.1, the cache format actually in use is the one written back into the running configuration ([`attention.py` lines 138 to 146](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/models/deepseek_v41/attention.py#L138-L146)), not necessarily the one passed in `--kv-cache-dtype`.

## Takeaway

For both models, vLLM's serving choices come down to four decisions, and each is made by a small, readable piece of code that depends on the GPU generation. The most consequential surprise is precision: the same 4-bit checkpoint is multiplied in 8-bit on Blackwell and in 16-bit on Hopper, and only the start-up log says which happened. At long context, the two models also differ by more than an order of magnitude in how much cache each conversation needs.

## Evidence

- vLLM at [`05d8963`](https://github.com/vllm-project/vllm/tree/05d89636fca80d806732ced636ef505f42e6fe35), with the quoted files and both model configurations saved in the [source snapshot](../../research/sources/2026-09-29/README.md)
- [DeepSeek V4.1 Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/README.md) and [recipe](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4.1-Flash), read on 2026-09-29
- [MiMo V2.6 Flash model card](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL/blob/5711b268169967567844e1e560e8a3966da959b1/README.md) and [recipe](https://recipes.vllm.ai/XiaomiMiMo/MiMo-V2.6-Flash-RL), read on 2026-09-29
- The [engine support table](current-state.md)

## Next

Chapter [10](#production) puts decisions like these into one reviewable deployment design, with the assumptions each rests on written down.

## Appendix: reference details

**What "FlashInfer" can mean in a log.** FlashInfer is a library that appears in five unrelated roles, so a log line mentioning it needs context.

| Role | Where it appears at `05d8963` |
|---|---|
| Attention | DeepSeek V4.1's sparse attention on SM12x cards |
| Expert multiplications | the first kernel in the expert table above |
| Sending tokens between GPUs | `flashinfer_nvlink_one_sided` and `flashinfer_nvlink_two_sided` ([`config/parallel.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/parallel.py#L56-L58)) |
| Choosing the next token | on unless `VLLM_USE_FLASHINFER_SAMPLER=0` ([`envs.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/envs.py#L873-L877)) |
| Combining results across GPUs together with normalisation | the `fuse_allreduce_rms` compilation pass ([`config/compilation.py`](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/vllm/config/compilation.py#L142)) |

**All-to-all implementations**, from the [deployment guide](https://github.com/vllm-project/vllm/blob/05d89636fca80d806732ced636ef505f42e6fe35/docs/serving/expert_parallel_deployment.md):

| Setting | Guide's intended use |
|---|---|
| `allgather_reducescatter` | the default; works with any setup |
| `deepep_high_throughput` | several machines, prompt-heavy work |
| `deepep_low_latency` | several machines, generation-heavy work |
| `flashinfer_nvlink_one_sided` | several machines joined by NVLink, high throughput |
| `flashinfer_nvlink_two_sided` | several machines joined by NVLink |

EPLB's memory cost, per the guide, is layers × bytes per expert × (experts + spare copies) ÷ GPUs in the expert group.

**Engram settings** (`--engram-config`): `cpu_offload` (on by default) keeps the tables in CPU memory. `embedding_across_dp` (off) splits one copy of the tables across all GPUs, at the cost of extra communication every step. `dp_shared_memory` (on when possible) shares one CPU copy per machine between the model copies running on it.

**Reading a new model in vLLM.** The order that worked for both models:

1. The model registry (`vllm/model_executor/models/registry.py`): which class serves the architecture, and whether its configuration is rewritten on load.
2. The attention class and its cache specification: whether the model picks its own kernel, and what is stored per token.
3. The kernel selector under `fused_moe/oracle/`: which expert kernels are tried, in what order, and in which precision.
4. `vllm/config/speculative.py`: which drafters the architecture supports, with what limits.
5. The feature documentation and the recipe: what works together, and which version it needs.
