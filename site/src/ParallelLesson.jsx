import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import PlacementScene from './PlacementScene';
import Sequence from './Sequence';
import LessonSection from './LessonSection';
import PlacementExplorer from './PlacementExplorer';
import { MathFormula } from './Lesson';

export const parallelToc = [
  { id: 'more-memory-is-not-faster', label: 'More memory is not faster' },
  { id: 'what-each-divides', label: 'What each strategy divides' },
  { id: 'place-it', label: 'Place it across devices' },
  { id: 'the-charge', label: 'What sharding charges' },
  { id: 'choose-a-placement', label: 'Choosing a placement' },
];

export function GridArt() {
  return <div className="memory-art grid-art" role="img" aria-label="Four devices holding shards of one model, linked in a ring.">
    <div className="art-grid"/>
    <span className="art-label top">ONE MODEL, FOUR DEVICES</span>
    <div className="art-devices">{[0, 1, 2, 3].map(i => <span key={i}><i/><small>{i}</small></span>)}</div>
    <span className="art-label bottom"><i/> EVERY LAYER, THEY SYNCHRONISE</span>
  </div>;
}

export default function ParallelLesson() {
  return <div className="lesson-body">
    <LessonSection id="more-memory-is-not-faster" number="01" label="THE SEVENTH QUESTION" title="More aggregate memory is not more speed." summary={[
      'Adding devices adds capacity, and adds communication on the critical path.',
      'A model that now fits can still be slower than one that already fitted.',
    ]}>
      <p>Chapter one's screen was a capacity question, and adding devices answers it: eight devices hold eight times the bytes. That is where the intuition stops being safe. Sharding a model does not simply divide the work; it introduces a point in every layer where every device must wait for the others, and that wait sits directly on the path of every token you generate.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>Parallelism buys capacity reliably and latency conditionally. The capacity arrives the moment you add the device; the latency improvement has to beat the communication you just added.</p></div>
    </LessonSection>

    <LessonSection id="what-each-divides" number="02" label="THE THREE AXES" title="Each strategy divides something different." summary={[
      'Tensor parallel splits the layers themselves, and communicates inside every one.',
      'Data parallel replicates the whole model and communicates not at all.',
      'Expert parallel spreads a sparse model’s experts, and routes tokens to them.',
    ]}>
      <p>The names describe what gets cut, and the cut determines the bill. It is worth being precise, because the three are routinely combined and their costs do not combine the same way.</p>
      <div className="memory-parts">
        {[{name: 'Tensor parallel', text: 'Every weight matrix is split across devices, so each holds a fraction of every layer. Cache splits along its head dimension too.', label: 'Communicates every layer', kind: 'weights' },
          {name: 'Data parallel', text: 'Each device holds a complete replica and serves its own requests independently. Nothing is shared during a step.', label: 'Multiplies memory', kind: 'state' },
          {name: 'Expert parallel', text: 'A sparse model’s experts are distributed, and tokens travel to whichever device owns the expert they routed to.', label: 'Communicates per MoE layer', kind: 'runtime' }].map(({ Icon, ...p }) =>
          <div className={`memory-part ${p.kind}`} key={p.name}><h3>{p.name}</h3><p>{p.text}</p><span>{p.label}</span></div>)}
      </div>
      <MathFormula legend={[
        [String.raw`M_{\text{device}}`, 'bytes each device must hold'],
        ['W', 'total resident weight bytes of the checkpoint'],
        ['D', 'devices participating'],
        ['s', 'shard count: D when sharding, 1 when replicating'],
        ['r', 'cache replicas, forced above 1 once D exceeds the stored KV heads'],
        [String.raw`M_{\text{cache}}`, 'bytes of live cache for one copy of the workload'],
      ]} note="Chapter one's execution term still applies to every device here and is not in this formula.">{String.raw`M_{\text{device}} = \frac{W}{s} + \frac{r\, M_{\text{cache}}}{D}`}</MathFormula>
      <p>The formula is short; its consequence is not. Walk it up a device ladder and the second term turns around halfway.</p>
      <PlacementScene figure="11"/>
    </LessonSection>

    <LessonSection id="place-it" number="03" label="SEE THE CONSEQUENCES" title="Place it across devices." summary={[
      'Watch per-device memory fall while aggregate weights stay fixed, or multiply under replication.',
      'Past the stored KV head count, tensor parallelism replicates the cache instead of splitting it.',
    ]}>
      <p>Put GLM on eight devices and it fits comfortably. Switch to data parallel and the aggregate weight memory multiplies by eight while each device holds exactly what it held before. Then push the device count past the stored KV heads and watch something less obvious happen.</p>
      <PlacementExplorer figure="12"/>
      <p>That last effect catches people out. A checkpoint with eight stored KV heads cannot split its cache more than eight ways. Go to sixteen devices and the heads are replicated, so aggregate cache memory doubles: you added hardware and spent more total memory on the same workload.</p>
    </LessonSection>

    <LessonSection id="the-charge" number="04" label="WHAT IT COSTS" title="The charge is on the critical path." summary={[
      'Tensor parallel communication happens inside each layer, so nothing can overlap it away.',
      'Chapter two’s link bound applies here, one-way and effective, not the bidirectional headline.',
      'Every rank waits for the slowest, so variance costs more than the mean.',
    ]}>
      <p>Communication that overlaps with computation is nearly free. Tensor-parallel collectives are the other kind: the layer's output genuinely depends on every shard's contribution, so the step cannot proceed until the slowest rank arrives. That is the definition of critical path.</p>
      <p>Chapter two's third term is the one to reach for, with its warning attached. A link quoted at 900 GB/s bidirectional is not 900 GB/s of one-way streaming, and the effective rate you achieve is lower again. Halve before you estimate, and treat the result as a bound rather than a plan.</p>
      <div className="key-idea warning"><p><b>Why the slowest rank sets the pace</b><br/>With a collective in every layer, each rank waits for the others many times per step. A single consistently slow device (a different clock, a hotter part, an unlucky placement in the topology) sets the rate for the whole group, and it will not show up in an average.</p></div>
    </LessonSection>

    <LessonSection id="choose-a-placement" number="05" label="TAKE THE NEXT STEP" title="Choosing a placement, and proving it." summary={[
      'Use the smallest shard count that fits with real headroom.',
      'Compare shard counts one factor at a time, on identical workloads.',
    ]}>
      <p>The default worth starting from is the smallest tensor-parallel degree where the model fits with genuine headroom for activations and the engine's own reserve, with data parallelism above that for throughput. Expert parallelism enters when the model is sparse enough that its experts dominate, which chapter three gave you the arithmetic to check.</p>
      <p>Proving it is chapter six's discipline applied to one factor. Run the same workload at two shard counts that both fit. If the larger one is slower, communication is charging more than parallelism pays, and you now have evidence rather than a preference.</p>
      <Sequence label="Choosing a placement" steps={[
        { name: 'Does it fit?', question: 'Per device, not in aggregate.', detail: 'weights ÷ shards + cache' },
        { name: 'With headroom?', question: 'Leave room for the rest.', detail: 'activations · workspace · reserve' },
        { name: 'A/B shard counts', question: 'Two counts that both fit.', detail: 'same workload, same run' },
        { name: 'Keep the smaller', question: 'If the larger is not faster.', detail: 'communication charged per step' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>Reach for the smallest placement that fits comfortably. Every extra rank is another device that everyone else waits for, and the cost of that does not appear in any capacity calculation.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#hardware-reference">Device capacities and interconnect notes <ArrowUpRight size={13}/></a>
        <a href="#models">Stored KV heads per checkpoint <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#quantize">
      <div><span className="eyebrow">UP NEXT · CHAPTER 08 · QUANTIZATION</span><h3>Now make the bytes smaller.</h3><p>Stored precision, executed precision, and the gap between them.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
