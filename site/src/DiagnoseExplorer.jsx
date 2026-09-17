import React, { useState } from 'react';
import { ArrowUpRight, RotateCcw, FlaskConical } from 'lucide-react';
import { hypotheses, rank, symptoms } from './diagnose.mjs';

export default function DiagnoseExplorer({ figure }) {
  const [observed, setObserved] = useState([]);
  const ranked = rank(observed);
  const leaders = ranked.filter(h => h.score > 0);
  const toggle = id => setObserved(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]));
  const top = leaders[0];
  const tied = top ? leaders.filter(h => h.score === top.score) : [];

  return <div className="explorer diagnose-explorer">
    <div className="explorer-heading">
      <div><span>Bottleneck differential</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="symptom-picker">
      <span className="eyebrow">WHAT HAVE YOU ACTUALLY OBSERVED?</span>
      <div className="symptom-grid">
        {symptoms.map(s => <button key={s.id} className={observed.includes(s.id) ? 'active' : ''} onClick={() => toggle(s.id)} aria-pressed={observed.includes(s.id)}>
          <b>{s.label}</b><small>{s.hint}</small>
        </button>)}
      </div>
    </div>

    <div className="differential">
      {!observed.length && <p className="differential-empty">Nothing observed yet, so nothing is ranked. Pick the symptoms you have actually measured, not the ones you suspect, and the candidates that explain them will sort to the top.</p>}
      {observed.length > 0 && <>
        {tied.length > 1 && <p className="differential-tie"><b>{tied.length} candidates explain this equally well.</b> That is the useful state: run the discriminating test that separates them before changing anything.</p>}
        {leaders.map(h => <div key={h.id} className={`hypothesis ${h.score === top.score ? 'leading' : ''}`}>
          <div className="hypothesis-head">
            <b>{h.label}</b>
            <span className="hypothesis-score">explains {h.score} of {observed.length}</span>
          </div>
          <p className="hypothesis-mechanism">{h.mechanism}</p>
          <div className="hypothesis-test"><FlaskConical size={13}/><div>
            <span className="eyebrow">DISCRIMINATING TEST</span>
            <p>{h.discriminator}</p>
            <span className="eyebrow">IF IT FAILS, THE RIVAL IS</span>
            <p className="counter">{h.counter}</p>
          </div></div>
        </div>)}
        {!leaders.length && <p className="differential-empty">Nothing in this list explains that combination. That is a real result: the differential is incomplete, and the next step is a timeline capture rather than a guess.</p>}
      </>}
    </div>

    <div className="explorer-foot">
      <label>Candidates <span className="foot-note">{leaders.length} raised of {hypotheses.length}</span></label>
      <button className="text-button" onClick={() => setObserved([])}><RotateCcw size={13}/> Clear observations</button>
    </div>
    <div className="assumptions">
      <div>
        <p>A ranking by explanatory coverage, not a probability. Two candidates that explain the same symptoms are not thereby equally likely; they are equally unresolved.</p>
        <p>This list is deliberately incomplete. Tokenizer cost, sampling parameters, client-side buffering, and noisy neighbours all produce these symptoms and none of them are modelled here.</p>
        <a href="#benchmarking">Our measurement protocol <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}
