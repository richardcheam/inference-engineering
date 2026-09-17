import React, { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import EditorialPlayback, { ScenarioNav, useEditorialPlayback } from './EditorialPlayback';
import { SCENARIOS, simulate } from './engineSim.mjs';

const PHASE_LABEL = {
  unborn: 'not yet arrived', queued: 'waiting', prefill: 'prefilling',
  decode: 'decoding', blocked: 'stalled', done: 'finished',
};

export default function EngineAnimation({ figure }) {
  const [scenarioId, setScenario] = useState('single');
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  const frames = useMemo(() => simulate(scenario.config), [scenario]);
  const { frame: cursor, dispatchFrame, play, dispatchPlay, stageRef } = useEditorialPlayback(frames.length);
  const state = cursor;
  const frame = frames[Math.min(cursor.frame, frames.length - 1)];

  // §8 Conceptual stages, found in the simulation rather than invented.
  // Arrival, prefill and the first decode all happen in one step here, so a
  // four-phase rail would be a fiction. What this loop actually has beats for
  // is the pool: empty, filling, contended, released. Scenarios differ in which
  // beats occur, and that difference is the lesson.
  const stages = useMemo(() => {
    const at = test => frames.findIndex(test);
    return [
      { id: 'empty',  label: 'Empty',     hint: 'nothing resident',  frame: at(f => f.usedBlocks === 0) },
      { id: 'fill',   label: 'Filling',   hint: 'blocks claimed',    frame: at(f => f.usedBlocks > 0) },
      { id: 'full',   label: 'Contended', hint: 'someone waits',     frame: at(f => f.queue.length > 0) },
      { id: 'drain',  label: 'Released',  hint: 'blocks handed back', frame: at(f => f.allDone) },
    ]
      .filter(stage => stage.frame >= 0)
      .sort((a, b) => a.frame - b.frame)
      // Two stages on one frame would be two markers for one moment.
      .filter((stage, i, list) => i === 0 || stage.frame > list[i - 1].frame);
  }, [frames]);
  const { blockSize, totalBlocks } = scenario.config;

  // A stable slot per block so cells do not jump around as the pool changes.
  const slots = Array.from({ length: totalBlocks }, (_, i) => frame.pool[i] || null);
  // What changed since the previous frame. Without this the pool simply redraws and
  // the eye has nothing to follow; with it, each step has one thing that happened.
  const previous = frames[Math.max(state.frame - 1, 0)];
  const prevSlots = Array.from({ length: totalBlocks }, (_, i) => previous.pool[i] || null);
  const changeAt = i => {
    const now = slots[i], before = prevSlots[i];
    if (state.frame === 0) return '';
    if (now && !before) return 'claimed';
    if (!now && before) return 'released';
    if (now && before && now.owner !== before.owner) return 'claimed';
    if (now && before && now.tokens !== before.tokens) return 'grew';
    return '';
  };
  // Identity comes from the scenario, not the live pool: a finished request has freed its
  // blocks but still needs its colour in the lane list.
  const owners = scenario.config.requests.map(r => r.id);
  const colourOf = id => `owner-${(Math.max(owners.indexOf(id), 0) % 3) + 1}`;

  return <div className="explorer engine-animation">
    <div className="explorer-heading">
      <div><span>Engine step loop</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>

    <ScenarioNav scenarios={SCENARIOS} current={scenarioId} onSelect={setScenario} label="Scenario"/>
    <p className="scenario-explains">{scenario.explains}</p>

    <EditorialPlayback frame={cursor} dispatchFrame={dispatchFrame} play={play} dispatchPlay={dispatchPlay}
      stages={stages} label="the engine step loop" caption={frame.events.join(" ")}/>

    <div className="sim-stage" ref={stageRef}>
      <div className="sim-section">
        <div className="chart-title">
          <span>The block pool</span>
          <span>{frame.usedBlocks} OF {totalBlocks} BLOCKS · {blockSize} TOKENS EACH</span>
        </div>
        <div className="pool-grid" role="img" aria-label={`${frame.usedBlocks} of ${totalBlocks} blocks in use at step ${frame.step}.`}>
          {slots.map((block, i) => <div key={i} style={{ '--i': i }} data-change={changeAt(i)} className={`pool-block ${block ? `used ${colourOf(block.owner)}` : 'free'} ${block?.shared ? 'shared' : ''}`}>
            {block && <>
              <span className="pool-fill" style={{ height: `${(block.tokens / blockSize) * 100}%` }}/>
              <b>{block.owner}</b>
              <small>{block.tokens}/{blockSize}</small>
            </>}
            {!block && <small className="free-label">free</small>}
          </div>)}
        </div>
        <div className="pool-legend">
          {owners.map(id => <span key={id}><i className={colourOf(id)}/>request {id}</span>)}
          {scenario.config.prefixCaching && <span><i className="shared-swatch"/>reused from cache</span>}
        </div>
      </div>

      <div className="sim-section">
        <div className="chart-title"><span>The requests</span><span>PHASE AT THIS STEP</span></div>
        <div className="lane-list">
          {Object.entries(frame.requests).map(([id, r]) => {
            const total = r.promptTokens + r.outputTokens;
            return <div key={id} className={`lane phase-${r.phase}`}>
              <span className={`lane-id ${colourOf(id)}`}>{id}</span>
              <div className="lane-track">
                <span className="lane-prompt" style={{ width: `${(Math.min(r.tokens, r.promptTokens) / total) * 100}%` }}/>
                <span className="lane-output" style={{ width: `${(r.emitted / total) * 100}%` }}/>
                {r.reusedTokens > 0 && <i className="lane-reused" style={{ width: `${(r.reusedTokens / total) * 100}%` }}/>}
              </div>
              <span className="lane-phase">{PHASE_LABEL[r.phase]}</span>
              <span className="lane-count">{r.emitted}/{r.outputTokens}</span>
            </div>;
          })}
        </div>
        {frame.queue.length > 0 && <p className="lane-queue">Waiting: <b>{frame.queue.join(', ')}</b>, admitted only when enough blocks are free at once.</p>}
      </div>
    </div>

    <div className="assumptions">
      <div>
        <p>A teaching model of a step loop, not a model of vLLM's scheduler. It keeps the things chapter four is about: blocks are fixed size, a sequence rounds up to whole blocks, a new block opens exactly when the last one fills, and reuse is capped one token short and aligned down, the same arithmetic the explorer above uses.</p>
        <p>It leaves out chunked prefill, real continuous-batching policy, eviction order, and cache groups. Preemption here takes the most recently admitted request, which is a choice made for legibility rather than a claim about any engine.</p>
        <a href="#engines">The pinned source investigation <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}
