# Source snapshots, 29 September

Last researched: 2026-09-29

This directory holds the inputs behind [When the cache is full](../../../engines/vllm/kv-pressure.md) and [Serving two new MoE models in vLLM](../../../engines/vllm/serving-moe.md). It adds to the [2026-09-15 snapshot](../2026-09-15/README.md) and does not replace it: the first engine investigation still cites vLLM commit `836bb38`, and this directory cites `05d8963`. No model weights, benchmark outputs, or private workplace data were downloaded.

## Model snapshots

| Local prefix | Official repository | Pinned revision |
|---|---|---|
| `mimo-v2.6-flash-rl` | [XiaomiMiMo/MiMo-V2.6-Flash-RL](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL) | `5711b268169967567844e1e560e8a3966da959b1` |

- `.hub.json`: the response from `https://huggingface.co/api/models/XiaomiMiMo/MiMo-V2.6-Flash-RL`, recording the revision returned at retrieval.
- `.config.json`: the model configuration at that revision.
- `.dflash.config.json`: the configuration of the DFlash drafter shipped in the checkpoint's `dflash/` directory.

The repository `XiaomiMiMo/MiMo-V2.6-Flash` returned HTTP 401 on the research date, so the `-RL` checkpoint is the one pinned.

DeepSeek V4.1 Flash is not duplicated here. Its Hub endpoint still returned revision `dba1be0a40aa45a94ad051997016db3960a90277` on 2026-09-29, and its `config.json` fetched at that revision has the same SHA-256 as [the 2026-09-15 copy](../2026-09-15/deepseek-v4.1-flash.config.json): `8be45ce0476004a3f529fd896115a4a2e800a129ad2d3ec05b16050f52e21879`.

## vLLM source snapshots

Revision: `05d89636fca80d806732ced636ef505f42e6fe35` (`main` observed on the research date).

| Local file | Upstream path |
|---|---|
| [`vllm-scheduler.py`](vllm-scheduler.py) | `vllm/v1/core/sched/scheduler.py` |
| [`vllm-kv-cache-manager.py`](vllm-kv-cache-manager.py) | `vllm/v1/core/kv_cache_manager.py` |
| [`vllm-block-pool.py`](vllm-block-pool.py) | `vllm/v1/core/block_pool.py` |
| [`vllm-kv-cache-utils.py`](vllm-kv-cache-utils.py) | `vllm/v1/core/kv_cache_utils.py` |
| [`vllm-single-type-kv-cache-manager.py`](vllm-single-type-kv-cache-manager.py) | `vllm/v1/core/single_type_kv_cache_manager.py` |
| [`vllm-config-scheduler.py`](vllm-config-scheduler.py) | `vllm/config/scheduler.py` |
| [`vllm-config-kernel.py`](vllm-config-kernel.py) | `vllm/config/kernel.py` |
| [`vllm-fused-moe-oracle-mxfp4.py`](vllm-fused-moe-oracle-mxfp4.py) | `vllm/model_executor/layers/fused_moe/oracle/mxfp4.py` |
| [`vllm-deepseek-v41-nvidia-model.py`](vllm-deepseek-v41-nvidia-model.py) | `vllm/models/deepseek_v41/nvidia/model.py` |
| [`vllm-deepseek-v41-attention.py`](vllm-deepseek-v41-attention.py) | `vllm/models/deepseek_v41/attention.py` |
| [`vllm-model-arch-config-convertor.py`](vllm-model-arch-config-convertor.py) | `vllm/transformers_utils/model_arch_config_convertor.py` |
| [`vllm-config-speculative.py`](vllm-config-speculative.py) | `vllm/config/speculative.py` |

Retrieved from `https://raw.githubusercontent.com/vllm-project/vllm/{revision}/{upstream_path}`. These are reference copies with upstream notices intact. They are not a local engine installation, and none of vLLM's tests were run. Every line number cited in the two documents above was checked against a checkout of this revision.

## Documents read without duplicating full text

- vLLM's documentation at this revision: `docs/features/engram.md`, `docs/features/kv_offloading_usage.md`, `docs/features/speculative_decoding/adaptive_verification.md`, `docs/design/hisparse.md`, `docs/design/hybrid_kv_cache_manager.md` and `docs/serving/expert_parallel_deployment.md`. The documents link each one at the pinned commit.
- The vLLM recipes for [DeepSeek V4.1 Flash](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4.1-Flash) (updated 2026-09-22) and [MiMo V2.6 Flash](https://recipes.vllm.ai/XiaomiMiMo/MiMo-V2.6-Flash-RL) (updated 2026-09-23), read on 2026-09-29. Recipes change without a revision; the dates are what was read.
- The two model cards, read at the pinned revisions.
- No GPU benchmark, deployment, or quality evaluation was performed.

## Integrity

[manifest.json](manifest.json) records each file's size, SHA-256 checksum, and retrieval URL. Checksums detect local changes; they do not independently verify publisher claims.
