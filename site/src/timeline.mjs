// A timeline is a list of precomputed frames and a cursor over them. Animations are
// modelled as discrete states rather than CSS keyframes so that stepping, seeking and
// testing all work on the same thing the eye sees.

export const SPEEDS = [0.5, 1, 2, 4];
const clamp = (n, total) => Math.max(0, Math.min(n, total - 1));

export function transport(state, action) {
  const { frame, playing, total, speed } = state;
  switch (action.type) {
    case 'play':
      // Pressing play at the end should replay, not sit there doing nothing.
      return { ...state, playing: true, frame: frame >= total - 1 ? 0 : frame };
    case 'pause':
      return { ...state, playing: false };
    case 'toggle':
      return transport(state, { type: playing ? 'pause' : 'play' });
    case 'next':
      return { ...state, frame: clamp(frame + 1, total), playing: false };
    case 'prev':
      return { ...state, frame: clamp(frame - 1, total), playing: false };
    case 'seek':
      return { ...state, frame: clamp(action.frame, total), playing: false };
    case 'reset':
      return { ...state, frame: 0, playing: false };
    case 'resize':
      // A new scenario has a different number of frames; adopt it and clamp the cursor.
      return Number.isSafeInteger(action.total) && action.total > 0
        ? { ...state, total: action.total, frame: clamp(frame, action.total) }
        : state;
    case 'speed':
      return SPEEDS.includes(action.speed) ? { ...state, speed: action.speed } : state;
    default:
      return state;
  }
}

/** One tick of playback. Stops at the end rather than wrapping. */
export function advance(state) {
  if (!state.playing) return state;
  const next = state.frame + 1;
  if (next >= state.total) return { ...state, frame: state.total - 1, playing: false };
  return { ...state, frame: next };
}
