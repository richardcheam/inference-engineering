import React, { useState } from 'react';
import { ArrowUpRight, RotateCcw, AlertTriangle } from 'lucide-react';
import records from '../../experiments/001-feasibility/calculations.json';
import { modelMeta } from './memory.mjs';
import { platforms } from './bandwidth.mjs';
import { placeMemory, strategies } from './parallel.mjs';

const GB = b => b / 1e9;
const gb = b => GB(b).toFixed(GB(b) < 10 ? 2 : 1);

export default function PlacementExplorer({ figure }) {
  const [model, setModel] = useState('glm-5.3');
  const [strategy, setStrategy] = useState('tp');
  const [devices, setDevices] = useState(8);
  const [platform, setPlatform] = useState('h200-sxm');
  const settings = { model, strategy, devices, context: 32768, sequences: 8, kvHeads: 8, capacityPerDevice: platforms[platform].capacityBytes };
  const r = placeMemory(settings, records);
  const spec = strategies.find(s => s.id === strategy);
  const reset = () => { setModel('glm-5.3'); setStrategy('tp'); setDevices(8); setPlatform('h200-sxm'); };
  const fill = Math.min(r.perDeviceBytes / r.capacityPerDevice, 1.6);

  return <div className="explorer placement-explorer">
    <div className="explorer-heading">
      <div><span>Placement explorer</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label>Checkpoint
        <select aria-label="Checkpoint" value={model} onChange={e => setModel(e.target.value)}>
          {Object.entries(modelMeta).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}
        </select>
      </label>
      <label>Strategy
        <select aria-label="Parallelism strategy" value={strategy} onChange={e => setStrategy(e.target.value)}>
          {strategies.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>Device
        <select aria-label="Device" value={platform} onChange={e => setPlatform(e.target.value)}>
          {Object.entries(platforms).map(([id, p]) => <option key={id} value={id}>{p.name} · {gb(p.capacityBytes)} GB</option>)}
        </select>
      </label>
      <label className="range-label">
        <span>Devices <output>{devices}</output></span>
        <input aria-label="Device count" type="range" min="1" max="16" step="1" value={devices} onChange={e => setDevices(Number(e.target.value))}/>
        <span className="range-ticks"><small>1</small><small>16</small></span>
      </label>
    </div>

    <div className="bound-headline">
      <div className="bound-row">
        <div><span className="eyebrow">PER DEVICE</span><strong className={r.fits ? '' : 'alarming'}>{gb(r.perDeviceBytes)} <small>/ {gb(r.capacityPerDevice)} GB</small></strong></div>
        <div><span className="eyebrow">AGGREGATE WEIGHTS</span><strong>{gb(r.weightBytesTotal)} <small>GB</small></strong></div>
        <div><span className="eyebrow">SYNC POINTS / STEP</span><strong>{r.collectivesPerStep}</strong></div>
      </div>
    </div>

    <div className="placement-view">
      <div className="chart-title"><span>{devices} {devices === 1 ? 'device' : 'devices'}, {spec.label.toLowerCase()}.</span><span>WEIGHTS · CACHE · FREE</span></div>
      <div className="device-grid">
        {Array.from({ length: devices }, (_, i) => <div key={i} className={`device ${r.fits ? '' : 'over'}`}>
          <div className="device-fill">
            <span className="weight" style={{ height: `${Math.min(100 * r.weightBytesPerDevice / r.capacityPerDevice, 100)}%` }}/>
            <span className="cache" style={{ height: `${Math.min(100 * r.cacheBytesPerDevice / r.capacityPerDevice, 100)}%` }}/>
          </div>
          <small>{i}</small>
        </div>)}
      </div>
      {!r.fits && <p className="placement-warning"><AlertTriangle size={14}/> Each device is {gb(-r.headroomBytes)} GB over its capacity. More devices, or a different strategy.</p>}
      {r.kvReplicas > 1 && <p className="placement-note">Beyond 8 stored KV heads there is nothing left to split, so the cache is replicated {r.kvReplicas}× instead. Aggregate cache memory rises even though each device holds less.</p>}
      <div className="strategy-note">
        <div><span className="eyebrow">WHAT IT DIVIDES</span><p>{spec.shards}</p></div>
        <div><span className="eyebrow">WHAT IT COSTS</span><p>{spec.cost}</p></div>
      </div>
    </div>

    <div className="explorer-foot">
      <label>Workload <span className="foot-note">8 sequences × 32K tokens</span></label>
      <button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button>
    </div>
    <div className="assumptions">
      <div>
        <p>{modelMeta[model].scope}</p>
        <p>Weights and cache only. Activations, workspaces, communication buffers and the engine reserve are not counted, so a placement that just fits here does not fit in reality. Sync points are a shape, not a measured count, and say nothing about how long each one takes.</p>
        <a href="#hardware-reference">Device capacities and topology <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}
