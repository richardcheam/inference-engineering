// The six states of the scheduler scroll scene.
//
// Module 12 §5 asks for semantic states rather than phase1/phase2, and §33 for
// technical accuracy. Both are served by deriving the states from the same
// tested simulation the explorer in §04 runs: every frame shown here is a frame
// `engineSim` actually produced, found by what is true in it rather than by a
// hardcoded index. If the scheduler's behaviour changes, the scene follows or
// the tests fail — it cannot quietly disagree with the lesson.

import { SCENARIOS, simulate } from './engineSim.mjs';

/** The scenario whose story is about scheduling under a finite pool. */
export const SCENE_SCENARIO = 'pressure';

const preempts = frame => frame.events.some(e => e.includes('preempted'));

/**
 * Finds the frame for each state by condition, returning `{ id, label, frame,
 * caption }` in reading order. Throws if a state has no frame, because a scene
 * missing a beat is a bug rather than something to render half of.
 */
export function sceneStates(frames) {
  const find = (from, test) => {
    for (let i = from; i < frames.length; i++) if (test(frames[i], i)) return i;
    return -1;
  };

  const arrival = find(0, f => Object.values(f.requests).some(r => r.phase !== 'unborn'));
  const contention = find(arrival, f => f.freeBlocks === 0);
  const selection = find(0, preempts);
  // A frame where the choice is visibly in force: someone waits, nobody is
  // being preempted this step, and the rest carry on.
  const advance = find(selection + 1, f => f.queue.length > 0 && !preempts(f));
  // The second preemption is the one that costs generated work, which is the
  // point of the section: scheduling is not free.
  const pressure = find(selection + 1, preempts);
  const takeaway = find(0, f => f.allDone);

  const states = [
    { id: 'arrival', frame: arrival, focus: 'lanes', label: 'Requests arrive',
      caption: 'Three requests arrive with the same prompt length. Nothing about the model has changed; there is simply more than one of them.' },
    { id: 'contention', frame: contention, focus: 'pool', label: 'The pool is finite',
      caption: 'Their prompts alone fill every block in the pool. The cache is not a number that grows when you need more of it.' },
    { id: 'selection', frame: selection, focus: 'lanes', label: 'The scheduler chooses',
      caption: 'Something has to give, so one request is preempted and the others continue. This is a scheduling decision, not an arithmetic one.' },
    { id: 'advance', frame: advance, focus: 'lanes', label: 'The chosen work advances',
      caption: 'The admitted requests take a token each step. The preempted one holds no blocks and makes no progress at all.' },
    { id: 'pressure', frame: pressure, focus: 'lanes', label: 'The cost of being chosen last',
      caption: 'Preempted a second time, this request loses the tokens it had already generated. They will be computed again from scratch.' },
    { id: 'takeaway', frame: takeaway, focus: 'pool', label: 'Every step was a choice',
      caption: 'All three finish. The model decided what each step cost; the scheduler decided whose step it was.' },
  ];

  for (const s of states) {
    if (s.frame < 0) throw new Error(`scheduler scene: no frame satisfies state "${s.id}"`);
  }
  return states;
}

/** The scene's frames and states together, ready for a component to render. */
export function buildScene(scenarioId = SCENE_SCENARIO) {
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) throw new Error(`unknown scenario "${scenarioId}"`);
  const frames = simulate(scenario.config);
  return { scenario, frames, states: sceneStates(frames) };
}
