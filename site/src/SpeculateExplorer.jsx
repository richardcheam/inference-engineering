import React, { useState } from 'react';
import { ArrowUpRight, RotateCcw, Check, X } from 'lucide-react';
import { expectedAccepted, speculation } from './speculate.mjs';

export default function SpeculateExplorer({ figure }) {
  const [draftLength, setDraft] = useState(4);
  const [acceptance, setAcceptance] = useState(0.8);
  const draftCost = 0.2, verifyCost = 1.1, baseStep = 1;
  const r = speculation({ draftLength, acceptance, draftCost, verifyCost, baseStep });
  const reset = () => { setDraft(4); setAcceptance(0.8); };
  const chain = Array.from({ length: draftLength }, (_, i) => acceptance ** (i + 1));

  return <div className="explorer speculate-explorer">
    <div className="explorer-heading">
      <div><span>Speculation break-even</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label className="range-label">
        <span>Draft length <output>{draftLength} <small>tokens</small></output></span>
        <input aria-label="Draft length" type="range" min="1" max="12" step="1" value={draftLength} onChange={e => setDraft(Number(e.target.value))}/>
        <span className="range-ticks"><small>1</small><small>12</small></span>
      </label>
      <label className="range-label">
        <span>Acceptance rate <output>{(acceptance * 100).toFixed(0)}%</output></span>
        <input aria-label="Acceptance rate" type="range" min="0" max="100" step="1" value={Math.round(acceptance * 100)} onChange={e => setAcceptance(Number(e.target.value) / 100)}/>
        <span className="range-ticks"><small>0%</small><small>100%</small></span>
      </label>
    </div>

    <div className="bound-headline">
      <div className="bound-row">
        <div><span className="eyebrow">TOKENS PER ROUND</span><strong>{r.tokensPerStep.toFixed(2)}</strong></div>
        <div><span className="eyebrow">SPEEDUP</span><strong className={r.worthwhile ? '' : 'alarming'} data-testid="speedup">{r.speedup.toFixed(2)}×</strong></div>
        <div><span className="eyebrow">BREAK-EVEN AT</span><strong>{(r.breakEvenAcceptance * 100).toFixed(0)}% <small>acceptance</small></strong></div>
      </div>
    </div>

    <div className="speculate-view">
      <div className="chart-title">
        <span>{r.worthwhile ? 'This configuration pays for itself.' : 'This configuration costs more than it saves.'}</span>
        <span>PROBABILITY EACH DRAFT SURVIVES</span>
      </div>
      <div className="draft-chain">
        {chain.map((p, i) => <div key={i} className={`draft-token ${p > 0.5 ? 'likely' : 'unlikely'}`}>
          <span className="draft-bar" style={{ height: `${Math.max(4, p * 100)}%` }}/>
          <small>{(p * 100).toFixed(0)}%</small>
        </div>)}
        <div className="draft-token verified"><span className="draft-bar" style={{ height: '100%' }}/><small><Check size={10}/></small></div>
      </div>
      <p className="draft-caption">
        Each drafted token only counts if every token before it was accepted too, so the chain decays geometrically. The last column is the token verification produces for free, which is why a fully rejected round still advances by one.
      </p>
      <div className={`speculate-verdict ${r.worthwhile ? 'good' : 'bad'}`}>
        {r.worthwhile ? <Check size={15}/> : <X size={15}/>}
        <p>
          {r.worthwhile
            ? <>Expected <b>{r.accepted.toFixed(2)}</b> accepted drafts plus the verified token, for <b>{r.stepTime.toFixed(2)}</b> ordinary steps of work. That is <b>{r.timePerToken.toFixed(2)}</b> per token against a baseline of 1.00.</>
            : <>Expected <b>{r.accepted.toFixed(2)}</b> accepted drafts, with <b>{r.wastedDrafts.toFixed(2)}</b> drafted and thrown away. At <b>{r.timePerToken.toFixed(2)}</b> per token this is slower than not speculating at all.</>}
        </p>
      </div>
    </div>

    <div className="explorer-foot">
      <label>Costs <span className="foot-note">draft {draftCost} · verify {verifyCost} · baseline step 1.0</span></label>
      <button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button>
    </div>
    <div className="assumptions">
      <div>
        <p>Costs are in units of one ordinary decode step and are assumed constant. In reality verification cost grows with draft length, and the draft model competes with the target for the same bandwidth.</p>
        <p>Acceptance is treated as one constant rate. It is not: it varies by prompt, by position, by temperature, and by how much of the context is shared. Measure it per workload rather than carrying a number over from someone else's.</p>
        <a href="#equations">The break-even condition <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}
