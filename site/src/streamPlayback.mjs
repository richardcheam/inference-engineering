// The token stream, played back as it arrives.
//
// The static explorer shows the finished stream and its finished metrics, which
// is the answer without the thing that makes it surprising. Watching it arrive
// shows the moment the average is poisoned: TPOT sits on the steady gap for
// twelve tokens, the stall lands, and the number jumps and never recovers,
// because a mean has no memory of when something happened.
//
// Every frame's metrics come from `requestMetrics` over the tokens that have
// arrived by then, so the playback cannot disagree with the static readout it
// ends on.

import { requestMetrics } from './metrics.mjs';

/**
 * One frame per arrival, plus an opening frame where the request has been sent
 * and nothing has come back — which is what TTFT actually measures.
 */
export function streamFrames({ sentAt = 0, tokenTimes }) {
  if (!Array.isArray(tokenTimes) || tokenTimes.length === 0) {
    throw new RangeError('Invalid token times');
  }
  const frames = [{
    arrived: 0,
    at: sentAt,
    gap: null,
    isStall: false,
    metrics: null,
    caption: 'The request has been sent. Nothing has come back yet: this wait is TTFT.',
  }];

  const gaps = tokenTimes.slice(1).map((t, i) => t - tokenTimes[i]);
  const worst = gaps.length ? Math.max(...gaps) : 0;

  tokenTimes.forEach((at, i) => {
    const gap = i === 0 ? null : at - tokenTimes[i - 1];
    // A gap is the stall if it is the worst one and it stands clear of the rest.
    const isStall = gap !== null && gap === worst && worst > median(gaps) * 1.5;
    frames.push({
      arrived: i + 1,
      at,
      gap,
      isStall,
      metrics: requestMetrics({ sentAt, tokenTimes: tokenTimes.slice(0, i + 1) }),
      caption: captionFor(i, gap, isStall),
    });
  });
  return frames;
}

const median = list => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function captionFor(index, gap, isStall) {
  if (index === 0) return 'First token. Everything before this was time to first token.';
  if (isStall) return `The stream stops for ${Math.round(gap)} ms. One gap, and the average has to carry it from here on.`;
  return `Token ${index + 1} arrives ${Math.round(gap)} ms after the last one.`;
}

/**
 * The stream's conceptual stages, found in the arrivals rather than assumed:
 * the wait, the first token, the steady run, the stall, and what follows it.
 */
export function streamStages(frames) {
  const at = test => frames.findIndex(test);
  const stallIndex = at(f => f.isStall);
  return [
    { id: 'wait',      label: 'Waiting',   hint: 'TTFT',            frame: 0 },
    { id: 'first',     label: 'First',     hint: 'the first token', frame: at(f => f.arrived === 1) },
    { id: 'steady',    label: 'Steady',    hint: 'even gaps',       frame: at(f => f.arrived === 2) },
    { id: 'stall',     label: 'Stall',     hint: 'one long gap',    frame: stallIndex },
    { id: 'after',     label: 'After',     hint: 'the mean carries it',
      frame: stallIndex >= 0 && stallIndex + 1 < frames.length ? stallIndex + 1 : -1 },
  ]
    .filter(stage => stage.frame >= 0)
    .sort((a, b) => a.frame - b.frame)
    .filter((stage, i, list) => i === 0 || stage.frame > list[i - 1].frame);
}
