import React, { useMemo } from 'react';
import EditorialPlayback, { useEditorialPlayback } from './EditorialPlayback';
import { EXAMPLE, runDecode } from './decodeSim.mjs';

const BLOCK_SIZE = 4;
/** Leading spaces are part of a token; make them visible rather than invisible. */
const show = text => text.replace(/^ /, '␣');

const PHASE = {
  input:    { label: 'Input',    hint: 'plain text' },
  tokenize: { label: 'Tokenize', hint: 'text → tokens' },
  prefill:  { label: 'Prefill',  hint: 'all tokens, one step' },
  decode:   { label: 'Decode',   hint: 'one token per step' },
  done:     { label: 'Done',     hint: '' },
};

export default function DecodeWalkthrough({ figure }) {
  const frames = useMemo(() => runDecode({ ...EXAMPLE, blockSize: BLOCK_SIZE }), []);
  const { frame: cursor, dispatchFrame, play, dispatchPlay, stageRef } = useEditorialPlayback(frames.length);
  const state = cursor;
  const frame = frames[Math.min(cursor.frame, frames.length - 1)];

  // The walkthrough already names its phases; the rail is the first frame at
  // which each one begins.
  const stages = useMemo(() => ['input', 'tokenize', 'prefill', 'decode', 'done']
    .map(id => ({ id, label: PHASE[id].label, hint: PHASE[id].hint, frame: frames.findIndex(f => f.phase === id) }))
    .filter(stage => stage.frame >= 0), [frames]);
  const started = frame.phase !== 'input';
  const order = ['input', 'tokenize', 'prefill', 'decode', 'done'];

  return <div className="explorer decode-walkthrough">
    <div className="explorer-heading">
      <div><span>One prompt, start to finish</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>


    <EditorialPlayback frame={cursor} dispatchFrame={dispatchFrame} play={play} dispatchPlay={dispatchPlay}
      stages={stages} label="the decode walkthrough"/>

    <div className="walk-stage" ref={stageRef}>
      <section className="walk-row">
        <span className="walk-label">Prompt</span>
        <p className="walk-prompt">“{EXAMPLE.prompt}”</p>
      </section>

      <section className="walk-row">
        <span className="walk-label">Tokens <small>{started ? `${EXAMPLE.promptTokens.length}` : ''}</small></span>
        <div className="token-row">
          {frame.tokens.length === 0
            ? <p className="walk-muted">Not split yet.</p>
            : frame.tokens.map(t => <span key={t.index} className="token prompt" style={{ '--i': t.index }}>{show(t.text)}</span>)}
        </div>
      </section>

      <section className="walk-row">
        <span className="walk-label">KV cache <small>{frame.cache.length ? `${frame.cache.length} entries · blocks of ${BLOCK_SIZE}` : ''}</small></span>
        {frame.cache.length === 0
          ? <p className="walk-muted">Empty. Nothing has been computed.</p>
          : <div className="kv-blocks">
              {frame.blocks.map(block => <div key={block.index} className="kv-block">
                <span className="kv-block-index">block {block.index}</span>
                <div className="kv-slots">
                  {Array.from({ length: BLOCK_SIZE }, (_, s) => {
                    const t = block.tokens[s];
                    return <span key={s} className={`kv-slot ${t ? t.kind : 'empty'} ${t && t.position === frame.cache.length - 1 && frame.phase === 'decode' ? 'fresh' : ''}`}
                                 style={{ '--i': block.index * BLOCK_SIZE + s }}>
                      {t ? show(t.text) : ''}
                    </span>;
                  })}
                </div>
              </div>)}
            </div>}
      </section>

      <section className="walk-row">
        <span className="walk-label">Output <small>{frame.outputText ? `${frame.cache.filter(c=>c.kind==='output').length} tokens` : ''}</small></span>
        {frame.outputText
          ? <p className="walk-output">{frame.outputText}<span className="caret" aria-hidden="true"/></p>
          : <p className="walk-muted">Nothing generated yet.</p>}
      </section>

      {frame.phase === 'decode' && <div className="walk-ledger">
        <div><span className="eyebrow">THIS STEP READS</span><strong>{frame.reads}</strong><small>cached tokens</small></div>
        <div><span className="eyebrow">THIS STEP WRITES</span><strong>{frame.writes}</strong><small>new token</small></div>
      </div>}
      {frame.phase === 'prefill' && <div className="walk-ledger">
        <div><span className="eyebrow">THIS STEP READS</span><strong>0</strong><small>cached tokens</small></div>
        <div><span className="eyebrow">THIS STEP WRITES</span><strong>{frame.writes}</strong><small>tokens at once</small></div>
      </div>}

      <p className="walk-caption">{frame.caption}</p>
    </div>

    <div className="assumptions">
      <div>
        <p>The words are a fixed script, not a model's output. The point is the mechanism, not the answer. What is faithful: the prompt is cached in one pass, every decode step re-reads everything cached before it and appends exactly one token, and blocks fill in order.</p>
        <p>A real tokenizer would split this text slightly differently, and a real block holds hundreds of tokens rather than {BLOCK_SIZE}. Both are scaled down here so the whole loop fits on one screen.</p>
      </div>
    </div>
  </div>;
}
