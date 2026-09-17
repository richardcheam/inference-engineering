# First comparative feasibility study

Last researched: 2026-09-15

## Question and scope

What can we establish about a model/hardware pairing before renting a GPU or downloading weights?

We compare four released checkpoints for contrasting engineering lessons. They are not a ranked quality shortlist. Workload: text-only interactive/agentic requests, initially 32,768 and 131,072 live tokens per sequence, then concurrency 1/8/32. Output growth must be included in live length. We retain all stored tensors in the initial storage screen; a validated text-only or draft-disabled loader may omit some.

**Evidence:** model configs and tensor indices were downloaded at immutable revisions. No checkpoint weights were downloaded. [Provenance and local snapshots](../research/sources/2026-09-15/README.md).

## 1. Storage is the first screen

**VERIFIED FACT:** the following byte counts are the respective indices' `metadata.total_size`. **CALCULATED ESTIMATE:** GB/GiB conversions. These are encoded tensor payload sizes, not filesystem usage or measured GPU allocations.

| Checkpoint | Stored format observed | Tensor bytes | Decimal GB | GiB |
|---|---|---:|---:|---:|
| Qwen3.6-35B-A3B | BF16 | 71,903,645,408 | 71.904 | 66.965 |
| Mistral Medium 3.5 128B | FP8 plus BF16 and ancillary tensors | 133,605,834,656 | 133.606 | 124.430 |
| GLM-5.3 | Block FP8 plus unquantized tensors/scales | 755,617,140,416 | 755.617 | 703.723 |
| DeepSeek V4.1 Flash | FP4 experts, FP8 components, scales, BF16/FP32 tensors | 510,286,023,000 | 510.286 | 475.241 |

Sources: [Qwen index](https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/995ad96eacd98c81ed38be0c5b274b04031597b0/model.safetensors.index.json), [Mistral index](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B/blob/22b2b868a15677cfa6061277ed2f653d1349a9ab/model.safetensors.index.json), [GLM index](https://huggingface.co/zai-org/GLM-5.3/blob/aca966e4e02791568aa6a4ced368624b3d897f42/model.safetensors.index.json), [DeepSeek index](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/model.safetensors.index.json).

The Hub's displayed parameter count can include different tensor categories and packing conventions. Do not multiply it by a single dtype when the actual checkpoint mixes formats. GLM's recipe describes a ~743B backbone while the Hub reports ~753B tensor elements; resolve counting scope before using either for FLOP estimates. Storage here comes directly from the index, not either headline.

## 2. Architecture changes what those bytes do

### GLM-5.3: expert residency and sparse latent attention

**VERIFIED FACT:** config has 78 layers, 256 routed experts with top-8 routing, one shared expert, three initial dense layers, a 512-dimensional KV latent and 64 positional dimensions. It also specifies an attention indexer and one next-token-prediction layer. [Pinned config](https://huggingface.co/zai-org/GLM-5.3/blob/aca966e4e02791568aa6a4ced368624b3d897f42/config.json).

**Engineering inference:** most expert weights can be inactive for one token while still requiring storage. Larger batches touch more experts; neither weight traffic nor performance follows the active-parameter count alone. Sparse selection limits selected attention work, but the cache and the indexer still need a resource budget. Determine the engine's compressed representation before calculating KV from query heads.

**Use this case for:** resident expert capacity, batch reuse, TP/EP placement, and the difference between sparse attention computation and cache storage. The publisher reports post-training improvements over the same base as GLM-5.2; output-length and reasoning settings therefore matter in systems comparisons even when architecture is unchanged. [Model card](https://huggingface.co/zai-org/GLM-5.3).

### Qwen3.6-35B-A3B: hybrid cache geometry

**VERIFIED FACT:** the text config has 40 layers: 30 linear-attention and 10 full-attention. The full-attention layers specify two KV heads of dimension 256. The model has 256 experts, top-8 routing, shared-expert capacity, and a vision component. [Pinned config](https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/995ad96eacd98c81ed38be0c5b274b04031597b0/config.json).

**Engineering inference:** use growing KV only for the ten full-attention layers, then add recurrent and convolution states for the others. A 40-layer conventional KV formula overestimates that growing component by four times. Conversely, counting only those ten layers underestimates total state. Prefix reuse for recurrent state is an implementation question, not just a token-hash lookup.

**Use this case for:** a tractable metadata audit and a later smaller-hardware experiment. Qwen3.8 is already on the radar; we retain this checkpoint as a simpler controlled reference, not as the latest Qwen flagship.

### Mistral Medium 3.5: dense bandwidth and conventional GQA

**VERIFIED FACT:** the publisher describes a dense 128B multimodal model. Its text config has 88 layers, eight KV heads of dimension 128, and no sliding window. The release uses mixed FP8/BF16 storage. [Model card](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B), [pinned config](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B/blob/22b2b868a15677cfa6061277ed2f653d1349a9ab/config.json).

**Engineering inference:** dense text projections are used every decode step. Batch reuse can amortize their reads, but long-context KV adds traffic and capacity pressure. A smaller total model can perform more weight work per token than a much larger sparse MoE. Size alone is not a speed ranking.

**Use this case for:** a clean GQA calculation, bandwidth bounds, and showing why fitting weights does not guarantee serving long contexts.

### DeepSeek V4.1: shared compressed state and conditional memory

**MAINTAINER CLAIM, checked against report:** 552B backbone parameters plus 196B Engram parameters; 8B active during prefill and 16B during decode. The report describes a 20-layer encoder and 20-layer decoder, cross-layer compressed-KV reuse, and 890 bytes/token of global KV under its FP4 layout. Decoder bounded replay is part of its prefill design; “prefill skips every decoder operation” would be an overstatement. [Technical report, sections 2.1, 2.3 and 3.2](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/DeepSeek_V41_Tech_Report.pdf).

The config explicitly distinguishes FP4 expert storage from FP8 configuration and lists shared-cache source layers. **Engineering inference:** neither an ordinary per-layer GQA formula nor “everything is FP8” describes this checkpoint. Host placement must distinguish sparse table lookup from expert-weight streaming. [Pinned config](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/config.json).

**Use this case for:** counting auxiliary memory, phase-specific execution, and separating paper layouts from verified backend implementations. This is one advanced case, not the center of the curriculum.

## 3. Derive cache requirements explicitly

**CALCULATED ESTIMATES**, batch one, no shared prefix, BF16 cache unless noted. Length is current live token count, not just prompt length. No TP replication, padding, draft state, graph memory, or activations included.

| Model / counted component | Bytes per live token | At 32,768 tokens | At 131,072 tokens |
|---|---:|---:|---:|
| Mistral full GQA KV: `2×88×8×128×2` | 360,448 | 11.000 GiB | 44.000 GiB |
| Qwen ten full-attention layers: `2×10×2×256×2` | 20,480 | 0.625 GiB | 2.500 GiB |
| GLM latent + positional component: `78×(512+64)×2` | 89,856 | 2.742 GiB | 10.969 GiB |
| DeepSeek global KV at the report's 890 bytes/token | 890 | 0.027 GiB | 0.109 GiB |

The Mistral and Qwen rows carry a leading 2 for the stored key and value. The GLM row does not: compressed latent attention stores one latent vector per position, not a separate K and V, so applying the generic formula there would double the figure.

These rows deliberately count different components. They are not complete comparable runtime budgets. Add:

- **Qwen:** recurrent matrix states, convolution states, state checkpoints for prefix reuse/speculation, and engine padding. Under one FP32 `32×128×128` matrix per linear-attention layer, the 30 matrices alone total 60 MiB per sequence; this is a layout assumption, not measured engine allocation.
- **GLM:** sparse-indexer cache, its sharing policy, scales, draft state, and any backend-specific representation. Do not treat 2.742 GiB as its complete 32K cache.
- **DeepSeek:** local sliding-window KV, indexer/candidate buffers as applicable, speculative state, replay scratch, and the actual engine's dtype/layout. The report's global figure is not an engine memory guarantee.
- **All:** multiply unshared per-request state by concurrent live sequences, then account for physically shared prefixes and allocator block rounding. Do not blindly divide by TP.

## 4. Hardware screen

For this table only, interpret advertised GB values as decimal byte budgets to make arithmetic reproducible. Actual reported usable bytes must replace these assumptions before deployment. [Hardware sources and unit caveats](../hardware/reference.md).

“Candidate” means the storage inequality is not enough to reject it. It does not prove compatible kernels, acceptable latency, or runtime fit.

| Scenario | Qwen BF16 | Mistral mixed FP8 | GLM FP8 | DeepSeek mixed FP4/FP8 |
|---|---|---|---|---|
| 1×32 GB consumer GPU | Stored checkpoint exceeds capacity | Exceeds | Exceeds | Exceeds |
| 1×80 GB H100 SXM | Candidate, only ~8.1 GB left before state/overhead | Exceeds | Exceeds | Exceeds |
| 1×141 GB H200 | Candidate | Tight; only ~7.4 GB left before KV/overhead | Exceeds | Exceeds |
| 1×180 GB B200 | Candidate | Candidate at shorter context; full payload + 128K BF16 KV exceeds this byte budget | Exceeds | Exceeds |
| 1×192 GB MI300X | Candidate; verify ROCm backend | Candidate; verify backend and state | Exceeds | Exceeds |
| 2×144 GB GH200 | Candidate with placement proof | Candidate with placement proof | Requires host placement, different checkpoint, or more GPUs | Requires host placement, different checkpoint, or more GPUs |
| 8×141 GB H200 | Ample aggregate storage; not a sensible default allocation | Aggregate storage candidate | Aggregate storage candidate | Aggregate storage candidate; model-specific stack |

An independently quantized checkpoint changes this table and introduces a new quality/backend validation task. Summed HBM does not form one uniformly fast allocation space. Verify the largest per-rank allocation, replicated tensors, and interconnect before declaring fit.

### What GH200 changes, and what it does not

Your historical dual-GH200 setup provides a useful thought experiment. Assume 288 billion HBM bytes for this calculation. Preserving the entire stored payload gives a minimum non-HBM amount of approximately **467.6 GB for GLM** or **222.3 GB for DeepSeek**, before reserving any HBM for execution. These are placement lower bounds under unchanged representation, not offload prescriptions.

For DeepSeek, moving roughly 196.6 GB of Engram values alone leaves roughly 313.7 GB of the indexed payload, still exceeding this 288 GB HBM budget. Engine omission of unused components, repartitioning, or format changes must be accounted for separately. “Put Engram on Grace” does not complete the feasibility argument.

Grace supplies additional capacity through a different memory path. Whether that path serves sparse rows efficiently or forces expensive repeated streaming depends on access granularity, locality, batching, kernels, and overlap. No bandwidth or latency conclusion follows from capacity alone.

## 5. Performance reasoning before measurement

For a **hypothetical** dense model that reads 100 GB of weights per decode step at an effective 2 TB/s, weight reads alone take at least 50 ms. That caps batch-one output at 20 tokens/s under this simplified model. With 16 sequences sharing one weight read, the same step could emit 16 tokens: 320 aggregate tokens/s, while per-sequence time is still at least 50 ms. Compute and KV traffic can make both numbers worse. These are teaching bounds, not results for any selected model.

For uniformly distributed top-8 routing over 256 experts, expected distinct experts touched by a batch are approximately 8 at B=1, 57 at B=8, 163 at B=32, and 252 at B=128. This independent-routing toy model explains why expert traffic does not stay fixed at eight experts as concurrency rises. Actual routing correlations and uneven loads require observation.

## Decision

**KEEP** this four-model set for the first learning cycle. The first lesson explains the Mistral/Qwen cache contrast and a conditional hardware fit through worked examples. Then inspect one cache allocation path. Hardware execution remains pending; there is no evidence yet for an optimal engine, offload design, parallelism, or throughput target.
