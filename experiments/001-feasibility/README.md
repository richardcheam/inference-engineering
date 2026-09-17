# Session 1 · From checkpoint to hardware feasibility

Last researched: 2026-09-15

Type: **analytical study**, not a GPU benchmark.

## Question

Before running an unfamiliar model, which hardware configurations can we reject, which remain candidates, and what evidence is still missing?

## Hypothesis and mechanism

Weight storage plus architecture-specific cache geometry will reject some configurations immediately. The remaining candidates require per-device placement, backend compatibility, and runtime measurements. Active parameter count alone will not explain residency or batch-dependent traffic.

## Inputs and controls

Four immutable model revisions with local config and index snapshots, a specified storage representation, and a batch-one cache calculation at 32,768 and 131,072 live tokens. Cache estimates assume BF16 except the separately labeled DeepSeek report figure. No shared prefixes, TP replication, or allocator rounding are included.

The baseline is the declared analytical accounting, not a running server. Vary model/cache geometry or live length while holding the stated arithmetic assumptions fixed. [Full comparison and limits](../../models/feasibility-study.md), [source provenance](../../research/sources/2026-09-15/README.md).

## First intuition

“The weights fit” is one inequality. A serving design also needs room for live request state and execution buffers, and enough bandwidth/compute to meet the workload's latency target.

For Mistral's conventional cache, each live token adds:

`2 (K and V) × 88 layers × 8 KV heads × 128 dimensions × 2 bytes = 360,448 bytes`

At 32,768 tokens, that is **11 GiB per sequence**. For Qwen, the ten full-attention layers contribute **0.625 GiB**, but thirty linear-attention layers need recurrent/convolution state as well. Knowing the representation is essential before extrapolating.

## Worked example: a 160 GiB memory budget

Assume a hypothetical accelerator has **160 GiB actually usable memory**. Reserve **12 GiB** for all non-weight, non-KV execution overhead. Use Mistral's indexed **124.430 GiB** weight payload and BF16 GQA cache. No sharing or sharding.

| Scenario | Calculation | What it means |
|---|---|---|
| Two concurrent 32K sequences | 124.430 + 12 + 2 × 11 = **158.430 GiB** | A narrow capacity candidate, with only 1.570 GiB remaining; output growth consumes this margin |
| One 128K sequence | 124.430 + 12 + 44 = **180.430 GiB** | Exceeds the assumed capacity by 20.430 GiB |

This 12 GiB reserve is a teaching assumption, not a runtime measurement. Neither result establishes latency. Runtime representation, effective bandwidth/compute, batching, actual allocation, and controlled measurements determine whether the configuration meets a 50 ms output-token target.

The website makes these inputs adjustable so the consequences are visible immediately. No answer or prediction is required to continue.

## Reproduce the calculations locally

From the workspace root, this uses only Python's standard library and the saved JSON. It downloads nothing, imports no model code, and prints estimates. Compare its output with [calculations.json](calculations.json). Save future revisions under new identifiers rather than overwriting evidence.

```bash
python3 - <<'PY'
import json
from pathlib import Path

root = Path('research/sources/2026-09-15')
result = {'kind': 'CALCULATED_ESTIMATE', 'date': '2026-09-15',
          'weights': {}, 'cache_components': {}, 'toy_expert_reuse': {}}
for path in sorted(root.glob('*.model.safetensors.index.json')):
    name = path.name.removesuffix('.model.safetensors.index.json')
    size = int(json.loads(path.read_text())['metadata']['total_size'])
    hub = json.loads((root / f'{name}.hub.json').read_text())
    result['weights'][name] = {'model': hub['id'], 'revision': hub['sha'],
                              'bytes': size, 'GB': size / 1e9,
                              'GiB': size / 2**30}

m = json.loads((root / 'mistral-medium-3.5.config.json').read_text())['text_config']
q = json.loads((root / 'qwen3.6-35b-a3b.config.json').read_text())['text_config']
g = json.loads((root / 'glm-5.3.config.json').read_text())
components = {
    'mistral_gqa_bf16': 2*m['num_hidden_layers']*m['num_key_value_heads']*m['head_dim']*2,
    'qwen_full_attention_only_bf16': 2*q['layer_types'].count('full_attention')*q['num_key_value_heads']*q['head_dim']*2,
    'glm_latent_and_position_only_bf16': g['num_hidden_layers']*(g['kv_lora_rank']+g['qk_rope_head_dim'])*2,
    'deepseek_report_global_only': 890,
}
for name, per_token in components.items():
    result['cache_components'][name] = {
        'bytes_per_token': per_token,
        'GiB_by_live_length': {str(n): per_token*n/2**30 for n in [32768, 131072]}}
for batch in [1, 8, 32, 128]:
    result['toy_expert_reuse'][str(batch)] = 256*(1-(1-8/256)**batch)
print(json.dumps(result, indent=2))
PY
```

## Results and interpretation

The indexed tensor payloads span ~67–704 GiB. Cache components differ substantially even at equal context length. The [study](../../models/feasibility-study.md) records capacity screens and a hypothetical bandwidth bound; neither is a runtime measurement.

**Confounders / missing evidence:** stored vs loaded representation, omitted vision/draft modules, padding/scales, KV replication, hybrid-state checkpoints, peak activation/workspace/graph usage, actual usable device bytes, supported backend, and workload quality/length distribution.

**Decision: KEEP** the analytical method. **Next:** follow the worked cache-path explanation; validate against real memory logs when hardware access exists. No offload, quantization, or engine optimization is justified yet by a measured bottleneck.
