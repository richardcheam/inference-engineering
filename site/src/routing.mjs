// VERIFIED FACT: every figure below is copied from the pinned configuration for that
// revision in research/sources/2026-09-15/. A test asserts they still match those files.
export const routing = {
  'glm-5.3': { name: 'GLM-5.3', experts: 256, expertsPerToken: 8, sharedExperts: 1, hidden: 6144, moeIntermediate: 2048, layers: 78, denseFirst: 3, storedAs: 'FP8 experts', bytesPerParam: 1 },
  'deepseek-v4.1-flash': { name: 'DeepSeek V4.1 Flash', experts: 384, expertsPerToken: 6, sharedExperts: 1, hidden: 5120, moeIntermediate: 2304, layers: 40, denseFirst: 0, storedAs: 'mixed FP4/FP8 experts', bytesPerParam: 0.5, precisionAssumed: true },
  'qwen3.6-35b-a3b': { name: 'Qwen3.6-35B-A3B', experts: 256, expertsPerToken: 8, sharedExperts: 1, hidden: 2048, moeIntermediate: 512, layers: 40, denseFirst: 0, storedAs: 'BF16 experts', bytesPerParam: 2 },
};

function spec(model) {
  const found = routing[model];
  if (!found) throw new RangeError(model in { 'mistral-medium-3.5': 1 } ? 'Dense model has no expert routing' : 'Unknown routing model');
  return found;
}

function checkTokens(tokens) {
  if (!Number.isSafeInteger(tokens) || tokens <= 0) throw new RangeError('Invalid token count');
}

/** A SwiGLU expert is gate + up + down, so three matrices of hidden × expert width. */
export const paramsPerExpert = model => 3 * spec(model).hidden * spec(model).moeIntermediate;
export const moeLayers = model => spec(model).layers - spec(model).denseFirst;

/**
 * Expected number of distinct experts a step touches, for `tokens` routed independently.
 *
 * CALCULATED ESTIMATE, and a model of reuse only. Real routing is neither uniform nor
 * independent: load balancing, shared experts, and prompt similarity all move this.
 */
export function distinctExperts({ model, tokens }) {
  const { experts, expertsPerToken } = spec(model);
  checkTokens(tokens);
  return experts * (1 - (1 - expertsPerToken / experts) ** tokens);
}

/** Expert weight traffic for one step, and what it costs per emitted token. */
export function expertTraffic({ model, tokens, bytesPerParam }) {
  const s = spec(model);
  checkTokens(tokens);
  if (!Number.isFinite(bytesPerParam) || bytesPerParam <= 0) throw new RangeError('Invalid bytes per parameter');
  const perExpert = paramsPerExpert(model) * bytesPerParam;
  const layers = moeLayers(model);
  const distinct = distinctExperts({ model, tokens });
  const bytesPerStep = distinct * perExpert * layers;
  const allExpertBytes = s.experts * perExpert * layers;
  return {
    distinct, bytesPerStep, allExpertBytes,
    bytesPerToken: bytesPerStep / tokens,
    fraction: distinct / s.experts,
    // What the same step would cost if every expert were read, which is what chapter two assumed.
    denseAssumptionBytes: allExpertBytes,
    savedFraction: 1 - bytesPerStep / allExpertBytes,
  };
}

export function reuseCurve(settings, tokenCounts) {
  return tokenCounts.map(tokens => ({ tokens, ...expertTraffic({ ...settings, tokens }) }));
}
