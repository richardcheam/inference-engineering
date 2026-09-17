import React, { useMemo } from 'react';
import ScrollScene from './ScrollScene';
import records from '../../experiments/001-feasibility/calculations.json';
import { phaseStates } from './phaseStates.mjs';

/**
 * Chapter three, section two: prefill and decode are the same model behaving
 * like two different machines (module 12 §8).
 *
 * The stage holds two rows. The weight read is the invariant and never changes
 * height across the whole scene; the token field beside it empties out. That is
 * the argument made spatially: the cost stays, the work sharing it does not.
 */

const WORKLOAD = { model: 'mistral-medium-3.5', promptTokens: 4096, sequences: 8, batched: 64 };
/** The token field draws at most this many marks; the count beside it is exact. */
const MARKS = 64;
const gb = bytes => {
  const value = bytes / 1e9;
  return value.toFixed(value < 10 ? 1 : 0);
};

function Stage({ frame, focus }) {
  const marks = Math.min(frame.tokens, MARKS);
  const capped = frame.tokens > MARKS;
  return <div className="phase-stage">
    <div className={`phase-row invariant ${focus === 'intensity' ? 'focus' : ''}`}>
      <p className="stage-label">WEIGHTS READ THIS STEP<b>{gb(frame.weightBytes)} GB</b></p>
      <div className="weight-bar"><span/></div>
      <p className="phase-note">Identical in every state below. This is what does not change.</p>
    </div>

    <div className={`phase-row ${focus === 'tokens' ? 'focus' : ''}`}>
      <p className="stage-label">
        TOKENS SHARING THAT READ
        <b>{frame.tokens.toLocaleString()}<small> · {frame.label}</small></b>
      </p>
      <div className="token-field" data-phase={frame.phase}>
        {Array.from({ length: marks }, (_, i) => <i key={i}/>)}
        {marks === 0 && <span className="token-empty">nothing yet</span>}
      </div>
      {capped && <p className="phase-note">The field draws {MARKS} marks; the count above is the real one.</p>}
    </div>

    <div className={`phase-row readout ${focus === 'intensity' ? 'focus' : ''}`}>
      <p className="stage-label">TOKENS PER GB OF WEIGHTS READ</p>
      <strong className={frame.phase === 'decode' ? 'low' : ''}>
        {/* Two decimals below 1, so the gap the caption states is the gap the
            reader can see: 0.1 would make 512x look like 310x. */}
        {frame.tokensPerGB >= 10 ? Math.round(frame.tokensPerGB)
          : frame.tokensPerGB >= 1 ? frame.tokensPerGB.toFixed(1)
          : frame.tokensPerGB.toFixed(2)}
      </strong>
    </div>
  </div>;
}

export default function PhaseScene({ figure }) {
  const { frames, states, ratio } = useMemo(() => phaseStates(WORKLOAD, records), []);

  return <figure className="scene-figure">
    <figcaption className="scene-figure-head">
      <span>The same weights, two workloads</span>
      {figure && <span className="figure-id">FIG. {figure}</span>}
    </figcaption>

    <ScrollScene
      id="phase-scene"
      label="Why prefill and decode behave like different machines"
      states={states}
      renderStage={state => <Stage frame={frames[state.frame]} focus={state.focus}/>}
    />

    <p className="scene-provenance">
      Mistral Medium 3.5, a {WORKLOAD.promptTokens.toLocaleString()}-token prompt,
      {' '}{WORKLOAD.sequences} sequences in flight. The weight bytes are the pinned
      checkpoint payload; the token counts are what each phase carries by
      definition, and the {ratio.toLocaleString()}× gap between them is their
      ratio, not a measurement. Arithmetic per token and cache traffic are left
      out here so that one variable moves at a time.
    </p>
  </figure>;
}
