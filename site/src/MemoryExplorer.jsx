import React, { useState } from 'react';
import { ArrowUpRight, RotateCcw, Check, AlertTriangle, Layers3, PieChart } from 'lucide-react';
import Tabs from './Tabs';
import records from '../../experiments/001-feasibility/calculations.json';
import { calculateBudget, modelMeta } from './memory.mjs';

const capacities = [
  { value: 160, label: 'Teaching device · 160 GiB' },
  { value: 80e9 / 2 ** 30, label: 'H100 SXM · 80 GB' },
  { value: 141e9 / 2 ** 30, label: 'H200 SXM · 141 GB' },
  { value: 180e9 / 2 ** 30, label: 'B200 SXM · 180 GB' },
  { value: 192e9 / 2 ** 30, label: 'MI300X · 192 GB' },
  { value: 288e9 / 2 ** 30, label: 'Dual GH200 · 288 GB total' },
  { value: 1128e9 / 2 ** 30, label: '8 × H200 · 1,128 GB total' },
];

export default function MemoryExplorer({ figure }) {
  const [model, setModel] = useState('mistral-medium-3.5');
  const [capacityGiB, setCapacity] = useState(160);
  const [context, setContext] = useState(32768);
  const [concurrency, setConcurrency] = useState(2);
  const [overheadGiB, setOverhead] = useState(12);
  const result = calculateBudget({ model, context, concurrency, capacityGiB, overheadGiB }, records);
  const scale = Math.max(capacityGiB, result.totalGiB) * 1.025;
  const segments = [{ name: 'Model weights', value: result.weightGiB, kind: 'weight' }, { name: result.partial ? 'Counted cache' : 'KV cache', value: result.cacheGiB, kind: 'cache' }, { name: 'Runtime reserve', value: overheadGiB, kind: 'overhead' }];
  const exceeds = result.verdict === 'exceeds';
  const reset = () => { setModel('mistral-medium-3.5'); setCapacity(160); setContext(32768); setConcurrency(2); setOverhead(12); };
  return <div className="explorer">
    <div className="explorer-heading"><div><span>Memory budget explorer</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}</div>
    <div className="explorer-controls">
      <label>Model checkpoint<select aria-label="Model checkpoint" value={model} onChange={e => setModel(e.target.value)}>{Object.entries(modelMeta).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}</select></label>
      <label>Memory budget<select aria-label="Memory budget" value={capacityGiB} onChange={e => setCapacity(Number(e.target.value))}>{capacities.map(c => <option key={c.label} value={c.value}>{c.label}</option>)}</select></label>
      <label className="range-label"><span>Live context <output>{context / 1024}K <small>tokens / sequence</small></output></span><input aria-label="Live context" type="range" min="1024" max="131072" step="1024" value={context} onChange={e => setContext(Number(e.target.value))}/><span className="range-ticks"><small>1K</small><small>128K</small></span></label>
      <label className="range-label"><span>Concurrent sequences <output>{concurrency}</output></span><input aria-label="Concurrent sequences" type="range" min="1" max="16" step="1" value={concurrency} onChange={e => setConcurrency(Number(e.target.value))}/><span className="range-ticks"><small>1 sequence</small><small>16 sequences</small></span></label>
    </div>
    <Tabs label="Memory budget views" tabs={[
      { id: 'breakdown', label: 'This model', Icon: PieChart, render: () => <Breakdown result={result} segments={segments} scale={scale} capacityGiB={capacityGiB} exceeds={exceeds} overheadGiB={overheadGiB}/> },
      { id: 'all-models', label: 'All four models', Icon: Layers3, render: () => <AllModels context={context} concurrency={concurrency} capacityGiB={capacityGiB} overheadGiB={overheadGiB} current={model} onPick={setModel}/> },
    ]}/>
    <div className="explorer-foot"><label>Runtime reserve <select aria-label="Runtime reserve" value={overheadGiB} onChange={e => setOverhead(Number(e.target.value))}>{[4,8,12,16,24,32].map(n => <option key={n} value={n}>{n} GiB</option>)}</select></label><button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button></div>
    <div className="assumptions"><div><p>{result.scope}</p><p>Stored weights are assumed resident; the reserve is a teaching assumption. Device presets use decimal advertised capacities. Multiple devices show an aggregate screen, not verified per-device placement. This does not predict latency or confirm engine support.</p><a href="#models~3-derive-cache-requirements-explicitly">See the calculation and its limits <ArrowUpRight size={12}/></a></div></div>
  </div>;
}

function Breakdown({ result, segments, scale, capacityGiB, exceeds, overheadGiB }) {
  return <div className="budget-display" aria-live="polite" aria-atomic="true">
      <div className="budget-value"><div><span className="eyebrow">ESTIMATED MEMORY</span><div><strong data-testid="budget-total">{result.totalGiB.toFixed(2)}</strong><span> / {capacityGiB.toFixed(capacityGiB === 160 ? 0 : 1)} GiB</span></div></div><span className={`verdict ${exceeds ? 'over' : ''}`}>{exceeds ? <AlertTriangle size={14}/> : <Check size={14}/>} {exceeds ? 'Exceeds budget' : result.partial ? 'Partial budget only' : 'Capacity candidate'}</span></div>
      <div className="budget-meter" role="img" aria-label={`Weights ${result.weightGiB.toFixed(2)}, counted cache ${result.cacheGiB.toFixed(2)}, reserve ${overheadGiB} GiB; budget ${capacityGiB.toFixed(2)} GiB`}>
        {segments.map(s => <div key={s.kind} className={`meter-segment ${s.kind}`} style={{ width: `${100 * s.value / scale}%` }} />)}
        <div className="capacity-marker" style={{ left: `${100 * capacityGiB / scale}%` }} />
      </div>
      <div className="budget-legend">{segments.map(s => <div key={s.kind}><span><i className={s.kind}/>{s.name}</span><strong>{s.value.toFixed(2)} <small>GiB</small></strong></div>)}</div>
      <p className={`budget-explanation ${exceeds ? 'over' : ''}`}>{exceeds ? <>The counted memory is <b>{(-result.remainingGiB).toFixed(2)} GiB over</b> this budget. Shorter contexts reduce cache; model weights stay fixed.</> : <>There is <b>{result.remainingGiB.toFixed(2)} GiB left</b> in this estimate. {result.partial ? 'Additional model state is still uncounted.' : 'Longer contexts or more sequences can use up that margin.'}</>}</p>
    </div>
}

function AllModels({ context, concurrency, capacityGiB, overheadGiB, current, onPick }) {
  const rows = Object.keys(modelMeta).map(id => {
    try { return { id, ...calculateBudget({ model: id, context, concurrency, capacityGiB, overheadGiB }, records) }; }
    catch { return null; }
  }).filter(Boolean).sort((a, b) => a.totalGiB - b.totalGiB);
  const scale = Math.max(capacityGiB, ...rows.map(r => r.totalGiB)) * 1.025;
  return <div className="all-models">
    <div className="chart-title">
      <span>The same workload, every checkpoint.</span>
      <span>{concurrency} × {context / 1024}K TOKENS · {capacityGiB.toFixed(capacityGiB === 160 ? 0 : 1)} GiB BUDGET</span>
    </div>
    {rows.map(row => <button key={row.id} className={`model-row ${row.id === current ? 'current' : ''}`} onClick={() => onPick(row.id)} aria-pressed={row.id === current}>
      <div><b>{modelMeta[row.id].name}</b><small>{modelMeta[row.id].family}</small></div>
      <div className="model-meter">
        <span className="weight" style={{ width: `${100 * row.weightGiB / scale}%` }}/>
        <span className="cache" style={{ width: `${100 * row.cacheGiB / scale}%` }}/>
        <span className="overhead" style={{ width: `${100 * overheadGiB / scale}%` }}/>
        <i className="capacity-marker" style={{ left: `${100 * capacityGiB / scale}%` }}/>
      </div>
      <span className={`model-verdict ${row.verdict === 'exceeds' ? 'over' : ''}`}>
        {row.totalGiB.toFixed(1)}<small>{row.partial ? ' GiB · partial' : ' GiB'}</small>
      </span>
    </button>)}
    <p>Three of these count only part of their state, so the bars are not a like-for-like comparison. Select a row to load it into the controls above.</p>
  </div>;
}

export function WeightComparison() {
  const ids = ['qwen3.6-35b-a3b', 'mistral-medium-3.5', 'deepseek-v4.1-flash', 'glm-5.3'];
  return <div className="weight-comparison"><div className="chart-title"><span>Same question. Very different footprints.</span><span>STORED TENSORS · GiB</span></div>{ids.map(id => <div key={id} className="weight-row"><div><b>{modelMeta[id].name}</b><small>{modelMeta[id].family}</small></div><div className="weight-track"><span style={{ width: `${records.weights[id].GiB / 740 * 100}%`, background: modelMeta[id].color }}/></div><span>{records.weights[id].GiB.toFixed(1)}</span></div>)}<p>Exact checkpoint payloads, not measured GPU allocations. <a href="#sources">Pinned source snapshots ↗</a></p></div>;
}
