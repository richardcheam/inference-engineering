import React, { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import EditorialPlayback, { ScenarioNav, useEditorialPlayback } from './EditorialPlayback';
import { SCENARIOS, codeUrl, simulate } from './vllmSim.mjs';

// Each frame carries a sentence or two of narration, so it plays at a reading
// pace rather than the 900 ms the shorter figures use.
const READING_MS = 2600;

const STATUS = {
  future: ['not yet arrived', 'unborn'], waiting: ['waiting', 'queued'],
  running: ['running', 'decode'], done: ['finished', 'done'],
};

export default function VllmEngineAnimation({ figure }) {
  const [scenarioId, setScenario] = useState('return');
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  const frames = useMemo(() => simulate(scenario.config), [scenario]);
  const { frame: cursor, dispatchFrame, play, dispatchPlay, stageRef } = useEditorialPlayback(frames.length, { baseMs: READING_MS });
  const frame = frames[Math.min(cursor.frame, frames.length - 1)];
  const previous = frames[Math.max(cursor.frame - 1, 0)];
  const { blockSize, totalBlocks } = scenario.config;

  // Stages are found in the simulation, never placed by index. Scenarios differ
  // in which beats occur, and that difference is the lesson.
  const stages = useMemo(() => {
    const at = test => frames.findIndex(test);
    return [
      { id: 'fill',    label: 'Filling',  hint: 'blocks handed out',  frame: at(f => f.kind === 'admit') },
      { id: 'full',    label: 'Full',     hint: 'no block to give',   frame: at(f => f.kind === 'nospace') },
      { id: 'preempt', label: 'Preempt',  hint: 'running[-1] goes',   frame: at(f => f.kind === 'victim') },
      { id: 'evict',   label: 'Evict',    hint: 'a ghost is taken',   frame: at(f => f.kind === 'evict') },
      { id: 'hit',     label: 'Hit',      hint: 'found in the cache', frame: at(f => f.kind === 'hit') },
      { id: 'drain',   label: 'Drained',  hint: 'all finished',       frame: at(f => f.kind === 'done') },
    ]
      .filter(stage => stage.frame >= 0)
      .sort((a, b) => a.frame - b.frame)
      .filter((stage, i, list) => i === 0 || stage.frame > list[i - 1].frame);
  }, [frames]);

  const owners = scenario.config.requests.map(r => r.id);
  const colourOf = id => `owner-${(Math.max(owners.indexOf(id), 0) % 3) + 1}`;
  const stateOf = b => (b.ref > 0 ? 'used' : b.hash ? 'ghost' : 'free');

  // Only what changed since the previous frame animates.
  const changeAt = i => {
    if (cursor.frame === 0) return '';
    const now = frame.pool[i], before = previous.pool[i];
    const s = stateOf(now), t = stateOf(before);
    if (s === 'used' && (t !== 'used' || now.owner !== before.owner)) return 'claimed';
    if (s !== 'used' && t === 'used') return 'released';
    if (frame.focus.blocks.includes(i) && (frame.kind === 'hit' || now.tokens !== before.tokens)) return 'grew';
    return '';
  };

  const ghosts = frame.freeQueue.filter(id => frame.pool[id].hash);
  const queueLabel = frame.freeQueue.length === 0
    ? 'Free queue: empty.'
    : `Free queue, front first: ${frame.freeQueue.length} blocks, ${ghosts.length} still holding cached tokens.`;
  const link = codeUrl(frame.code);

  return <div className="explorer engine-animation vllm-engine">
    <div className="explorer-heading">
      <div><span>vLLM's step loop under pressure</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>

    <ScenarioNav scenarios={SCENARIOS} current={scenarioId} onSelect={setScenario} label="Scenario"/>
    <p className="scenario-explains">{scenario.explains}</p>

    <EditorialPlayback frame={cursor} dispatchFrame={dispatchFrame} play={play} dispatchPlay={dispatchPlay}
      stages={stages} label="vLLM's step loop" caption={frame.text}/>
    {link && <p className="lane-queue vllm-code">In the source: <a className="inline-link" href={link} target="_blank" rel="noreferrer">{frame.code}</a></p>}

    <div className="sim-stage" ref={stageRef}>
      <div className="sim-section">
        <div className="chart-title">
          <span>The block pool</span>
          <span>{frame.step ? `ENGINE STEP ${frame.step}` : 'BEFORE THE FIRST STEP'} · {totalBlocks} BLOCKS OF {blockSize} TOKENS</span>
        </div>
        <div className="pool-grid" role="img"
          aria-label={`${frame.pool.filter(b => b.ref > 0).length} of ${totalBlocks} blocks in use. ${queueLabel}`}>
          {frame.pool.map((b, i) => {
            const state = stateOf(b);
            return <div key={i} style={{ '--i': i }} data-change={changeAt(i)}
              className={`pool-block ${state} ${state !== 'free' ? colourOf(b.owner) : ''} ${b.ref > 1 ? 'shared' : ''}`}>
              {state !== 'free' && <span className="pool-fill" style={{ height: `${(b.tokens / blockSize) * 100}%` }}/>}
              {state !== 'free' && <b>{b.owner}</b>}
              <small>{b.hash ?? (state === 'used' ? `${b.tokens}/${blockSize}` : 'free')}</small>
            </div>;
          })}
        </div>

        <div className="vllm-free-queue" aria-label={queueLabel}>
          <p className="stage-label"><span>Reused first</span><span>Free queue</span><span>Evicted last</span></p>
          <ol>
            {frame.freeQueue.map(id => {
              const b = frame.pool[id];
              return <li key={id} className={b.hash ? `ghost ${colourOf(b.owner)}` : ''}>
                <b>{id}</b><small>{b.hash ?? 'empty'}</small>
              </li>;
            })}
            {frame.freeQueue.length === 0 && <li className="vllm-free-empty">empty</li>}
          </ol>
        </div>

        <div className="pool-legend">
          {owners.map(id => <span key={id}><i className={colourOf(id)}/>request {id}</span>)}
          <span><i className="vllm-ghost-swatch"/>free, still cached</span>
          <span><i className="vllm-shared-swatch"/>shared by two requests</span>
        </div>
      </div>

      <div className="sim-section">
        <div className="chart-title"><span>The requests</span><span>KV COMPUTED · FROM CACHE HATCHED</span></div>
        <div className="lane-list">
          {Object.entries(frame.requests).map(([id, r]) => {
            const total = r.promptTokens + r.outputTokens;
            const [label, phase] = STATUS[r.status];
            return <div key={id} className={`lane phase-${phase} ${frame.focus.request === id ? 'focus' : ''}`}>
              <span className={`lane-id ${colourOf(id)}`}>{id}</span>
              <div className="lane-track">
                <span className="lane-prompt" style={{ width: `${(Math.min(r.computed, r.promptTokens) / total) * 100}%` }}/>
                <span className="lane-output" style={{ width: `${(Math.max(r.computed - r.promptTokens, 0) / total) * 100}%` }}/>
                {r.fromCache > 0 && r.computed > 0 && <i className="lane-reused" style={{ width: `${(r.fromCache / total) * 100}%` }}/>}
              </div>
              <span className="lane-phase">{r.status === 'waiting' && r.preemptions ? 'preempted' : label}</span>
              <span className="lane-count">{r.generated}/{r.outputTokens}</span>
            </div>;
          })}
        </div>
        <p className="lane-queue">
          Running, oldest first: <b>{frame.running.join(', ') || 'none'}</b>. Waiting, front first: <b>{frame.waiting.join(', ') || 'none'}</b>.
        </p>
      </div>
    </div>

    <div className="assumptions">
      <div>
        <p>A teaching model of one engine, labelled Conceptual. Every frame comes from <code>simulate()</code> in <code>vllmSim.mjs</code>, which is tested against the rules it claims. It follows vLLM at commit 05d8963 for the free queue order, lazy eviction, prefix hits and their one-token cap, the full-sequence admission check, the choice of victim, where the victim is requeued, and holding admissions in a step that preempted.</p>
        <p>It leaves out chunked prefill, speculative decoding, the watermark, async scheduling and multiple cache groups. The pool is eight or twelve blocks so every block fits on screen; nothing here was measured.</p>
        <a href="#engines">The pinned source investigation <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}
