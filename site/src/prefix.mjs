// SOURCE-CODE OBSERVATION: vLLM commit 836bb3839ffefcda8283ea7d41671a89e1a613df, from the
// copies pinned in research/sources/2026-09-15/.
//
//   kv_cache_manager.py:295   max_cache_hit_length = request.num_tokens - 1
//   kv_cache_manager.py:289-294 "When all tokens hit the cache, we must recompute the last
//                             token to obtain logits... This can trigger recomputation of an
//                             entire block, rather than just the single last token, because
//                             allocate_slots() requires num_computed_tokens to be
//                             block-size aligned."
//   kv_cache_manager.py:829   assert num_computed_tokens % manager.block_size == 0
//
// vLLM derives block_size rather than fixing one default, so it is a control here.
export const blockSizes = [16, 32, 64, 128];

/** What a prefix cache hit actually saves, once the last token and block alignment are paid for. */
export function prefixReuse({ promptTokens, cachedTokens, blockSize }) {
  if (!Number.isSafeInteger(promptTokens) || promptTokens <= 0) throw new RangeError('Invalid prompt length');
  if (!Number.isSafeInteger(cachedTokens) || cachedTokens < 0) throw new RangeError('Invalid cached length');
  if (!Number.isSafeInteger(blockSize) || blockSize <= 0) throw new RangeError('Invalid block size');

  const matched = Math.min(cachedTokens, promptTokens);
  // The lookup is capped one token short of the prompt, then aligned down to a whole block.
  const lookupLimit = Math.min(matched, promptTokens - 1);
  const reusedTokens = Math.floor(lookupLimit / blockSize) * blockSize;
  const recomputedTokens = promptTokens - reusedTokens;
  const blocksForPrompt = Math.ceil(promptTokens / blockSize);

  return {
    matched, reusedTokens, recomputedTokens, blocksForPrompt,
    paddingTokens: blocksForPrompt * blockSize - promptTokens,
    blocksReused: reusedTokens / blockSize,
    // What a cache-hit metric would report, against what the prefill actually skipped.
    reportedHitFraction: matched / promptTokens,
    actualHitFraction: reusedTokens / promptTokens,
    lostToLastToken: Math.min(matched, promptTokens) - reusedTokens,
  };
}
