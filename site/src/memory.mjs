// The per-model colours are a categorical set: four checkpoints that need to be
// told apart in a comparison, with no meaning attached to any one of them. They
// are therefore steps of one hue defined in CSS rather than four invented hues,
// which keeps the semantic palette free to mean something.
export const modelMeta = {
  'mistral-medium-3.5': { name: 'Mistral Medium 3.5', family: 'Dense · mixed FP8', component: 'mistral_gqa_bf16', partial: false, color: 'var(--model-1)', scope: 'BF16 full-attention KV. Runtime buffers are represented by your overhead reserve.' },
  'qwen3.6-35b-a3b': { name: 'Qwen3.6-35B-A3B', family: 'Hybrid MoE · BF16', component: 'qwen_full_attention_only_bf16', partial: true, color: 'var(--model-2)', scope: 'Full-attention KV only. Recurrent, convolution, and checkpoint state must be added.' },
  'glm-5.3': { name: 'GLM-5.3', family: 'Sparse MoE · FP8', component: 'glm_latent_and_position_only_bf16', partial: true, color: 'var(--model-3)', scope: 'Latent and positional KV only. Indexer, draft state, and backend-specific storage must be added.' },
  'deepseek-v4.1-flash': { name: 'DeepSeek V4.1 Flash', family: 'MoE · mixed FP4/FP8', component: 'deepseek_report_global_only', partial: true, color: 'var(--model-4)', scope: 'Report-based global KV only. Local windows, indexer buffers, and draft state are not included.' },
};

export function calculateBudget({ model, context, concurrency, capacityGiB, overheadGiB }, records) {
  const meta = modelMeta[model];
  if (!meta || !records.weights[model]) throw new RangeError('Unknown model');
  if (![context, concurrency].every(n => Number.isSafeInteger(n) && n > 0) ||
      !Number.isFinite(capacityGiB) || capacityGiB <= 0 ||
      !Number.isFinite(overheadGiB) || overheadGiB < 0) throw new RangeError('Invalid memory budget input');
  const weightGiB = records.weights[model].bytes / 2 ** 30;
  const perToken = records.cache_components[meta.component].bytes_per_token;
  const cacheGiB = perToken * context * concurrency / 2 ** 30;
  const totalGiB = weightGiB + cacheGiB + overheadGiB;
  if (!Number.isFinite(totalGiB)) throw new RangeError('Invalid memory budget result');
  return { weightGiB, cacheGiB, overheadGiB, totalGiB,
    remainingGiB: capacityGiB - totalGiB,
    verdict: totalGiB <= capacityGiB ? 'candidate' : 'exceeds',
    partial: meta.partial, scope: meta.scope };
}
