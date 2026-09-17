import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/timeline.mjs', import.meta.url);
let advance, transport;
try { ({ advance, transport } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const state = (o = {}) => ({ frame: 0, playing: false, total: 10, speed: 1, ...o });

test('play and pause are separate states, not a toggle guess', () => {
  assert.equal(typeof transport, 'function', 'The transport reducer must be implemented');
  assert.equal(transport(state(), { type: 'play' }).playing, true);
  assert.equal(transport(state({ playing: true }), { type: 'pause' }).playing, false);
  assert.equal(transport(state({ playing: true }), { type: 'toggle' }).playing, false);
  assert.equal(transport(state({ playing: false }), { type: 'toggle' }).playing, true);
});

test('stepping moves one frame and never leaves the timeline', () => {
  assert.equal(transport(state({ frame: 3 }), { type: 'next' }).frame, 4);
  assert.equal(transport(state({ frame: 3 }), { type: 'prev' }).frame, 2);
  assert.equal(transport(state({ frame: 0 }), { type: 'prev' }).frame, 0, 'cannot step before the start');
  assert.equal(transport(state({ frame: 9 }), { type: 'next' }).frame, 9, 'cannot step past the end');
});

test('stepping by hand pauses playback, because you have taken over', () => {
  assert.equal(transport(state({ playing: true, frame: 2 }), { type: 'next' }).playing, false);
  assert.equal(transport(state({ playing: true, frame: 2 }), { type: 'prev' }).playing, false);
  assert.equal(transport(state({ playing: true, frame: 2 }), { type: 'seek', frame: 7 }).playing, false);
});

test('reset returns to the start and stops', () => {
  const r = transport(state({ frame: 8, playing: true }), { type: 'reset' });
  assert.equal(r.frame, 0);
  assert.equal(r.playing, false);
});

test('seeking is clamped rather than throwing', () => {
  assert.equal(transport(state(), { type: 'seek', frame: 99 }).frame, 9);
  assert.equal(transport(state(), { type: 'seek', frame: -4 }).frame, 0);
});

test('playback advances one frame per tick and stops at the end', () => {
  assert.equal(typeof advance, 'function', 'The tick must be implemented');
  assert.equal(advance(state({ playing: true, frame: 0 })).frame, 1);
  const atEnd = advance(state({ playing: true, frame: 9 }));
  assert.equal(atEnd.frame, 9, 'does not wrap');
  assert.equal(atEnd.playing, false, 'and stops rather than spinning');
});

test('a paused timeline does not advance on a tick', () => {
  assert.equal(advance(state({ playing: false, frame: 4 })).frame, 4);
});

test('playing from the final frame restarts instead of doing nothing', () => {
  const r = transport(state({ frame: 9, playing: false }), { type: 'play' });
  assert.equal(r.frame, 0, 'pressing play at the end replays');
  assert.equal(r.playing, true);
});

test('speed is constrained to the offered choices', () => {
  assert.equal(transport(state(), { type: 'speed', speed: 2 }).speed, 2);
  assert.equal(transport(state({ speed: 1 }), { type: 'speed', speed: 99 }).speed, 1, 'unknown speeds are ignored');
});

test('an unknown action leaves the state untouched', () => {
  const before = state({ frame: 3, playing: true });
  assert.deepEqual(transport(before, { type: 'nonsense' }), before);
});

test('a new scenario resizes the timeline and clamps the cursor into it', () => {
  const r = transport(state({ frame: 8, total: 10 }), { type: 'resize', total: 4 });
  assert.equal(r.total, 4);
  assert.equal(r.frame, 3, 'a cursor past the new end is pulled back inside it');
  assert.equal(transport(state(), { type: 'resize', total: 0 }).total, 10, 'a nonsense length is ignored');
});
