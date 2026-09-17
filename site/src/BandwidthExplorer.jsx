import React, { useState } from 'react';
import { ArrowUpRight, RotateCcw, AlertTriangle, Receipt, TrendingUp } from 'lucide-react';
import Tabs from './Tabs';
import records from '../../experiments/001-feasibility/calculations.json';
import { modelMeta } from './memory.mjs';
import { amortizationCurve, decodeStepBound, efficiencyPresets, platforms } from './bandwidth.mjs';

const BATCHES = [1, 2, 4, 8, 16, 32, 64];
const GB = bytes => bytes / 1e9;
const gb = bytes => GB(bytes).toFixed(GB(bytes) < 10 ? 2 : 1);
const ms = seconds => (seconds * 1000).toFixed(seconds < 0.1 ? 1 : 0);
const rate = value => (value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(1));

export default function BandwidthExplorer({ figure }) {
  const [model, setModel] = useState('mistral-medium-3.5');
  const [platform, setPlatform] = useState('b200-sxm');
  const [context, setContext] = useState(8192);
  const [batch, setBatch] = useState(8);
  const [efficiency, setEfficiency] = useState(0.7);
  const settings = { model, platform, context, batch, efficiency };
  const step = decodeStepBound(settings, records);
  const device = platforms[platform];
  const curve = amortizationCurve(settings, records, BATCHES);
  const reset = () => { setModel('mistral-medium-3.5'); setPlatform('b200-sxm'); setContext(8192); setBatch(8); setEfficiency(0.7); };

  const ledger = [
    { kind: 'ledger-weights', name: 'Model weights, read once', detail: modelMeta[model].name, bytes: step.weightBytes },
    { kind: 'ledger-cache', name: 'Live cache, read once per sequence', detail: `${batch} × ${context.toLocaleString()} tokens`, bytes: step.cacheBytes },
  ];
  const widest = Math.max(step.weightBytes, step.cacheBytes);

  return <div className="explorer rate-explorer">
    <div className="explorer-heading">
      <div><span>Decode step explorer</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label>Model checkpoint
        <select aria-label="Model checkpoint" value={model} onChange={e => setModel(e.target.value)}>
          {Object.entries(modelMeta).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}
        </select>
      </label>
      <label>Device
        <select aria-label="Device" value={platform} onChange={e => setPlatform(e.target.value)}>
          {Object.entries(platforms).map(([id, p]) => <option key={id} value={id}>{p.name} · {GB(p.bandwidthBytesPerSecond) / 1000} TB/s</option>)}
        </select>
      </label>
      <label className="range-label">
        <span>Live context <output>{context / 1024}K <small>tokens / sequence</small></output></span>
        <input aria-label="Live context" type="range" min="1024" max="131072" step="1024" value={context} onChange={e => setContext(Number(e.target.value))}/>
        <span className="range-ticks"><small>1K</small><small>128K</small></span>
      </label>
      <label className="range-label">
        <span>Concurrent sequences <output>{batch}</output></span>
        <input aria-label="Concurrent sequences" type="range" min="1" max="64" step="1" value={batch} onChange={e => setBatch(Number(e.target.value))}/>
        <span className="range-ticks"><small>1 sequence</small><small>64 sequences</small></span>
      </label>
    </div>

    <div className="bound-headline">
    {step.fitsCapacity
      ? <div className="bound-row">
          <div><span className="eyebrow">STEP TIME</span><strong>≥ {ms(step.stepSeconds)} <small>ms</small></strong></div>
          <div><span className="eyebrow">AGGREGATE</span><strong data-testid="rate-total">≤ {rate(step.tokensPerSecond)} <small>tok/s</small></strong></div>
          <div><span className="eyebrow">PER SEQUENCE</span><strong>≤ {rate(step.tokensPerSecondPerSequence)} <small>tok/s</small></strong></div>
        </div>
      : <div className="bound-row unplaceable">
          <AlertTriangle size={17}/>
          <p><b>No rate for this one.</b> Weights and cache come to {gb(step.residentBytes)} GB, past the {gb(device.capacityBytes)} GB this device advertises. Chapter one’s question comes first: it has to be placed before it can be timed.</p>
        </div>}
    </div>

    <Tabs label="Decode step views" tabs={[
      { id: 'traffic', label: 'Traffic per step', Icon: Receipt, render: () => <Ledger step={step} ledger={ledger} widest={widest} batch={batch}/> },
      { id: 'batching', label: 'Batching curve', Icon: TrendingUp, render: () => <AmortizationChart curve={curve} batch={batch} onPick={setBatch}/> },
    ]}/>

    <div className="explorer-foot">
      <label>Achieved bandwidth <select aria-label="Achieved fraction of peak bandwidth" value={efficiency} onChange={e => setEfficiency(Number(e.target.value))}>
        {efficiencyPresets.map(n => <option key={n} value={n}>{Math.round(n * 100)}% of peak</option>)}
      </select></label>
      <button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button>
    </div>
    <div className="assumptions">
      <div>
        <p>{step.readScope}</p>
        <p>A lower bound from local memory traffic only. Compute, collectives, kernel launches, and imperfect overlap all add time, so a measured step can only be slower. The achieved fraction of peak is your assumption, not a specification. Bytes are shown in decimal GB to match the vendor bandwidth units. Peak bandwidth is advertised, not sustained.</p>
        <a href="#hardware-reference">See the pinned device table <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}

function Ledger({ step, ledger, widest, batch }) {
  return <div className="ledger" aria-live="polite" aria-atomic="true">
    <span className="eyebrow">EVERY DECODE STEP MOVES</span>
    {ledger.map(row => <div className={`ledger-row ${row.kind}`} key={row.kind}>
      <div><b>{row.name}</b><small>{row.detail}</small></div>
      <div className="ledger-bar"><span style={{ width: `${100 * row.bytes / widest}%` }}/></div>
      <span className="ledger-bytes">{gb(row.bytes)} <small>GB</small></span>
    </div>)}
    <div className="ledger-row total">
      <div><b>Traffic per step</b><small>{Math.round(step.weightShare * 100)}% of it is the weight read</small></div>
      <span className="ledger-bytes">{gb(step.bytesPerStep)} <small>GB</small></span>
    </div>
    <div className="ledger-row divide">
      <div><b>÷ {batch} {batch === 1 ? 'token emitted' : 'tokens emitted'}</b><small>the weight read is shared; the cache read is not</small></div>
      <span className="ledger-bytes">{gb(step.bytesPerToken)} <small>GB / token</small></span>
    </div>
  </div>;
}

const TOP = 18, BOTTOM = 128, LEFT = 46, RIGHT = 494;

function AmortizationChart({ curve, batch, onPick }) {
  // Rates here span two orders of magnitude, so the axis is log. Nothing is clipped:
  // the domain always covers every point, placeable or not.
  const values = curve.flatMap(p => [p.tokensPerSecond, p.tokensPerSecondPerSequence]);
  const low = Math.log10(Math.min(...values) / 1.6);
  const high = Math.log10(Math.max(...values) * 1.3);
  const x = i => LEFT + i * ((RIGHT - LEFT) / (curve.length - 1));
  const y = value => BOTTOM - ((Math.log10(value) - low) / (high - low)) * (BOTTOM - TOP);
  const path = (key, points) => points.map(({ p, i }, n) => `${n ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const indexed = curve.map((p, i) => ({ p, i }));
  const wall = indexed.findIndex(({ p }) => !p.fitsCapacity);
  const solid = wall === -1 ? indexed : indexed.slice(0, wall);
  const faded = wall === -1 ? [] : indexed.slice(Math.max(wall - 1, 0));
  const decades = [];
  for (let e = Math.ceil(low); e <= Math.floor(high); e++) decades.push(10 ** e);

  // Nothing can be placed, so there is no rate to plot. Say that instead of drawing one.
  if (wall === 0) return <div className="amortization">
    <div className="chart-title">
      <span>No batch size to compare.</span>
      <span>TOKENS / SECOND · LOG SCALE · UPPER BOUNDS</span>
    </div>
    <p className="chart-empty">This model does not fit this device even with a single sequence, so there is nothing here to time. Choose a larger device, or a smaller checkpoint, and the curve comes back.</p>
  </div>;

  return <div className="amortization">
    <div className="chart-title">
      <span>Batching buys throughput by spending per-sequence speed.</span>
      <span>TOKENS / SECOND · LOG SCALE · UPPER BOUNDS</span>
    </div>
    <svg viewBox="0 0 500 158" className="fan-chart" role="img" aria-label={`Upper-bound tokens per second against batch size, log scale. Together, the sequences go from ${rate(curve[0].tokensPerSecond)} to ${rate(curve[curve.length-1].tokensPerSecond)} tokens per second, while each one drops from ${rate(curve[0].tokensPerSecondPerSequence)} to ${rate(curve[curve.length-1].tokensPerSecondPerSequence)}.`}>
      {decades.map(d => <g key={d}>
        <line className="grid" x1={LEFT} y1={y(d)} x2={RIGHT} y2={y(d)}/>
        <text className="fan-tick" x={LEFT - 6} y={y(d) + 2.5} textAnchor="end">{d.toLocaleString()}</text>
      </g>)}
      {wall !== -1 && <g>
        <rect className="wall" x={x(wall) - 4} y={TOP - 6} width={RIGHT - x(wall) + 10} height={BOTTOM - TOP + 6}/>
        <text className="wall-label" x={x(wall) + 2} y={TOP - 1}>past this device’s capacity</text>
      </g>}
      <line className="axis" x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM}/>
      {faded.length > 1 && <>
        <path className="fan-line aggregate faded" d={path('tokensPerSecond', faded)}/>
        <path className="fan-line per-sequence faded" d={path('tokensPerSecondPerSequence', faded)}/>
      </>}
      <path className="fan-line aggregate" d={path('tokensPerSecond', solid)}/>
      <path className="fan-line per-sequence" d={path('tokensPerSecondPerSequence', solid)}/>
      {curve.map((p, i) => <g key={p.batch}>
        <circle className={`fan-dot ${p.batch === batch ? 'current' : ''} ${p.fitsCapacity ? '' : 'unplaceable'}`} cx={x(i)} cy={y(p.tokensPerSecond)} r={p.batch === batch ? 4.5 : 2.6}/>
        <circle className={`fan-dot per-sequence ${p.batch === batch ? 'current' : ''} ${p.fitsCapacity ? '' : 'unplaceable'}`} cx={x(i)} cy={y(p.tokensPerSecondPerSequence)} r={p.batch === batch ? 4.5 : 2.6}/>
        <text className={`fan-tick ${p.batch === batch ? 'current' : ''}`} x={x(i)} y="148">{p.batch}</text>
      </g>)}
      <text className="fan-axis-label" x={LEFT - 6} y="10" textAnchor="end">tok/s</text>
    </svg>
    <div className="fan-legend">
      <span><i className="aggregate"/>All sequences together</span>
      <span><i className="per-sequence"/>What one user sees</span>
      <span className="fan-hint">sequences in flight →</span>
    </div>
    <div className="fan-picker" role="group" aria-label="Choose a batch size">
      {curve.map(p => <button key={p.batch} className={`${p.batch === batch ? 'active' : ''} ${p.fitsCapacity ? '' : 'unplaceable'}`} onClick={() => onPick(p.batch)} aria-pressed={p.batch === batch}>{p.batch}</button>)}
    </div>
  </div>;
}
