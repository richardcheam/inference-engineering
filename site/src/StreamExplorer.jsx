import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Activity, RotateCcw, Target } from 'lucide-react';
import Tabs from './Tabs';
import { goodput, percentile, requestMetrics } from './metrics.mjs';
import EditorialPlayback, { useEditorialPlayback } from './EditorialPlayback';
import { streamFrames, streamStages } from './streamPlayback.mjs';

const ms = v => (v === null ? 'n/a' : `${Math.round(v)}`);

/** A synthetic stream: steady decode with one stall dropped into it. */
function buildStream({ ttft, itl, tokens, stallAt, stallMs }) {
  const times = [];
  let t = ttft;
  for (let i = 0; i < tokens; i++) {
    if (i > 0) t += itl + (i === stallAt ? stallMs : 0);
    times.push(t);
  }
  return { sentAt: 0, tokenTimes: times };
}

export default function StreamExplorer({ figure }) {
  const [itl, setItl] = useState(40);
  const [stallMs, setStall] = useState(600);
  const ttft = 220, tokens = 24, stallAt = 12;
  const stream = useMemo(() => buildStream({ ttft, itl, tokens, stallAt, stallMs }), [itl, stallMs]);
  const finalMetrics = requestMetrics(stream);

  // §27 The stream arrives rather than appearing finished, so the moment the
  // average is poisoned is something the reader watches rather than reads about.
  const frames = useMemo(() => streamFrames(stream), [stream]);
  const stages = useMemo(() => streamStages(frames), [frames]);
  const { frame: cursor, dispatchFrame, play, dispatchPlay, stageRef } = useEditorialPlayback(frames.length);
  const current = frames[Math.min(cursor.frame, frames.length - 1)];
  // Before the first token there are no metrics; the readout waits with the stream.
  const m = current.metrics ?? { ttft: null, tpot: null, maxInterTokenLatency: null, interTokenLatencies: [] };

  const reset = () => { setItl(40); setStall(600); };
  const steadyTpot = itl;
  const hidden = finalMetrics.tpot - steadyTpot;

  return <div className="explorer stream-explorer">
    <div className="explorer-heading">
      <div><span>Token stream explorer</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label className="range-label">
        <span>Steady gap between tokens <output>{itl} <small>ms</small></output></span>
        <input aria-label="Steady inter-token latency" type="range" min="10" max="120" step="1" value={itl} onChange={e => setItl(Number(e.target.value))}/>
        <span className="range-ticks"><small>10 ms</small><small>120 ms</small></span>
      </label>
      <label className="range-label">
        <span>One stall, mid-stream <output>{stallMs} <small>ms</small></output></span>
        <input aria-label="Stall length" type="range" min="0" max="2000" step="10" value={stallMs} onChange={e => setStall(Number(e.target.value))}/>
        <span className="range-ticks"><small>none</small><small>2,000 ms</small></span>
      </label>
    </div>

    <div className="bound-headline">
      <div className="bound-row">
        <div><span className="eyebrow">TTFT</span><strong>{ms(m.ttft)} <small>ms</small></strong></div>
        <div><span className="eyebrow">TPOT</span><strong data-testid="tpot">{ms(m.tpot)} <small>ms</small></strong></div>
        <div><span className="eyebrow">WORST GAP</span><strong className={current.metrics && m.maxInterTokenLatency > steadyTpot * 1.5 ? 'alarming' : ''}>{ms(m.maxInterTokenLatency)} <small>ms</small></strong></div>
      </div>
    </div>

    <EditorialPlayback frame={cursor} dispatchFrame={dispatchFrame} play={play} dispatchPlay={dispatchPlay}
      stages={stages} label="the token stream" caption={current.caption}/>

    <Tabs label="Measurement views" tabs={[
      { id: 'stream', label: 'The stream', Icon: Activity, render: () => <StreamStrip m={m} itl={itl} stallMs={stallMs} hidden={hidden} stallAt={stallAt} arrived={current.arrived} stageRef={stageRef} finalMetrics={finalMetrics}/> },
      { id: 'goodput', label: 'Goodput', Icon: Target, render: () => <GoodputPanel/> },
    ]}/>

    <div className="explorer-foot">
      <label>Stream <span className="foot-note">{tokens} tokens, one stall at token {stallAt + 1}</span></label>
      <button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button>
    </div>
    <div className="assumptions">
      <div>
        <p>Synthetic timestamps, not a measurement. They exist to show what each definition does with the same stream.</p>
        <p>Real clients see arrival times at their own boundary. Network chunks carrying several tokens at once make individual gaps unobservable, which is exactly when a stall hides best.</p>
        <a href="#benchmarking">Read the benchmark protocol <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}

function StreamStrip({ m, itl, stallMs, hidden, stallAt, arrived, stageRef, finalMetrics }) {
  const gaps = m.interTokenLatencies;
  // The scale is the finished stream's, so bars do not rescale as they arrive.
  const worst = Math.max(...finalMetrics.interTokenLatencies, 1);
  return <div className="stream-strip-wrap" ref={stageRef}>
    <div className="chart-title">
      <span>Every gap between output tokens.</span>
      <span>ONE BAR = ONE GAP</span>
    </div>
    <div className="stream-strip" role="img" aria-label={`Token gaps, steady at ${itl} milliseconds with one of ${Math.round(worst)} milliseconds.`}>
      {gaps.map((g, i) => <i key={i} className={i === stallAt - 1 && stallMs > 0 ? 'stall' : ''} style={{ height: `${Math.max(6, (g / worst) * 100)}%` }}/>)}
    </div>
    <p>
      {stallMs > 0 && arrived > stallAt
        ? <>TPOT reports <b>{ms(m.tpot)} ms</b>. The stream was actually steady at {itl} ms with one gap of <b>{ms(m.maxInterTokenLatency)} ms</b>. The average absorbed the stall and reported an extra <b>{hidden.toFixed(1)} ms</b> spread evenly across every token: a shape that never happened.</>
                : <>With no stall, TPOT and every individual gap agree. Averages only mislead once the distribution has structure.</>}
    </p>
  </div>;
}

/** A fixed population, so the joint-limit point is exact rather than illustrative. */
const POPULATION = [
  { sentAt: 0, tokenTimes: [120, 160, 200, 240] },
  { sentAt: 0, tokenTimes: [180, 230, 280, 330] },
  { sentAt: 0, tokenTimes: [140, 340, 540, 740] },
  { sentAt: 0, tokenTimes: [460, 500, 540, 580] },
  { sentAt: 0, tokenTimes: [200, 250, 300, 350] },
  { sentAt: 0, tokenTimes: [520, 900, 1280, 1660] },
];

function GoodputPanel() {
  const [ttftLimit, setTtft] = useState(300);
  const [tpotLimit, setTpot] = useState(80);
  const r = goodput(POPULATION, { ttft: ttftLimit, tpot: tpotLimit }, 2000);
  const ttfts = POPULATION.map(p => requestMetrics(p).ttft);
  return <div className="goodput-panel">
    <div className="chart-title"><span>Six requests, two limits.</span><span>JOINT SATISFACTION</span></div>
    <div className="goodput-controls">
      <label className="range-label">
        <span>TTFT limit <output>{ttftLimit} <small>ms</small></output></span>
        <input aria-label="TTFT limit" type="range" min="100" max="600" step="10" value={ttftLimit} onChange={e => setTtft(Number(e.target.value))}/>
      </label>
      <label className="range-label">
        <span>TPOT limit <output>{tpotLimit} <small>ms</small></output></span>
        <input aria-label="TPOT limit" type="range" min="30" max="400" step="5" value={tpotLimit} onChange={e => setTpot(Number(e.target.value))}/>
      </label>
    </div>
    <div className="goodput-rows">
      {POPULATION.map((req, i) => {
        const m = requestMetrics(req);
        const okTtft = m.ttft <= ttftLimit;
        const okTpot = m.tpot <= tpotLimit;
        return <div key={i} className={`goodput-row ${okTtft && okTpot ? 'good' : ''}`}>
          <span className="goodput-index">{String(i + 1).padStart(2, '0')}</span>
          <span className={okTtft ? 'ok' : 'bad'}>TTFT {ms(m.ttft)}</span>
          <span className={okTpot ? 'ok' : 'bad'}>TPOT {ms(m.tpot)}</span>
          <span className="goodput-verdict">{okTtft && okTpot ? 'counts' : 'does not count'}</span>
        </div>;
      })}
    </div>
    <div className="goodput-summary">
      <div><span className="eyebrow">MEETS TTFT</span><strong>{r.byLimit.ttft} / {r.total}</strong></div>
      <div><span className="eyebrow">MEETS TPOT</span><strong>{r.byLimit.tpot} / {r.total}</strong></div>
      <div><span className="eyebrow">MEETS BOTH</span><strong className="joint">{r.satisfied} / {r.total}</strong></div>
      <div><span className="eyebrow">P90 TTFT</span><strong>{percentile(ttfts, 90)} <small>ms</small></strong></div>
    </div>
    <p>Each limit passes on its own more often than the two pass together. Goodput is the joint count, and it is the only one of these numbers that describes requests a user was actually served well.</p>
  </div>;
}
