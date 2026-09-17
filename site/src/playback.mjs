// The editorial playback state machine (module 13 §19).
//
// A timeline says *where* we are; this says *why* we are or are not moving. The
// distinction the module calls mandatory is between the system suspending
// playback because the example scrolled out of view, and the learner pausing
// it. Scrolling away and back must resume the first and must not resume the
// second, so "paused" cannot be one boolean.
//
// Kept separate from `timeline.mjs` and from any component: playback state,
// technical state, rendering and viewport observation are four different
// things (§29).

/** @typedef {'idle'|'playing'|'system_suspended'|'user_paused'|'scrubbing'|'completed'} Mode */

export const MODES = ['idle', 'playing', 'system_suspended', 'user_paused', 'scrubbing', 'completed'];

/**
 * `reducedMotion` is part of the initial state rather than checked at each
 * transition, because §5 is a rule about how the example *opens*: it never
 * starts itself, but the learner may still start it.
 */
export function initPlayback({ reducedMotion = false } = {}) {
  return { mode: 'idle', reducedMotion, resumeAfterScrub: false };
}

export function playback(state, action) {
  const { mode, reducedMotion } = state;

  switch (action.type) {
    // ---- Viewport ---------------------------------------------------------
    case 'enter':
      // §5: reduced motion never autoplays. §4: a user pause survives leaving
      // and returning, and a finished example does not start itself again.
      if (reducedMotion) return mode === 'idle' ? state : state;
      if (mode === 'idle' || mode === 'system_suspended') return { ...state, mode: 'playing' };
      return state;

    case 'exit':
      // Only playing yields to the viewport. A user pause is persistent, and a
      // completed or scrubbing example has nothing to suspend.
      return mode === 'playing' ? { ...state, mode: 'system_suspended' } : state;

    // ---- The learner ------------------------------------------------------
    case 'play':
      return { ...state, mode: 'playing' };

    case 'pause':
      // Explicit, and therefore sticky.
      return { ...state, mode: 'user_paused' };

    case 'toggle':
      return playback(state, { type: mode === 'playing' ? 'pause' : 'play' });

    case 'replay':
      return { ...state, mode: 'playing' };

    // §22: the animation must never fight someone inspecting a state.
    case 'inspect':
      return mode === 'playing' ? { ...state, mode: 'user_paused' } : state;

    // ---- Scrubbing --------------------------------------------------------
    case 'scrub_start':
      return { ...state, mode: 'scrubbing', resumeAfterScrub: mode === 'playing' };

    case 'scrub_end':
      return {
        ...state,
        mode: state.resumeAfterScrub && !reducedMotion ? 'playing' : 'user_paused',
        resumeAfterScrub: false,
      };

    // ---- The timeline -----------------------------------------------------
    case 'ended':
      return mode === 'scrubbing' ? state : { ...state, mode: 'completed' };

    /** A new scenario is a new example: it reopens at idle, ready to autoplay. */
    case 'reset':
      return { ...initPlayback({ reducedMotion: state.reducedMotion }) };

    case 'reduced_motion':
      // Turning it on mid-session should stop an example that is moving.
      return {
        ...state,
        reducedMotion: !!action.value,
        mode: action.value && mode === 'playing' ? 'user_paused' : mode,
      };

    default:
      return state;
  }
}

/** Whether the clock should be running. The only thing the timer needs to ask. */
export const isRunning = state => state.mode === 'playing';

/**
 * Whether the primary control offers play, pause or replay (§6, §13).
 *
 * `atEnd` matters as much as the mode: a learner who reached the last stage by
 * clicking it is just as finished as one who watched it get there, and offering
 * them "play" strands them — it restarts and completes in the same instant.
 */
export function primaryAction(state, atEnd = false) {
  if (state.mode === 'playing') return 'pause';
  if (state.mode === 'completed' || atEnd) return 'replay';
  return 'play';
}
