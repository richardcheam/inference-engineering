import React, { useState } from 'react';
import { ArrowUpRight, Info, RotateCcw, AlertTriangle } from 'lucide-react';
import { formats, quantize } from './precision.mjs';

const GB = b => b / 1e9;
const gb = b => GB(b).toFixed(GB(b) < 10 ? 2 : 1);

export default function PrecisionExplorer({ figure }) {
  const [format, setFormat] = useState('fp4');
  const [groupSize, setGroup] = useState(128);
  const parameters = 100e9, scaleBits = 16;
  const r = quantize({ parameters, format, groupSize, scaleBits });
  const bf16 = quantize({ parameters, format: 'bf16', groupSize, scaleBits });
  const reset = () => { setFormat('fp4'); setGroup(128); };

  return <div className="explorer precision-explorer">
    <div className="explorer-heading">
      <div><span>Precision explorer</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label>Stored format
        <select aria-label="Stored format" value={format} onChange={e => setFormat(e.target.value)}>
          {formats.map(f => <option key={f.id} value={f.id}>{f.label} · {f.bits} bits</option>)}
        </select>
      </label>
      <label>Scale group
        <select aria-label="Scale group size" value={groupSize} onChange={e => setGroup(Number(e.target.value))}>
          {[32, 64, 128, 256].map(g => <option key={g} value={g}>1 scale per {g} values</option>)}
        </select>
      </label>
    </div>

    <div className="bound-headline">
      <div className="bound-row">
        <div><span className="eyebrow">NOMINAL</span><strong>{r.nominalBits} <small>bits / param</small></strong></div>
        <div><span className="eyebrow">ACTUALLY STORED</span><strong data-testid="effective-bits">{r.effectiveBitsPerParameter.toFixed(2)} <small>bits / param</small></strong></div>
        <div><span className="eyebrow">VS BF16</span><strong>{(r.savingVsBf16 * 100).toFixed(0)}% <small>smaller</small></strong></div>
      </div>
    </div>

    <div className="precision-view">
      <div className="chart-title"><span>A 100B-parameter checkpoint.</span><span>PAYLOAD + SCALES</span></div>
      <div className="precision-bars">
        <div className="precision-row">
          <div><b>BF16 baseline</b><small>no scales</small></div>
          <div className="weight-track"><span className="weight" style={{ width: '100%' }}/></div>
          <span>{gb(bf16.totalBytes)} GB</span>
        </div>
        <div className="precision-row">
          <div><b>{r.label}</b><small>{r.scaleOverheadFraction > 0 ? `${(r.scaleOverheadFraction * 100).toFixed(1)}% of it is scales` : 'no scales'}</small></div>
          <div className="weight-track">
            <span className="weight" style={{ width: `${100 * r.payloadBytes / bf16.totalBytes}%` }}/>
            <span className="scales" style={{ width: `${100 * r.scaleBytes / bf16.totalBytes}%` }}/>
          </div>
          <span>{gb(r.totalBytes)} GB</span>
        </div>
      </div>
      <div className={`execution-note ${r.executesNatively ? '' : 'warn'}`}>
        {r.executesNatively ? <Info size={15}/> : <AlertTriangle size={15}/>}
        <div>
          <span className="eyebrow">{r.executesNatively ? 'EXECUTES IN THIS FORMAT' : 'STORAGE FORMAT ONLY'}</span>
          <p>{r.note}</p>
        </div>
      </div>
    </div>

    <div className="explorer-foot">
      <label>Scales <span className="foot-note">{scaleBits}-bit, one per {groupSize} values</span></label>
      <button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button>
    </div>
    <div className="assumptions">
      <div>
        <p>A uniform parameter count at a single format. Real checkpoints mix formats across tensors, which is exactly why our four pinned models are measured by summing their tensor indices rather than by multiplying a bit width.</p>
        <p>Nothing here says anything about output quality. Smaller storage is a capacity and bandwidth result; whether the model still answers correctly is a separate measurement on a matched evaluation set.</p>
        <a href="#models">How the pinned checkpoints were measured <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}
