import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScene, sceneStates, SCENE_SCENARIO } from '../site/src/schedulerStates.mjs';
import { SCENARIOS, simulate } from '../site/src/engineSim.mjs';

test('the scene has the six states the storyboard names, in reading order', () => {
  const { states } = buildScene();
  assert.deepEqual(states.map(s => s.id),
    ['arrival', 'contention', 'selection', 'advance', 'pressure', 'takeaway']);
});

test('every state points at a frame the simulation actually produced', () => {
  const { frames, states } = buildScene();
  for (const s of states) {
    assert.ok(Number.isInteger(s.frame), `${s.id} has no frame index`);
    assert.ok(s.frame >= 0 && s.frame < frames.length, `${s.id} is outside the timeline`);
  }
});

test('the states advance through the timeline and never go backwards', () => {
  const { states } = buildScene();
  for (let i = 1; i < states.length; i++) {
    assert.ok(states[i].frame >= states[i - 1].frame,
      `${states[i].id} (frame ${states[i].frame}) precedes ${states[i - 1].id} (frame ${states[i - 1].frame})`);
  }
});

test('each state is true of its frame, so the caption cannot contradict the engine', () => {
  const { frames, states } = buildScene();
  const at = id => frames[states.find(s => s.id === id).frame];

  assert.ok(Object.values(at('arrival').requests).some(r => r.phase !== 'unborn'),
    'arrival: nothing has arrived');
  assert.equal(at('contention').freeBlocks, 0,
    'contention: blocks are still free');
  assert.ok(at('selection').events.some(e => e.includes('preempted')),
    'selection: nothing was preempted');
  assert.ok(at('advance').queue.length > 0,
    'advance: nobody is waiting, so nothing was chosen over anything');
  assert.ok(at('pressure').events.some(e => e.includes('preempted')),
    'pressure: nothing was preempted');
  assert.ok(at('takeaway').allDone,
    'takeaway: the run has not finished');
});

test('the second preemption is a later, distinct event from the first', () => {
  const { states } = buildScene();
  const selection = states.find(s => s.id === 'selection').frame;
  const pressure = states.find(s => s.id === 'pressure').frame;
  assert.ok(pressure > selection,
    'the scene would show the same preemption twice');
});

test('the pressure state costs a request work it had already generated', () => {
  // The section's claim is that preemption is not free. If the simulation ever
  // stops recomputing generated tokens, this caption becomes false.
  const { frames, states } = buildScene();
  const frame = frames[states.find(s => s.id === 'pressure').frame];
  const event = frame.events.find(e => e.includes('preempted'));
  const generated = Number(event.match(/Its (\d+) generated tokens/)?.[1]);
  assert.ok(generated > 0, `expected lost generated tokens, got: ${event}`);
});

test('the scene uses the scenario about a finite pool, not the single-request one', () => {
  const { scenario } = buildScene();
  assert.equal(scenario.id, SCENE_SCENARIO);
  assert.ok(scenario.config.requests.length > 1, 'one request cannot contend for anything');
});

test('an unknown scenario is refused rather than silently rendering nothing', () => {
  assert.throws(() => buildScene('not-a-scenario'), /unknown scenario/);
});

test('a timeline with no preemption fails loudly instead of rendering a gap', () => {
  // The single-request scenario never contends, so it cannot tell this story.
  const single = SCENARIOS.find(s => s.id === 'single');
  assert.throws(() => sceneStates(simulate(single.config)), /no frame satisfies state/);
});

test('no two consecutive states render the same picture', () => {
  // Arrival and contention are one simulation step: the requests arrive and
  // immediately fill the pool. Without a focus they were the same frame twice.
  const { states } = buildScene();
  for (let i = 1; i < states.length; i++) {
    const a = states[i - 1], b = states[i];
    assert.ok(a.frame !== b.frame || a.focus !== b.focus,
      `states "${a.id}" and "${b.id}" both show frame ${b.frame} focused on ${b.focus}`);
  }
});

test('every state says which half of the stage its caption is about', () => {
  const { states } = buildScene();
  for (const s of states) {
    assert.ok(['pool', 'lanes'].includes(s.focus), `state "${s.id}" has no usable focus`);
  }
});
