// The six states of the prefill-versus-decode scene (module 12 §8).
//
// Chapter three §02 states the ratio `I ≈ n / W`: intensity tracks how many
// tokens share each weight read. The scene walks that formula with one real
// checkpoint, holding W fixed and changing only n, because that is the whole
// argument: the two phases run the same model and differ by orders of
// magnitude in how much work each weight read is asked to do.
//
// The weight bytes come from the pinned checkpoint record, so the "same weights
// either way" claim is a number rather than an assertion.

import { modelMeta } from './memory.mjs';

/** Tokens a decode step carries: one per sequence in flight. */
export const decodeTokens = sequences => sequences;

/**
 * Builds the scene. `promptTokens` is the prompt length prefilled in one step;
 * `sequences` is the concurrency during decode; `batched` is a larger batch
 * used by the last state to show the lever.
 */
export function phaseStates({ model, promptTokens, sequences, batched }, records) {
  if (!modelMeta[model] || !records.weights[model]) throw new RangeError('Unknown model');
  for (const n of [promptTokens, sequences, batched]) {
    if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('Invalid phase input');
  }
  if (batched <= sequences) throw new RangeError('The batched state must carry more tokens than the plain one');

  const weightBytes = records.weights[model].bytes;
  // n / W, in tokens per gigabyte of weights read. The absolute value is not
  // the point; the ratio between the phases is.
  const perGB = tokens => tokens / (weightBytes / 1e9);
  const decode = decodeTokens(sequences);
  const ratio = Math.round(promptTokens / decode);
  const batchedGain = Math.round((batched / decode) * 10) / 10;

  const frames = {
    prompt:   { tokens: 0, phase: 'waiting', label: 'nothing computed yet' },
    prefill:  { tokens: promptTokens, phase: 'prefill', label: 'one step' },
    decode:   { tokens: decode, phase: 'decode', label: 'one step per token' },
    batched:  { tokens: batched, phase: 'decode', label: 'one step per token' },
  };
  for (const frame of Object.values(frames)) {
    frame.weightBytes = weightBytes;
    frame.tokensPerGB = perGB(frame.tokens);
  }

  const states = [
    { id: 'prompt', frame: 'prompt', focus: 'tokens', label: 'A prompt arrives',
      caption: `A ${promptTokens.toLocaleString()}-token prompt, and a checkpoint of ${gb(weightBytes)} GB of weights. Nothing has been computed yet.` },
    { id: 'prefill', frame: 'prefill', focus: 'tokens', label: 'Prefill takes it all at once',
      caption: `Prefill runs every one of those ${promptTokens.toLocaleString()} positions through the model together. The weights are read once for the whole step.` },
    { id: 'prefill-intensity', frame: 'prefill', focus: 'intensity', label: 'Every weight read does a lot of work',
      caption: `That single read of ${gb(weightBytes)} GB is shared by ${promptTokens.toLocaleString()} tokens. The step has arithmetic to spare, and its ceiling is the arithmetic, not the memory.` },
    { id: 'decode', frame: 'decode', focus: 'tokens', label: 'Decode takes one token per sequence',
      caption: `Now the same model generates. With ${sequences} sequences in flight, a step carries ${decode} tokens: one for each. The weights read are identical.` },
    { id: 'decode-intensity', frame: 'decode', focus: 'intensity', label: 'The same read, doing almost nothing',
      caption: `The same ${gb(weightBytes)} GB is now shared by ${decode} tokens instead of ${promptTokens.toLocaleString()}. That is ${ratio.toLocaleString()}× less work per byte moved, from one line of the same model.` },
    { id: 'batching', frame: 'batched', focus: 'intensity', label: 'Which is why batching is the lever',
      caption: `Raise the sequences in flight to ${batched} and the same read serves ${batched} tokens: ${batchedGain}× the intensity, with no faster chip involved. You cannot make decode compute-bound by buying clock speed.` },
  ];

  return { frames, states, ratio, weightBytes };
}

const gb = bytes => {
  const value = bytes / 1e9;
  return value.toFixed(value < 10 ? 1 : 0);
};
