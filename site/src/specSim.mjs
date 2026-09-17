// A speculation round, frame by frame: draft k tokens, verify them in one pass, commit the
// accepted prefix plus the one token verification produces regardless.
//
// Acceptance is sampled from a seeded generator so that stepping backwards shows the same
// round you just watched. Real acceptance is not a constant rate; chapter nine says so at
// length. This is a visualisation of the mechanism, not a prediction.
const mulberry = seed => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Real words, so the reader watches a sentence assemble rather than abstract slots. */
export const SPEC_TEXT = [
  ' The', ' cache', ' is', ' read', ' once', ' per', ' step', ',', ' so', ' every',
  ' extra', ' token', ' in', ' the', ' batch', ' is', ' nearly', ' free', '.', ' That',
  ' is', ' the', ' whole', ' idea', '.', ' Speculation', ' spends', ' idle', ' compute', '.',
];

export function simulateSpeculation({ draftLength, rounds, acceptance, seed }) {
  if (!Number.isSafeInteger(draftLength) || draftLength <= 0) throw new RangeError('Invalid draft length');
  if (!Number.isSafeInteger(rounds) || rounds <= 0) throw new RangeError('Invalid round count');
  if (!Number.isFinite(acceptance) || acceptance < 0 || acceptance > 1) throw new RangeError('Invalid acceptance rate');

  let random = mulberry(seed ?? 1);
  const frames = [];
  let emitted = 0;
  let step = 0;
  const committedText = [];
  let cursor = 0;
  const push = (phase, tokens, committed, events) => {
    frames.push({ step: step++, phase, round: frames.length ? frames[frames.length - 1].round : 0,
                  tokens: tokens.map(t => ({ ...t })), committed, emitted,
                  committedText: [...committedText], events });
  };

  push('idle', [], 0, ['Nothing drafted yet.']);

  for (let round = 1; round <= rounds; round++) {
    const draft = Array.from({ length: draftLength }, (_, i) => ({ index: i, verdict: 'pending' }));
    // Each drafted slot carries the word it is guessing, so a rejection is legible.
    const guessed = draft.map((t, i) => ({ ...t, text: SPEC_TEXT[(cursor + i) % SPEC_TEXT.length] }));
    frames.push({ step: step++, phase: 'draft', round, tokens: guessed.map(t => ({ ...t })), committed: 0, emitted,
      committedText: [...committedText],
      events: [`Round ${round}: the draft model guesses the next ${draftLength} tokens.`] });

    frames.push({ step: step++, phase: 'verify', round, tokens: guessed.map(t => ({ ...t, verdict: 'checking' })), committed: 0, emitted,
      committedText: [...committedText],
      events: ['The target model checks all of them in one pass, the same weight read as an ordinary step.'] });

    let accepted = 0;
    let broken = false;
    const judged = guessed.map(t => {
      if (broken) return { ...t, verdict: 'discarded' };
      if (random() < acceptance) { accepted += 1; return { ...t, verdict: 'accepted' }; }
      broken = true;
      return { ...t, verdict: 'rejected' };
    });
    const committed = accepted + 1;
    emitted += committed;
    // Accepted drafts, plus the token verification produces regardless, join the output.
    for (let i = 0; i < committed; i++) committedText.push(SPEC_TEXT[(cursor + i) % SPEC_TEXT.length]);
    cursor += committed;
    const discarded = judged.filter(t => t.verdict === 'discarded').length + (broken ? 1 : 0);
    frames.push({ step: step++, phase: 'commit', round, tokens: judged, committed, emitted,
      committedText: [...committedText],
      events: [broken
        ? `${accepted} accepted, then a rejection. ${discarded} drafted ${discarded === 1 ? 'token is' : 'tokens are'} thrown away, and verification still yields one correct token: ${committed} emitted.`
        : `All ${accepted} accepted, plus the verified token: ${committed} emitted from one round.`] });
  }
  return frames;
}
