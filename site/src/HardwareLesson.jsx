import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import BandwidthExplorer from './BandwidthExplorer';
import Sequence from './Sequence';
import LessonSection from './LessonSection';
import { MathFormula } from './Lesson';

export const hardwareToc = [
  { id: 'fitting-is-not-fast', label: 'Fitting is not fast' },
  { id: 'three-rates', label: 'Three rates, one step' },
  { id: 'decode-step', label: 'Time a decode step' },
  { id: 'not-one-memory', label: 'Not all memory is one' },
  { id: 'bound-vs-measurement', label: 'A bound is not a measurement' },
];

export function RateArt() {
  const rungs = [
    { label: 'LOCAL HBM', value: '4,900', unit: 'GB/s', width: 100 },
    { label: 'NVLINK-C2C', value: '900', unit: 'GB/s ⇄', width: 38 },
    { label: 'GRACE LPDDR', value: 'n/a', unit: 'not pinned', width: 62, unknown: true },
  ];
  return <div className="memory-art rate-art" role="img" aria-label="A ladder of memory paths: local HBM is the fastest, NVLink-C2C is quoted bidirectionally, and the Grace LPDDR rate is not pinned in our reference.">
    <div className="art-grid"/>
    <span className="art-label top">ONE ADDRESS SPACE</span>
    <div className="rate-rungs">{rungs.map(r => <div className={`rate-rung ${r.unknown ? 'unknown' : ''}`} key={r.label}>
      <small>{r.label}</small>
      <span className="rung-bar" style={{ width: `${r.width}%` }}/>
      <b>{r.value} <i>{r.unit}</i></b>
    </div>)}</div>
    <span className="art-label bottom"><i/> THREE VERY DIFFERENT RATES</span>
  </div>;
}

export default function HardwareLesson() {
  return <div className="lesson-body">
    <LessonSection id="fitting-is-not-fast" number="01" label="THE SECOND QUESTION" title="Fitting is not being fast." summary={[
      'Capacity is an amount and has a yes or no answer. Latency is set by rates.',
      'A model can settle comfortably into a device and still miss its latency target.',
    ]}>
      <p>Chapter one asked whether the weights, the live state, and the engine could be placed at all. That question has a yes or a no. Speed does not work that way. Capacity is an amount, and the numbers that decide latency are rates: bytes per second, operations per second. A model can settle comfortably into a device and still miss its latency target by a wide margin.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>Capacity decides whether the work can be placed. Bandwidth decides how long each step takes once it is.</p></div>
    </LessonSection>

    <LessonSection id="three-rates" number="02" label="READ THE MACHINE AS RATES" title="Three rates. One step." summary={[
      'Compute, local memory, and links each have their own ceiling.',
      'The step cannot finish before the slowest of the three, and that maximum is still optimistic.',
      'Decode reads every resident weight but computes little with each, so it leans on memory.',
    ]}>
      <p>A decode step reads tensors, does arithmetic on them, and sometimes moves results between devices. Each of those has its own ceiling, and the step cannot finish before the slowest of them is done.</p>
      <div className="memory-parts">
        {[{name: 'Compute', text: 'Operations per second at the precision the kernel actually executes, which is not always the precision the checkpoint was stored in.', label: 'Rarely the decode limit', kind: 'weights' },
          {name: 'Local memory', text: 'Bytes per second between the accelerator and its own HBM or GDDR. Every weight and every cached token crosses this each step.', label: 'Usually the decode limit', kind: 'state' },
          {name: 'Links', text: 'Bytes per second between devices, or between a GPU and host memory. It matters as soon as the model is sharded or offloaded.', label: 'Depends on placement', kind: 'runtime' }].map(({ Icon, ...p }) =>
          <div className={`memory-part ${p.kind}`} key={p.name}><h3>{p.name}</h3><p>{p.text}</p><span>{p.label}</span></div>)}
      </div>
      <MathFormula legend={[
        [String.raw`t_{\text{step}}`, 'seconds for one decode step, the quantity you are trying to bound'],
        [String.raw`N_{\text{ops}}`, 'arithmetic operations the step performs'],
        [String.raw`C_{\text{eff}}`, 'operations per second the device actually sustains at the executed precision'],
        [String.raw`Q_{\text{HBM}}`, 'bytes moved between the accelerator and its own memory'],
        [String.raw`B_{\text{HBM}}`, 'bytes per second that local memory actually sustains'],
        [String.raw`Q_{\text{link}}`, 'bytes moved across a device-to-device or host link'],
        [String.raw`B_{\text{link}}`, 'bytes per second that link actually sustains, one-way'],
      ]} note="Each fraction is bytes ÷ (bytes per second), or operations ÷ (operations per second), so all three are times. Every rate is effective, not advertised.">{String.raw`t_{\text{step}} \geq \max\!\left(\frac{N_{\text{ops}}}{C_{\text{eff}}},\; \frac{Q_{\text{HBM}}}{B_{\text{HBM}}},\; \frac{Q_{\text{link}}}{B_{\text{link}}}\right)`}</MathFormula>
      <p className="caption">The maximum is still optimistic: serial stages, kernel launches, and imperfect overlap only add time.</p>
      <div className="key-idea"><p><b>Why decode leans on memory</b><br/>Generating one token touches every resident weight but does very little arithmetic with each one. The step spends its time reading, not calculating, which is why batching, not a faster clock, is the usual lever.</p></div>
    </LessonSection>

    <LessonSection id="decode-step" number="03" label="SEE THE CONSEQUENCES" title="Put a clock on one step." summary={[
      'Traffic per step divided by achieved bandwidth gives a floor under the step time.',
      'Batching shares the weight read across sequences; it never shares the cache read.',
      'Interactive: four checkpoints, six devices, context and batch you set yourself.',
    ]}>
      <p>Decode is the memory term, so drop the other two. Take the traffic a single step has to move, divide by what the device can actually sustain, and you have a floor under the step time.</p>
      <MathFormula legend={[
        [String.raw`t_{\text{step}}`, 'seconds for one decode step'],
        [String.raw`M_{\text{weights}}`, 'bytes of resident weights, read once per step however many sequences are in flight'],
        [String.raw`M_{\text{cache},i}`, 'bytes of live cache for sequence i, read once per step; nobody shares this one'],
        ['N', 'sequences in flight, each emitting one token per step'],
        [String.raw`B_{\text{peak}}`, 'advertised peak memory bandwidth of the device, in bytes per second'],
        [String.raw`\eta`, 'the fraction of peak you actually achieve; your assumption, set by the “Achieved bandwidth” control'],
        [String.raw`R_{\text{total}}`, 'output rate across all sequences, in tokens per second'],
      ]} note="Any one sequence sees at most one token per step, however many others are running, so its own rate is just the reciprocal of the step time.">{String.raw`\begin{aligned} t_{\text{step}} &\geq \frac{M_{\text{weights}} + \sum_{i=1}^{N} M_{\text{cache},i}}{\eta\, B_{\text{peak}}} \\[6pt] R_{\text{total}} &\leq \frac{N}{t_{\text{step}}} \end{aligned}`}</MathFormula>
      <p>Now watch what batching does to those two lines. Adding a sequence adds its cache to the numerator of the first, and adds a token to the numerator of the second. The weight read is the one term that does not grow, which is the whole reason batching pays.</p>
      <BandwidthExplorer figure="03"/>
      <p>Raise the context far enough and the cache read overtakes the weight read. At that point extra batch size stops buying throughput, because the traffic it adds grows just as fast as the tokens it emits.</p>
    </LessonSection>

    <LessonSection id="not-one-memory" number="04" label="CONNECT TOPOLOGY TO TIME" title="Not all memory is one memory." summary={[
      'Unified addressing makes remote memory reachable, not equally fast.',
      'NVLink-C2C is quoted bidirectionally: halve 900 GB/s before using it one-way.',
      'The Grace LPDDR bandwidth is left unpinned on purpose, because we have not verified it.',
    ]}>
      <p>Unified addressing makes remote memory reachable, not equally fast. On a Grace Hopper superchip the accelerator can read Grace LPDDR as easily as its own HBM, and it will wait a great deal longer to do it. Coherence is a programming convenience, not a performance guarantee.</p>
      <div className="rate-ladder">
        <div className="chart-title"><span>The same pointer, three different waits.</span><span>PINNED FIGURES · HARDWARE REFERENCE</span></div>
        <div className="ladder-row">
          <div><b>Local HBM</b><small>GH200 HBM3e variant</small></div>
          <div className="ladder-track"><span style={{ width: '100%' }}/></div>
          <span>up to 4,900 <small>GB/s</small></span>
        </div>
        <div className="ladder-row">
          <div><b>NVLink-C2C</b><small>GPU to its own Grace CPU</small></div>
          <div className="ladder-track"><span style={{ width: '38%' }}/></div>
          <span>up to 900 <small>GB/s ⇄</small></span>
        </div>
        <div className="ladder-row unknown">
          <div><b>Grace LPDDR</b><small>up to 480 GB per superchip</small></div>
          <div className="ladder-track"><span className="hatched" style={{ width: '62%' }}/></div>
          <span>not pinned <small>here</small></span>
        </div>
        <p>The third rate is missing on purpose. Our reference pins the LPDDR <em>capacity</em>, not its bandwidth, and the honest move is to leave the gap visible until the benchmark guide or a measurement fills it.</p>
      </div>
      <div className="key-idea warning"><p><b>The 900 GB/s trap</b><br/>NVIDIA quotes NVLink-C2C bidirectionally. Halve it before using it as a one-way streaming rate, and never treat it as DRAM bandwidth. Getting this wrong makes an offload design look roughly twice as good on paper as it will ever be in practice.</p></div>
      <p>So before trusting any placement, ask what the runtime actually does with a remote tensor. Explicit copies, device reads of host-resident weights, page migration, and CPU computation are four different bottlenecks wearing the same label.</p>
    </LessonSection>

    <LessonSection id="bound-vs-measurement" number="05" label="TAKE THE NEXT STEP" title="A bound is not a measurement." summary={[
      'A bound tells you which resource to suspect, and roughly by how much.',
      'Predict the number before running anything; the gap to the measurement is the lesson.',
    ]}>
      <p>Everything on this page is arithmetic over advertised numbers. It is useful for exactly one thing: telling you which resource to suspect, and by roughly how much, before you have hardware. A step that comes in near the bound tells you the model of the machine was about right. A step that comes in far above it is the interesting case, and the beginning of the next investigation.</p>
      <Sequence label="The investigation" steps={[
        { name: 'Capacity',      question: 'What can fit?',          detail: 'weights · cache · execution' },
        { name: 'Rate bound',    question: 'What is possible?',      detail: 'bytes per step · bandwidth' },
        { name: 'Compatibility', question: 'Can it actually run?',   detail: 'kernels · precision · topology' },
        { name: 'Measurement',   question: 'What happened?',         detail: 'timestamps · profiles · traces' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>Predict the bound before you run anything. Write the number down. The gap between that number and the measurement is where the real understanding of the system lives.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#hardware-reference">Pinned device table and topology notes <ArrowUpRight size={13}/></a>
        <a href="#equations">Performance bounds on the cheatsheet <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#reuse">
      <div><span className="eyebrow">UP NEXT · CHAPTER 03 · PREFILL, DECODE AND REUSE</span><h3>Now ask who shares the read.</h3><p>The same weights, spread across very different token counts.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
