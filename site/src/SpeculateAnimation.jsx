import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import EditorialPlayback, { useEditorialPlayback } from './EditorialPlayback';
import { simulateSpeculation } from './specSim.mjs';

const PHASE_NOTE = {
  idle: 'Waiting to draft.',
  draft: 'The small model guesses ahead. Cheap, and possibly wrong.',
  verify: 'The big model checks every guess at once, for the cost of one ordinary step.',
  commit: 'Accepted tokens are kept up to the first rejection. The rest are thrown away.',
};

export default function SpeculateAnimation({ figure }) {
  const [acceptance, setAcceptance] = useState(0.75);
  const draftLength = 4, rounds = 4;
  const frames = useMemo(() => simulateSpeculation({ draftLength, rounds, acceptance, seed: 11 }), [acceptance]);
  const { frame: cursor, dispatchFrame, play, dispatchPlay, stageRef } = useEditorialPlayback(frames.length);
  const state = cursor;

  // Draft, verify, commit: the round's three real phases.
  const stages = useMemo(() => ['idle', 'draft', 'verify', 'commit']
    .map(id => ({ id, label: id[0].toUpperCase() + id.slice(1), frame: frames.findIndex(f => f.phase === id) }))
    .filter(stage => stage.frame >= 0), [frames]);
  const frame = frames[Math.min(state.frame, frames.length - 1)];

  return <div className="explorer speculate-animation">
    <div className="explorer-heading">
      <div><span>A speculation round</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label className="range-label">
        <span>Acceptance rate <output>{(acceptance * 100).toFixed(0)}%</output></span>
        <input aria-label="Acceptance rate" type="range" min="0" max="100" step="5"
          value={Math.round(acceptance * 100)} onChange={e => setAcceptance(Number(e.target.value) / 100)}/>
        <span className="range-ticks"><small>never right</small><small>always right</small></span>
      </label>
    </div>

    <EditorialPlayback frame={cursor} dispatchFrame={dispatchFrame} play={play} dispatchPlay={dispatchPlay}
      stages={stages} label="a speculation round" caption={PHASE_NOTE[frame.phase]}/>

    <div className="sim-stage" ref={stageRef}>
      <div className="sim-section">
        <div className="chart-title">
          <span>{frame.round ? `Round ${frame.round} · ${frame.phase}` : 'Before the first round'}</span>
          <span>{frame.emitted} TOKENS EMITTED</span>
        </div>
        <div className="spec-track" role="img" aria-label={PHASE_NOTE[frame.phase]}>
          {frame.tokens.length === 0 && <p className="spec-empty">Press play to draft the first round.</p>}
          {frame.tokens.map(t => <div key={t.index} className={`spec-token ${t.verdict}`}>
            <span className="spec-mark">
              {t.verdict === 'accepted' && <Check size={13}/>}
              {t.verdict === 'rejected' && <X size={13}/>}
              {t.verdict === 'discarded' && '·'}
              {(t.verdict === 'pending' || t.verdict === 'checking') && '?'}
            </span>
            <small>{t.text ? t.text.trim() || 'space' : `draft ${t.index + 1}`}</small>
          </div>)}
          {frame.phase === 'commit' && <div className="spec-token verified">
            <span className="spec-mark"><Check size={13}/></span><small>verified</small>
          </div>}
        </div>
        <p className="spec-phase-note">{PHASE_NOTE[frame.phase]}</p>

        <div className="spec-output">
          <span className="walk-label">Output so far <small>{frame.emitted} tokens</small></span>
          {frame.committedText?.length
            ? <p className="walk-output">{frame.committedText.join('')}<span className="caret" aria-hidden="true"/></p>
            : <p className="walk-muted">Nothing committed yet.</p>}
        </div>
      </div>
    </div>

    <div className="assumptions">
      <div>
        <p>Acceptance is sampled at a constant rate from a fixed seed, so stepping back replays the same round. Real acceptance varies by prompt, position, temperature and shared context, as the break-even explorer above says.</p>
        <p>Drag the rate to zero and step through a round: every draft is thrown away, and the round still emits one token. That is the floor, and it is why speculation degrades rather than breaking.</p>
      </div>
    </div>
  </div>;
}
