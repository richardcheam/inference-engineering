/**
 * One real prompt, tokenized, prefilled and decoded, step by step.
 *
 * Everything abstract in this workspace (blocks, cache bytes, prefill versus decode)
 * is a claim about this loop. This module runs the loop on a sentence anyone can check,
 * so the reader never has to take the abstraction on trust.
 *
 * The example is not a model output: it is a fixed script, chosen because the answer is
 * obvious. What is faithful is the *mechanism*: tokens are cached once and re-read on
 * every subsequent step, output arrives one token at a time, and blocks fill in order.
 */
export const EXAMPLE = {
  prompt: 'The capital of France is',
  // Word-piece tokens. Leading spaces are part of the token, which is why the UI shows
  // them explicitly; that detail surprises people and it matters for counting.
  promptTokens: ['The', ' capital', ' of', ' France', ' is'],
  output: ' Paris, the largest city in France.',
  outputTokens: [' Paris', ',', ' the', ' largest', ' city', ' in', ' France', '.'],
};

export function runDecode({ prompt, promptTokens, outputTokens, output, blockSize }) {
  if (!Number.isSafeInteger(blockSize) || blockSize <= 0) throw new RangeError('Invalid block size');
  if (!Array.isArray(promptTokens) || promptTokens.length === 0) throw new RangeError('Invalid prompt tokens');
  if (!Array.isArray(outputTokens) || outputTokens.length === 0) throw new RangeError('Invalid output tokens');

  const cache = [];
  const frames = [];
  const blocksOf = () => {
    const blocks = [];
    for (let i = 0; i < cache.length; i += blockSize) {
      blocks.push({ index: blocks.length, tokens: cache.slice(i, i + blockSize) });
    }
    return blocks;
  };
  const snap = (phase, extra) => frames.push({
    step: frames.length, phase,
    tokens: extra.tokens || [],
    cache: cache.map(c => ({ ...c })),
    blocks: blocksOf(),
    outputText: cache.filter(c => c.kind === 'output').map(c => c.text).join(''),
    reads: 0, writes: 0, ...extra,
  });

  snap('input', {
    tokens: [],
    caption: `A prompt is just text: “${prompt}”. Nothing has been computed yet.`,
  });

  snap('tokenize', {
    tokens: promptTokens.map((text, i) => ({ text, index: i, kind: 'prompt' })),
    caption: `The text is split into ${promptTokens.length} tokens. A token is usually a word or part of one, and the leading space belongs to the token.`,
  });

  // Prefill: the whole prompt is processed in one pass, and every token's key/value
  // lands in the cache together. This is the step that is compute-heavy.
  promptTokens.forEach((text, i) => cache.push({ text, position: i, kind: 'prompt' }));
  snap('prefill', {
    tokens: promptTokens.map((text, i) => ({ text, index: i, kind: 'prompt' })),
    writes: promptTokens.length,
    reads: 0,
    caption: `Prefill: all ${promptTokens.length} tokens go through the model in one step, and each leaves a cache entry behind. No output text yet: this step only builds state.`,
  });

  // Decode: one token per step, each reading everything cached before it.
  outputTokens.forEach((text, i) => {
    const readsBefore = cache.length;
    cache.push({ text, position: cache.length, kind: 'output' });
    snap('decode', {
      tokens: promptTokens.map((t, n) => ({ text: t, index: n, kind: 'prompt' })),
      reads: readsBefore,
      writes: 1,
      justWrote: text,
      caption: `Decode step ${i + 1}: the model reads all ${readsBefore} cached tokens and writes exactly one new token, “${text.trim() || 'space'}”. That one token is appended to the cache, so the next step reads ${readsBefore + 1}.`,
    });
  });

  snap('done', {
    tokens: promptTokens.map((t, n) => ({ text: t, index: n, kind: 'prompt' })),
    caption: `Finished. One prefill step handled ${promptTokens.length} tokens; ${outputTokens.length} decode steps produced ${outputTokens.length} tokens, one at a time. That asymmetry is why the two phases stress completely different parts of the machine.`,
  });

  return frames;
}
