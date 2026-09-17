import React, { useState } from 'react';
import { ArrowUpRight, Blocks, RotateCcw, Grid2x2, Gauge } from 'lucide-react';
import Tabs from './Tabs';
import { blockSizes, prefixReuse } from './prefix.mjs';

const pct = v => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : 0)}%`;

export default function PrefixExplorer({ figure }) {
  const [promptTokens, setPrompt] = useState(1024);
  const [cachedTokens, setCached] = useState(1024);
  const [blockSize, setBlockSize] = useState(64);
  const capped = Math.min(cachedTokens, promptTokens);
  const r = prefixReuse({ promptTokens, cachedTokens: capped, blockSize });
  const reset = () => { setPrompt(1024); setCached(1024); setBlockSize(64); };
  const gap = r.reportedHitFraction - r.actualHitFraction;

  return <div className="explorer prefix-explorer">
    <div className="explorer-heading">
      <div><span>Prefix cache explorer</span></div>{figure && <span className="figure-id">FIG. {figure}</span>}
    </div>
    <div className="explorer-controls">
      <label className="range-label">
        <span>Prompt length <output>{promptTokens.toLocaleString()} <small>tokens</small></output></span>
        <input aria-label="Prompt length" type="range" min="64" max="4096" step="1" value={promptTokens} onChange={e => setPrompt(Number(e.target.value))}/>
        <span className="range-ticks"><small>64</small><small>4,096</small></span>
      </label>
      <label className="range-label">
        <span>Already cached <output>{capped.toLocaleString()} <small>tokens</small></output></span>
        <input aria-label="Cached prefix length" type="range" min="0" max="4096" step="1" value={cachedTokens} onChange={e => setCached(Number(e.target.value))}/>
        <span className="range-ticks"><small>nothing</small><small>whole prompt</small></span>
      </label>
      <label>Block size
        <select aria-label="Block size" value={blockSize} onChange={e => setBlockSize(Number(e.target.value))}>
          {blockSizes.map(b => <option key={b} value={b}>{b} tokens per block</option>)}
        </select>
      </label>
      <label>Match
        <select aria-label="How much of the prompt is cached" value={capped === promptTokens ? 'all' : 'some'} onChange={e => setCached(e.target.value === 'all' ? promptTokens : Math.floor(promptTokens / 2))}>
          <option value="all">The whole prompt is cached</option>
          <option value="some">Half the prompt is cached</option>
        </select>
      </label>
    </div>

    <div className="bound-headline">
      <div className="bound-row">
        <div><span className="eyebrow">CACHE REPORTS</span><strong>{pct(r.reportedHitFraction)} <small>hit</small></strong></div>
        <div><span className="eyebrow">PREFILL ACTUALLY SKIPS</span><strong data-testid="actual-hit">{pct(r.actualHitFraction)} <small>of tokens</small></strong></div>
        <div><span className="eyebrow">STILL RECOMPUTED</span><strong>{r.recomputedTokens.toLocaleString()} <small>tokens</small></strong></div>
      </div>
    </div>

    <Tabs label="Prefix cache views" tabs={[
      { id: 'blocks', label: 'The blocks', Icon: Grid2x2, render: () => <BlockStrip r={r} promptTokens={promptTokens} blockSize={blockSize}/> },
      { id: 'gap', label: 'Reported vs real', Icon: Gauge, render: () => <HitGap r={r} gap={gap} blockSize={blockSize}/> },
    ]}/>

    <div className="explorer-foot">
      <label>Blocks for this prompt <span className="foot-note">{r.blocksForPrompt} × {blockSize} = {(r.blocksForPrompt * blockSize).toLocaleString()} slots, {r.paddingTokens} unused</span></label>
      <button className="text-button" onClick={reset}><RotateCcw size={13}/> Reset example</button>
    </div>
    <div className="assumptions">
      <div>
        <p>A lookup is capped at one token below the prompt length, then aligned down to a whole block. Both come from the pinned cache manager, not from a benchmark.</p>
        <p>This counts tokens, not time. Recomputing {r.recomputedTokens.toLocaleString()} tokens is prefill work whose cost depends on the model and the hardware. Eviction, cache-group compatibility, and admission control all sit outside this model.</p>
        <a href="#engines">Read the source investigation <ArrowUpRight size={12}/></a>
      </div>
    </div>
  </div>;
}

/** The prompt as blocks, so alignment is visible rather than asserted. */
function BlockStrip({ r, promptTokens, blockSize }) {
  const blocks = Array.from({ length: r.blocksForPrompt }, (_, i) => {
    const start = i * blockSize;
    if (start + blockSize <= r.reusedTokens) return 'reused';
    return start >= promptTokens ? 'padding' : 'recomputed';
  });
  return <div className="block-strip-wrap">
    <div className="chart-title">
      <span>{r.blocksReused} of {r.blocksForPrompt} blocks reused.</span>
      <span>ONE BLOCK = {blockSize} TOKENS</span>
    </div>
    <div className="block-strip" role="img" aria-label={`${r.blocksReused} of ${r.blocksForPrompt} blocks reused, the rest recomputed.`}>
      {blocks.map((kind, i) => <i key={i} className={kind}/>)}
    </div>
    <div className="block-legend">
      <span><i className="reused"/>Reused from cache</span>
      <span><i className="recomputed"/>Recomputed now</span>
    </div>
    <p>The final block is always recomputed, because the last token needs its logits and allocation can only resume on a block boundary. Slide the prompt by one token and watch that block appear and disappear.</p>
  </div>;
}

function HitGap({ r, gap, blockSize }) {
  const rows = [
    { key: 'reported', label: 'What a hit-rate metric reports', value: r.reportedHitFraction },
    { key: 'actual', label: 'What prefill actually skipped', value: r.actualHitFraction },
  ];
  return <div className="hit-gap">
    <div className="chart-title"><span>The same request, measured two ways.</span><span>SHARE OF PROMPT TOKENS</span></div>
    {rows.map(row => <div key={row.key} className="weight-row">
      <div><b>{row.label}</b></div>
      <div className="weight-track"><span className={`gap-${row.key}`} style={{ width: `${row.value * 100}%` }}/></div>
      <span>{pct(row.value)}</span>
    </div>)}
    <p>
      {gap > 0
        ? <>The difference is <b>{r.lostToLastToken} tokens</b>, the final token plus the rest of its {blockSize}-token block. At short prompts that gap is most of the prompt; at long ones it shrinks toward nothing.</>
        : <>Nothing is cached here, so the two measures agree. They only diverge once there is a hit to report.</>}
    </p>
  </div>;
}
