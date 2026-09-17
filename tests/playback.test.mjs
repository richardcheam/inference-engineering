import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPlayback, playback, isRunning, primaryAction, MODES } from '../site/src/playback.mjs';

const run = (state, ...actions) => actions.reduce((s, a) => playback(s, typeof a === 'string' ? { type: a } : a), state);
const fresh = (opts) => initPlayback(opts);

test('an example opens idle and still', () => {
  const s = fresh();
  assert.equal(s.mode, 'idle');
  assert.equal(isRunning(s), false);
});

test('entering the viewport starts it', () => {
  assert.equal(run(fresh(), 'enter').mode, 'playing');
});

test('leaving while playing suspends, and returning resumes', () => {
  const suspended = run(fresh(), 'enter', 'exit');
  assert.equal(suspended.mode, 'system_suspended');
  assert.equal(isRunning(suspended), false);
  assert.equal(run(suspended, 'enter').mode, 'playing');
});

test('a user pause survives leaving and returning', () => {
  // The distinction the module calls mandatory.
  const paused = run(fresh(), 'enter', 'pause');
  assert.equal(paused.mode, 'user_paused');
  assert.equal(run(paused, 'exit').mode, 'user_paused');
  assert.equal(run(paused, 'exit', 'enter').mode, 'user_paused',
    'scrolling away and back restarted an example the learner had paused');
});

test('a user pause is only lifted by the user', () => {
  const paused = run(fresh(), 'enter', 'pause');
  assert.equal(run(paused, 'play').mode, 'playing');
  assert.equal(run(paused, 'toggle').mode, 'playing');
});

test('system suspension and user pause are different states', () => {
  const suspended = run(fresh(), 'enter', 'exit');
  const paused = run(fresh(), 'enter', 'pause');
  assert.notEqual(suspended.mode, paused.mode);
});

test('reduced motion never starts an example by itself', () => {
  const s = fresh({ reducedMotion: true });
  assert.equal(run(s, 'enter').mode, 'idle');
  assert.equal(isRunning(run(s, 'enter')), false);
});

test('reduced motion still lets the learner press play', () => {
  const s = fresh({ reducedMotion: true });
  assert.equal(run(s, 'enter', 'play').mode, 'playing',
    'the explanation became unreachable rather than merely still');
});

test('turning reduced motion on mid-session stops a moving example', () => {
  const playing = run(fresh(), 'enter');
  const stopped = playback(playing, { type: 'reduced_motion', value: true });
  assert.equal(stopped.mode, 'user_paused');
  assert.equal(stopped.reducedMotion, true);
});

test('reaching the end completes, and completion does not restart on scroll', () => {
  const done = run(fresh(), 'enter', 'ended');
  assert.equal(done.mode, 'completed');
  assert.equal(run(done, 'exit', 'enter').mode, 'completed',
    'a finished example started itself again');
});

test('replay restarts a completed example', () => {
  const done = run(fresh(), 'enter', 'ended');
  assert.equal(run(done, 'replay').mode, 'playing');
});

test('scrubbing resumes only if it was playing beforehand', () => {
  const fromPlaying = run(fresh(), 'enter', 'scrub_start');
  assert.equal(fromPlaying.mode, 'scrubbing');
  assert.equal(run(fromPlaying, 'scrub_end').mode, 'playing');

  const fromPaused = run(fresh(), 'enter', 'pause', 'scrub_start');
  assert.equal(run(fromPaused, 'scrub_end').mode, 'user_paused',
    'scrubbing started an example the learner had deliberately stopped');
});

test('scrubbing under reduced motion never resumes playback', () => {
  const s = run(fresh({ reducedMotion: true }), 'enter', 'play', 'scrub_start');
  assert.equal(run(s, 'scrub_end').mode, 'user_paused');
});

test('reaching the end while scrubbing does not complete the example', () => {
  const scrubbing = run(fresh(), 'enter', 'scrub_start');
  assert.equal(run(scrubbing, 'ended').mode, 'scrubbing');
});

test('touching a control while it plays yields control to the learner', () => {
  // §22: it must not advance under someone inspecting a state.
  assert.equal(run(fresh(), 'enter', 'inspect').mode, 'user_paused');
  // But inspecting something already paused changes nothing.
  const paused = run(fresh(), 'enter', 'pause');
  assert.equal(run(paused, 'inspect').mode, 'user_paused');
});

test('choosing a new scenario reopens the example ready to play', () => {
  const done = run(fresh(), 'enter', 'ended');
  const reset = run(done, 'reset');
  assert.equal(reset.mode, 'idle');
  assert.equal(run(reset, 'enter').mode, 'playing');
});

test('a reset keeps the reduced-motion preference', () => {
  const s = run(fresh({ reducedMotion: true }), 'enter', 'play', 'reset');
  assert.equal(s.reducedMotion, true);
  assert.equal(run(s, 'enter').mode, 'idle');
});

test('the primary control offers the right verb in every mode', () => {
  assert.equal(primaryAction(fresh()), 'play');
  assert.equal(primaryAction(run(fresh(), 'enter')), 'pause');
  assert.equal(primaryAction(run(fresh(), 'enter', 'pause')), 'play');
  assert.equal(primaryAction(run(fresh(), 'enter', 'exit')), 'play');
  assert.equal(primaryAction(run(fresh(), 'enter', 'ended')), 'replay');
});

test('sitting at the last frame offers replay however the learner got there', () => {
  // Clicking the final stage leaves the machine paused, not completed. Offering
  // "play" there restarts and completes in the same instant, which strands them.
  const paused = run(fresh(), 'enter', 'pause');
  assert.equal(primaryAction(paused, false), 'play');
  assert.equal(primaryAction(paused, true), 'replay');
  // Playing still takes precedence: the verb is pause while it moves.
  assert.equal(primaryAction(run(fresh(), 'enter'), true), 'pause');
});

test('every mode the machine can reach is a declared mode', () => {
  const reachable = new Set();
  const walk = (state, depth) => {
    reachable.add(state.mode);
    if (depth === 0) return;
    for (const type of ['enter','exit','play','pause','toggle','replay','inspect','scrub_start','scrub_end','ended','reset']) {
      walk(playback(state, { type }), depth - 1);
    }
  };
  walk(fresh(), 4);
  for (const mode of reachable) {
    assert.ok(MODES.includes(mode), `undeclared mode reachable: ${mode}`);
  }
});

test('unknown actions leave the machine alone', () => {
  const s = run(fresh(), 'enter');
  assert.deepEqual(playback(s, { type: 'nonsense' }), s);
});
