import React from 'react';
import katex from 'katex';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import MemoryExplorer, { WeightComparison } from './MemoryExplorer';
import DecodeWalkthrough from './DecodeWalkthrough';
import Sequence from './Sequence';
import LessonSection from './LessonSection';

export const lessonToc = [
  { id: 'what-actually-happens', label: 'What actually happens' },
  { id: 'the-first-question', label: 'The first question' },
  { id: 'three-parts', label: 'Three parts of memory' },
  { id: 'memory-budget', label: 'Explore a memory budget' },
  { id: 'architecture-matters', label: 'Why architecture matters' },
  { id: 'beyond-capacity', label: 'Beyond “it fits”' },
];
const tex = (source, displayMode) => katex.renderToString(source, { throwOnError: false, displayMode });

/** A display formula. `legend` is [symbol, meaning] pairs; every symbol in the formula should appear. */
export function MathFormula({ children, legend, note }) {
  return <div className="math-block">
    <div className="math-formula" dangerouslySetInnerHTML={{ __html: tex(children, true) }}/>
    {legend && <dl className="math-legend">
      <div className="legend-lead"><dt>where</dt><dd/></div>
      {legend.map(([symbol, meaning]) => <div key={symbol}>
        <dt dangerouslySetInnerHTML={{ __html: tex(symbol, false) }}/>
        <dd>{meaning}</dd>
      </div>)}
    </dl>}
    {note && <p className="math-note">{note}</p>}
  </div>;
}

export function MemoryArt() {
  return <div className="memory-art" role="img" aria-label="Conceptual memory stack: model weights, request state, and runtime share the same capacity.">
    <div className="art-grid"/><span className="art-label top">ONE MEMORY BUDGET</span>
    <div className="art-stack"><div className="art-layer layer-runtime"><span>Runtime</span><small>03</small></div><div className="art-layer layer-kv"><span>Request state</span><small>02</small></div><div className="art-layer layer-weights"><span>Model weights</span><small>01</small></div></div>
    <span className="art-label bottom"><i/> CAPACITY IS ONLY THE BEGINNING</span>
  </div>;
}

export default function Lesson() {
  return <div className="lesson-body">
    <LessonSection id="what-actually-happens" number="01" label="START HERE" title="Watch one prompt go through." summary={[
      'A prompt is text; the model works on tokens, not words.',
      'Prefill handles the whole prompt in one step and fills the cache.',
      'Decode then writes one token per step, re-reading everything cached before it.',
    ]}>
      <p>Before any arithmetic, it is worth watching the thing itself. Below is a real prompt going through a model one step at a time: the text is split into tokens, the tokens are processed together, and then the answer arrives one token at a time. Every idea in this guide (memory budgets, bandwidth, batching, caching) is a claim about this loop.</p>
      <p>Press play, or step through it with the arrows. Nothing here assumes you already know what a token or a cache is; that is what the walkthrough is for.</p>
      <DecodeWalkthrough figure="01"/>
      <p>Two things are worth noticing, because the rest of the guide depends on them. The prompt was handled in <em>one</em> step, however long it was. The answer then took <em>one step per token</em>, and each of those steps had to re-read everything cached before it. Those two facts pull the hardware in opposite directions, and almost every serving decision comes from that tension.</p>
      <div className="key-idea"><p><b>The cache is why this works at all</b><br/>Without it, every decode step would have to reprocess the entire prompt from scratch. The cache is what lets step twelve read what step one already computed.</p></div>
    </LessonSection>

    <LessonSection id="the-first-question" number="02" label="THE FIRST QUESTION" title="A model is more than its weights." summary={[
      'The checkpoint is one of three things competing for the same memory.',
      'Active parameters describe per-token work; total resident parameters decide storage.',
    ]}><p>Before choosing a serving command, build a picture of what needs to live in memory. The checkpoint is one part. Each active request carries state, and the engine needs room to do its work.</p><div className="key-idea"><p><b>Keep this distinction in mind</b><br/>Active parameters describe some of the work per token. Total resident parameters determine how much weight storage you need.</p></div></LessonSection>
    <LessonSection id="three-parts" number="03" label="BUILD THE BUDGET" title="Three parts. One shared limit." summary={[
      'Weights, request state, and execution memory share one device budget.',
      'Apply the limit per device; adding up GPU capacities is only a first screen.',
    ]}><div className="memory-parts">{[{name:'Model weights',text:'The tensors the engine keeps resident. Include mixed precision, quantization scales, and auxiliary modules.',label:'Mostly fixed',kind:'weights'},{name:'Request state',text:'KV cache, recurrent state, and other context the model needs to continue each active sequence.',label:'Changes with workload',kind:'state'},{name:'Execution memory',text:'Activations, workspaces, CUDA graphs, communication buffers, and runtime allocations.',label:'Depends on the engine',kind:'runtime'}].map(({Icon,...p})=><div className={`memory-part ${p.kind}`} key={p.name}><h3>{p.name}</h3><p>{p.text}</p><span>{p.label}</span></div>)}</div><MathFormula legend={[
      [String.raw`M_{\text{weights}}`, 'bytes of resident model tensors, including scales and auxiliary modules'],
      [String.raw`M_{\text{state}}`, 'bytes of per-request state: KV cache, recurrent state, anything carried between tokens'],
      [String.raw`M_{\text{execution}}`, 'bytes the engine needs to run: activations, workspaces, graph pools, communication buffers'],
      [String.raw`M_{\text{usable}}`, 'bytes actually allocatable on one device, which is less than the advertised capacity'],
    ]} note="Every term is bytes on a single device. Read ≤ as “must not exceed”.">{String.raw`M_{\text{weights}} + M_{\text{state}} + M_{\text{execution}} \leq M_{\text{usable}}`}</MathFormula><p className="caption">Apply this to each device. Adding up GPU capacities is only a first screen.</p></LessonSection>
    <LessonSection id="memory-budget" number="04" label="SEE THE CONSEQUENCES" title="Make the budget tangible." summary={[
      'Interactive: Mistral on a 160 GiB device, with context and concurrency you set.',
      'Weights stay fixed while request state grows with context and sequence count.',
    ]}><p>Start with Mistral on a hypothetical 160 GiB device. Two 32K sequences leave a little room. Increase the context and watch request state take a larger share, while the weights don’t change.</p><MemoryExplorer figure="02"/></LessonSection>
    <LessonSection id="architecture-matters" number="05" label="CONNECT ARCHITECTURE TO MEMORY" title="The same context is not the same cache." summary={[
      'KV bytes scale with layers, stored KV heads, head dimension, precision, and live tokens.',
      'Same 32K context: 11 GiB for Mistral, 0.625 GiB for Qwen\'s full-attention layers.',
      'Hybrid and latent-attention models need their own accounting, not the generic formula.',
    ]}><p>For conventional grouped-query attention, the cache grows with the number of layers, stored KV heads, head dimension, precision, and live tokens.</p><MathFormula legend={[
      [String.raw`M_{\text{KV}}`, 'total bytes of KV cache across every live sequence'],
      ['2', 'one key and one value stored per position; the only reason this factor is here'],
      ['L', 'number of attention layers that keep a KV cache'],
      [String.raw`H_{\text{KV}}`, 'stored KV heads per layer, after grouped-query sharing, not the query-head count'],
      [String.raw`D_{\text{head}}`, 'dimensions per head'],
      ['b', 'bytes per stored element: 2 for BF16, 1 for FP8'],
      [String.raw`T_i`, 'live tokens in sequence i, so the sum runs over every sequence in flight'],
    ]} note="Everything left of the sum is fixed by the architecture. Only the sum moves with your workload.">{String.raw`M_{\text{KV}} = 2 L H_{\text{KV}} D_{\text{head}}\, b \sum_i T_i`}</MathFormula><div className="comparison-pair"><div><span className="eyebrow">MISTRAL · CONVENTIONAL GQA</span><strong>11 <small>GiB</small></strong><p>BF16 KV at 32K tokens for one sequence across 88 layers.</p><div className="mini-code">2 × 88 × 8 × 128 × 2 × 32,768</div></div><div><span className="eyebrow">QWEN · FULL-ATTENTION PART</span><strong>0.625 <small>GiB</small></strong><p>The ten full-attention layers only. Recurrent and other states are additional.</p><div className="mini-code">2 × 10 × 2 × 256 × 2 × 32,768</div></div></div><p>Hybrid and compressed-cache architectures need their own accounting. A single generic KV formula will miss what is actually stored.</p><WeightComparison/><a className="inline-link" href="#models">Read the four-model comparison <ArrowRight size={15}/></a></LessonSection>
    <LessonSection id="beyond-capacity" number="06" label="TAKE THE NEXT STEP" title="“It fits” starts the investigation." summary={[
      'Capacity, then compatibility, then performance, then operations.',
      'A model can fit comfortably and still miss its latency target.',
    ]}><p>A capacity candidate still needs compatible kernels, a workable placement, and enough bandwidth and compute for the workload. A model may fit comfortably and still miss its latency target.</p><Sequence label="The screen" steps={[
        { name: 'Capacity', question: 'Does it fit at all?', detail: 'weights · cache · execution' },
        { name: 'Compatibility', question: 'Will it run on this stack?', detail: 'kernels · precision · attention' },
        { name: 'Performance', question: 'Is it fast enough?', detail: 'bandwidth · compute · batch' },
        { name: 'Operations', question: 'Can you keep it running?', detail: 'admission · failure · load' },
      ]}/><div className="takeaway"><div><h3>The engineering habit</h3><p>Start with a resource model, keep assumptions visible, and use measurements to improve that model. The goal is to understand why a system behaves as it does.</p></div></div><div className="lesson-sources"><span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span><a href="#example">Full worked calculation <ArrowUpRight size={13}/></a><a href="#sources">Pinned configurations and tensor indices <ArrowUpRight size={13}/></a></div></LessonSection>
    <a className="next-lesson" href="#hardware"><div><span className="eyebrow">UP NEXT · CHAPTER 02 · HARDWARE SPEED LIMITS</span><h3>Now put a clock on it.</h3><p>A model that fits still has a speed limit.</p></div><span className="next-arrow"><ArrowRight size={24}/></span></a>
  </div>;
}
