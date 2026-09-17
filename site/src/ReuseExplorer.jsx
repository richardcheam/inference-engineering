import React, { useState } from 'react';
import { ArrowUpRight, Boxes, RotateCcw, TrendingDown } from 'lucide-react';
import records from '../../experiments/001-feasibility/calculations.json';
import Tabs from './Tabs';
import { distinctExperts, expertTraffic, moeLayers, reuseCurve, routing } from './routing.mjs';

const TOKENS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
const GB = bytes => bytes / 1e9;
const gb = bytes => GB(bytes).toFixed(GB(bytes) < 10 ? 2 : 1);
// Reuse approaches every expert but never quite reaches it, so never round it up to certainty.
const pct = value => (value >= 0.995 ? '>99%' : `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`);
const experts = value => value.toFixed(1);

export default function ReuseExplorer({ figure }) {
  const [model, setModel] = useState('glm-5.3');
  const [tokens, setTokens] = useState(1);
  const spec = routing[model];
  const bytesPerParam = spec.bytesPerParam;
  const step = expertTraffic({ model, tokens, bytesPerParam });
  const curve = reuseCurve({ model, bytesPerParam }, TOKENS);
  const reset = () => { setModel('glm-5.3'); setTokens(1); };

  return <div className="explorer reuse-explorer">
    <div className="explorer-heading">
      <div><span>Expert reuse explorer</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label>Sparse checkpoint
        <select aria-label="Sparse checkpoint" value={model} onChange={e => setModel(e.target.value)}>
          {Object.entries(routing).map(([id, s]) => <option key={id} value={id}>{s.name} · {s.expertsPerToken} of {s.experts}</option>)}
        </select>
      </label>
      <label className="range-label">
        <span>Tokens in the step <output>{tokens}</output></span>
        <input aria-label="Tokens in the step" type="range" min="1" max="256" step="1" value={tokens} onChange={e => setTokens(Number(e.target.value))}/>
        <span className="range-ticks"><small>1 token</small><small>256 tokens</small></span>
      </label>
    </div>

    <div className="bound-headline">
      <div className="bound-row">
        <div><span className="eyebrow">EXPERTS TOUCHED</span><strong data-testid="experts-touched">{experts(step.distinct)} <small>of {spec.experts}</small></strong></div>
        <div><span className="eyebrow">EXPERT WEIGHTS READ</span><strong>{pct(step.fraction)} <small>of them</small></strong></div>
        <div><span className="eyebrow">PER EMITTED TOKEN</span><strong>{gb(step.bytesPerToken)} <small>GB</small></strong></div>
      </div>
    </div>

    <Tabs label="Expert reuse views" tabs={[
      { id: 'grid', label: 'Which experts', Icon: Boxes, render: () => <ExpertGrid spec={spec} step={step} tokens={tokens}/> },
      { id: 'curve', label: 'Cost per token', Icon: TrendingDown, render: () => <ReuseCurve curve={curve} tokens={tokens} onPick={setTokens} spec={spec}/> },
    ]}/>

    <div className="explorer-foot">
      <label>Stored as <span className="foot-note">{spec.storedAs}{spec.precisionAssumed ? ' · assumed' : ''}</span></label>
      <button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button>
    </div>
    <div className="assumptions">
      <div>
        <p>Routing is modelled as uniform and independent across tokens. Real routing is neither: load balancing, a shared expert on every token, and similar prompts all move this number, usually downward.</p>
        <p>
          Expert parameters are exact from the pinned config ({spec.experts} experts × 3 × {spec.hidden.toLocaleString()} × {spec.moeIntermediate.toLocaleString()} across {moeLayers(model)} layers).
          {spec.precisionAssumed
            ? ' Bytes assume this checkpoint stores its experts at half a byte per parameter, which we have not verified tensor by tensor.'
            : ` At ${bytesPerParam} byte${bytesPerParam === 1 ? '' : 's'} per parameter that is ${gb(step.allExpertBytes)} GB, against a pinned checkpoint of ${gb(records.weights[model].bytes)} GB. The rest is attention, shared experts, embeddings, and any dense layers.`}
          {' '}This counts expert weights only, not attention or cache traffic.
        </p>
        <a href="#sources">See the pinned configurations <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}

/** Every expert as a cell, so saturation is something you see rather than read. */
function ExpertGrid({ spec, step, tokens }) {
  const lit = Math.floor(step.distinct);
  return <div className="expert-grid-wrap">
    <div className="chart-title">
      <span>{tokens === 1 ? 'One token lights up its top-k.' : `${tokens} tokens together light up ${experts(step.distinct)} of ${spec.experts}.`}</span>
      <span>EXPECTED · ONE MoE LAYER</span>
    </div>
    <div className="expert-grid" role="img" aria-label={`${lit} of ${spec.experts} experts expected to be touched by ${tokens} tokens.`}>
      {Array.from({ length: spec.experts }, (_, i) => <i key={i} style={{ '--i': i }} className={i < lit ? 'lit' : ''}/>)}
    </div>
    <p>
      Each square is one expert in a single layer. Sliding the batch up does not add new work per token; it finds the experts you were going to read anyway.
      {step.fraction > 0.9 && ' Past this point the checkpoint is behaving like a dense one.'}
    </p>
  </div>;
}

const TOP = 16, BOTTOM = 118, LEFT = 50, RIGHT = 492;

function ReuseCurve({ curve, tokens, onPick, spec }) {
  // Plot in GB, because that is what the axis is labelled in.
  const values = curve.map(p => GB(p.bytesPerToken));
  const low = Math.log10(Math.min(...values) / 1.5);
  const high = Math.log10(Math.max(...values) * 1.4);
  const x = i => LEFT + i * ((RIGHT - LEFT) / (curve.length - 1));
  const y = v => BOTTOM - ((Math.log10(v) - low) / (high - low)) * (BOTTOM - TOP);
  const line = curve.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(GB(p.bytesPerToken)).toFixed(1)}`).join(' ');
  const decades = [];
  for (let e = Math.ceil(low); e <= Math.floor(high); e++) decades.push(10 ** e);

  return <div className="amortization">
    <div className="chart-title">
      <span>Expert bytes per emitted token.</span>
      <span>GB / TOKEN · LOG SCALE</span>
    </div>
    <svg viewBox="0 0 500 146" className="fan-chart" role="img" aria-label={`Expert bytes per emitted token falls from ${gb(curve[0].bytesPerToken)} GB at one token to ${gb(curve[curve.length-1].bytesPerToken)} GB at ${curve[curve.length-1].tokens} tokens.`}>
      {decades.map(d => <g key={d}>
        <line className="grid" x1={LEFT} y1={y(d)} x2={RIGHT} y2={y(d)}/>
        <text className="fan-tick" x={LEFT - 6} y={y(d) + 2.5} textAnchor="end">{d >= 1 ? d : d.toFixed(2)}</text>
      </g>)}
      <line className="axis" x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM}/>
      <path className="fan-line aggregate" d={line}/>
      {curve.map((p, i) => <g key={p.tokens}>
        <circle className={`fan-dot ${p.tokens === tokens ? 'current' : ''}`} cx={x(i)} cy={y(GB(p.bytesPerToken))} r={p.tokens === tokens ? 4.5 : 2.6}/>
        <text className={`fan-tick ${p.tokens === tokens ? 'current' : ''}`} x={x(i)} y="138">{p.tokens}</text>
      </g>)}
      <text className="fan-axis-label" x={LEFT - 6} y="9" textAnchor="end">GB/tok</text>
    </svg>
    <div className="fan-legend">
      <span><i className="aggregate"/>{spec.name}</span>
      <span className="fan-hint">tokens in the step →</span>
    </div>
    <div className="fan-picker" role="group" aria-label="Choose a token count">
      {curve.map(p => <button key={p.tokens} className={p.tokens === tokens ? 'active' : ''} onClick={() => onPick(p.tokens)} aria-pressed={p.tokens === tokens}>{p.tokens}</button>)}
    </div>
  </div>;
}

/** A standing comparison of how sparse each checkpoint is on a single token. */
export function SparsityComparison() {
  const rows = Object.entries(routing).map(([id, spec]) => ({
    id, spec,
    one: distinctExperts({ model: id, tokens: 1 }) / spec.experts,
    sixtyFour: distinctExperts({ model: id, tokens: 64 }) / spec.experts,
  }));
  return <div className="weight-comparison sparsity">
    <div className="chart-title"><span>One token is sparse. Sixty-four are not.</span><span>SHARE OF EXPERTS TOUCHED</span></div>
    {rows.map(({ id, spec, one, sixtyFour }) => <div key={id} className="weight-row sparsity-row">
      <div><b>{spec.name}</b><small>{spec.expertsPerToken} of {spec.experts} per token</small></div>
      <div className="weight-track">
        <span className="sparse-64" style={{ width: `${sixtyFour * 100}%` }}/>
        <span className="sparse-1" style={{ width: `${one * 100}%` }}/>
      </div>
      <span>{pct(one)} → {pct(sixtyFour)}</span>
    </div>)}
    <p>Expected share of each layer’s experts read, at one token and at sixty-four. <a href="#sources">Pinned configurations ↗</a></p>
  </div>;
}
