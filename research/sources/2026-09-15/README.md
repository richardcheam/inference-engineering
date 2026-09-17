# Source snapshots

Last researched: 2026-09-15

Only metadata, configuration, and selected source/test files are stored here. No model weights, benchmark outputs, or private workplace data were downloaded.

## Model snapshots

| Local prefix | Official repository | Pinned revision |
|---|---|---|
| `glm-5.3` | [zai-org/GLM-5.3](https://huggingface.co/zai-org/GLM-5.3) | `aca966e4e02791568aa6a4ced368624b3d897f42` |
| `qwen3.6-35b-a3b` | [Qwen/Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) | `995ad96eacd98c81ed38be0c5b274b04031597b0` |
| `mistral-medium-3.5` | [mistralai/Mistral-Medium-3.5-128B](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B) | `22b2b868a15677cfa6061277ed2f653d1349a9ab` |
| `deepseek-v4.1-flash` | [deepseek-ai/DeepSeek-V4.1-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) | `dba1be0a40aa45a94ad051997016db3960a90277` |

For each prefix:

- `.hub.json`: response from `https://huggingface.co/api/models/{repository}`, recording the revision returned at retrieval. These endpoint snapshots are discovery metadata, not a second immutable artifact source.
- `.config.json`: config fetched using that immutable revision.
- `.model.safetensors.index.json`: tensor-name/shard map and published size metadata at that revision. Size is stored tensor payload, not a runtime allocation report.

Raw files were fetched from `https://huggingface.co/{repository}/raw/{revision}/{filename}`. GLM's large index is stored through Git LFS, so its resolved content was fetched from the corresponding `/resolve/` URL. It was checked against the LFS pointer's **11,359,251 bytes** and SHA-256 **e0fe7f28c1f853d4824e4d796374e3dacf1fe470988773952c79b063768134bf**.

The displayed Hub totals are not used as uniform-precision memory estimates. In particular, packed low-bit tensors and auxiliary components need separate treatment. Actual shard headers and payloads have not been downloaded or audited; index sizes are publisher metadata.

## vLLM source snapshots

Revision: `836bb3839ffefcda8283ea7d41671a89e1a613df` (main observed on research date).

| Local file | Upstream path |
|---|---|
| `vllm-cache-config.py` | `vllm/config/cache.py` |
| `vllm-scheduler.py` | `vllm/v1/core/sched/scheduler.py` |
| `vllm-kv-cache-manager.py` | `vllm/v1/core/kv_cache_manager.py` |
| `vllm-test-prefix-caching.py` | `tests/v1/core/test_prefix_caching.py` |

Retrieved from `https://raw.githubusercontent.com/vllm-project/vllm/{revision}/{upstream_path}`. These are reference copies with upstream notices intact. They are not a local engine installation or executable test suite. See the [bounded investigation](../../../engines/vllm/current-state.md).

## Documents read without duplicating full text

- Model cards, engine recipes, and hardware/tool documentation are linked next to their claims in the notes. Moving pages were checked on the research date; their exact deployment combinations remain subject to verification.
- DeepSeek's technical report was fetched at the model revision above and extracted locally for sections 2.1, 2.3, and 3.2. The temporary PDF is not required to reproduce our arithmetic. [Pinned report](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/dba1be0a40aa45a94ad051997016db3960a90277/DeepSeek_V41_Tech_Report.pdf).
- No dedicated Deep Research service was available. No simulator, GPU benchmark, deployment, or quality evaluation was performed.

## Integrity and reproduction

[manifest.json](manifest.json) records local file sizes, SHA-256 checksums, and retrieval URLs for these snapshots. The [worked example](../../../experiments/001-feasibility/README.md) reproduces the arithmetic from saved inputs. Checksums detect local changes; they do not independently verify publisher claims.

Research refreshes should use a new dated directory or explicit revision suffix rather than overwriting these inputs.
