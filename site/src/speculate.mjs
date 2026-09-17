// The cheatsheet states the condition: speculation helps when
//   draft_time + verification_time < expected_emitted_tokens × ordinary_decode_step_time
// at comparable load. Everything here is that inequality, made explicit.

/**
 * Expected accepted drafts for a chain of `length` tokens each accepted with probability p.
 * Acceptance stops at the first rejection, so this is a truncated geometric sum.
 */
export function expectedAccepted(length, p) {
  if (!Number.isSafeInteger(length) || length <= 0) throw new RangeError('Invalid draft length');
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('Invalid acceptance rate');
  if (p === 1) return length;
  let sum = 0;
  for (let i = 1; i <= length; i++) sum += p ** i;
  return sum;
}

/** All costs are in units of one ordinary decode step. */
export function speculation({ draftLength, acceptance, draftCost, verifyCost, baseStep }) {
  if (!Number.isSafeInteger(draftLength) || draftLength <= 0) throw new RangeError('Invalid draft length');
  if (!Number.isFinite(acceptance) || acceptance < 0 || acceptance > 1) throw new RangeError('Invalid acceptance rate');
  if (!Number.isFinite(draftCost) || draftCost < 0) throw new RangeError('Invalid draft cost');
  if (!Number.isFinite(verifyCost) || verifyCost <= 0) throw new RangeError('Invalid verification cost');
  if (!Number.isFinite(baseStep) || baseStep <= 0) throw new RangeError('Invalid baseline step');

  const accepted = expectedAccepted(draftLength, acceptance);
  // Verification yields one correct token regardless, so a fully rejected round still advances.
  const tokensPerStep = accepted + 1;
  const stepTime = draftCost * draftLength + verifyCost;
  const timePerToken = stepTime / tokensPerStep;
  const baselineTimePerToken = baseStep;

  // The acceptance rate at which time per token equals the ordinary step.
  const required = stepTime / baseStep - 1;           // tokens needed to break even
  let breakEvenAcceptance = null;
  if (required <= 0) breakEvenAcceptance = 0;
  else if (required >= draftLength) breakEvenAcceptance = 1;
  else {
    let low = 0, high = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (expectedAccepted(draftLength, mid) < required) low = mid; else high = mid;
    }
    breakEvenAcceptance = (low + high) / 2;
  }

  return {
    accepted, tokensPerStep, stepTime, timePerToken, baselineTimePerToken,
    speedup: baselineTimePerToken / timePerToken,
    worthwhile: timePerToken < baselineTimePerToken,
    breakEvenAcceptance,
    wastedDrafts: draftLength - accepted,
  };
}
