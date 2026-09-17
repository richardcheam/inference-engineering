import React, { useMemo } from 'react';
import ScrollScene from './ScrollScene';
import { buildScene } from './schedulerStates.mjs';

/**
 * The pilot scene for chapter four, section one.
 *
 * It renders frames from the same simulation the explorer in §04 runs, so the
 * narrative and the instrument cannot disagree. The scene is read-only: it
 * establishes the mental model. Probing it — other scenarios, step-by-step,
 * scrubbing — is what the explorer further down the chapter is for.
 */

const PHASE = {
  unborn: 'not yet arrived', queued: 'waiting', prefill: 'prefilling',
  decode: 'decoding', blocked: 'stalled', done: 'finished',
};

function Stage({ frame, scenario, highlight, focus }) {
  const { blockSize, totalBlocks } = scenario.config;
  const owners = scenario.config.requests.map(r => r.id);
  const colourOf = id => `owner-${(Math.max(owners.indexOf(id), 0) % 3) + 1}`;
  const slots = Array.from({ length: totalBlocks }, (_, i) => frame.pool[i] || null);

  return <div className="scheduler-stage">
    <div className={`stage-pool ${focus === 'pool' ? 'focus focus-pool' : ''}`}>
      <p className="stage-label">
        CACHE POOL
        <b>{frame.usedBlocks} of {totalBlocks} blocks</b>
      </p>
      <div className="pool-grid">
        {slots.map((block, i) => <div key={i}
          className={`pool-block ${block ? `used ${colourOf(block.owner)}` : 'free'}`}>
          <b>{block ? block.owner : ''}</b>
          <small>{block ? `${block.tokens}/${blockSize}` : ''}</small>
        </div>)}
      </div>
    </div>

    <div className={`stage-lanes ${focus === 'lanes' ? 'focus focus-lanes' : ''}`}>
      <p className="stage-label">REQUESTS</p>
      {scenario.config.requests.map(request => {
        const r = frame.requests[request.id];
        const total = request.promptTokens + request.outputTokens;
        const waiting = r.phase === 'queued';
        return <div key={request.id} className={`lane ${waiting ? 'waiting' : ''} ${highlight === request.id ? 'focus' : ''}`}>
          <span className={`lane-id ${colourOf(request.id)}`}>{request.id}</span>
          <span className="lane-track">
            <span className={`lane-fill ${colourOf(request.id)}`}
              style={{ width: `${Math.min(r.tokens / total, 1) * 100}%` }}/>
          </span>
          <span className="lane-phase">{PHASE[r.phase]}</span>
        </div>;
      })}
    </div>
  </div>;
}

export default function SchedulerScene({ figure }) {
  const { scenario, frames, states } = useMemo(() => buildScene(), []);
  // The request the scheduler acts on is the one named in this frame's events.
  const highlightFor = frame => {
    const event = frame.events.find(e => e.includes('preempted'));
    return event ? event.trim()[0] : null;
  };

  return <figure className="scene-figure">
    <figcaption className="scene-figure-head">
      <span>Three requests, one finite pool</span>
      {figure && <span className="figure-id">FIG. {figure}</span>}
    </figcaption>

    <ScrollScene
      id="scheduler-scene"
      label="How the scheduler decides which requests advance"
      states={states}
      renderStage={state => {
        const frame = frames[state.frame];
        return <Stage frame={frame} scenario={scenario} highlight={highlightFor(frame)} focus={state.focus}/>;
      }}
    />

    <p className="scene-provenance">
      Every frame above is a step of the same simulation the explorer later in this
      chapter runs, with a nine-block pool and three 24-token prompts. The block
      counts, the preemptions, and the recomputed tokens are what that model
      produces, not an illustration drawn to match the text.
    </p>
  </figure>;
}
