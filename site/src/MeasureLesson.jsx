import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Sequence from './Sequence';
import LessonSection from './LessonSection';
import StreamExplorer from './StreamExplorer';
import { MathFormula } from './Lesson';

export const measureToc = [
  { id: 'number-needs-a-boundary', label: 'A number needs a boundary' },
  { id: 'four-metrics', label: 'Four metrics, one stream' },
  { id: 'averages-hide', label: 'What averages hide' },
  { id: 'goodput', label: 'Goodput, not throughput' },
  { id: 'a-defensible-run', label: 'A defensible run' },
];

export function StreamArt() {
  const bars = [30, 34, 31, 33, 32, 34, 96, 33, 31, 34, 32, 30];
  return <div className="memory-art stream-art" role="img" aria-label="Twelve token gaps, steady except for one much longer bar.">
    <div className="art-grid"/>
    <span className="art-label top">ONE STREAM OF TOKENS</span>
    <div className="art-stream">{bars.map((h, i) => <i key={i} className={h > 60 ? 'stall' : ''} style={{ height: `${h}%` }}/>)}</div>
    <span className="art-label bottom"><i/> THE AVERAGE HIDES THE SPIKE</span>
  </div>;
}

export default function MeasureLesson() {
  return <div className="lesson-body">
    <LessonSection id="number-needs-a-boundary" number="01" label="THE FIFTH QUESTION" title="A number without a boundary is not a measurement." summary={[
      'Every serving metric depends on where you started and stopped the clock.',
      'The same run reported at the client and inside the engine gives different, both-correct numbers.',
    ]}>
      <p>Up to here every figure has been a prediction. Turning predictions into measurements sounds like the easy part, and it is where most published inference numbers quietly fall apart. Not because the timing is hard, but because a latency figure means nothing until you say what you started the clock on, what you stopped it on, and what else was running.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>A benchmark result is a claim about a workload on a configuration at a boundary. Drop any of those three and the number cannot be compared with anything, including itself next week.</p></div>
    </LessonSection>

    <LessonSection id="four-metrics" number="02" label="THE VOCABULARY" title="Four metrics, one stream." summary={[
      'TTFT measures the wait before anything appears.',
      'TPOT averages the gaps after that, dividing by gaps rather than by tokens.',
      'ITL is the individual gaps; throughput is tokens over a window.',
    ]}>
      <p>A streaming request produces one timestamp per output token, and every metric you will argue about is some reduction of that list. They are easy to define and easy to conflate, and the most common error has a fencepost in it.</p>
      <MathFormula legend={[
        [String.raw`t_{\text{TTFT}}`, 'send to first output token, at a declared boundary'],
        [String.raw`t_{\text{TPOT}}`, 'mean time per output token after the first'],
        [String.raw`\tau_i`, 'arrival time of output token i'],
        ['N', 'output tokens in the response'],
      ]} note="The divisor is N − 1 because N tokens have N − 1 gaps. Dividing by N is the usual mistake, and it flatters the result.">{String.raw`t_{\text{TTFT}} = \tau_1 - t_{\text{sent}} \qquad t_{\text{TPOT}} = \frac{\tau_N - \tau_1}{N - 1}`}</MathFormula>
      <p>One output token has a TTFT and no TPOT at all. Report it as undefined rather than zero, or short responses will drag your average toward a number nothing produced.</p>
    </LessonSection>

    <LessonSection id="averages-hide" number="03" label="SEE THE CONSEQUENCES" title="What the average hides." summary={[
      'A single stall is absorbed into TPOT and spread evenly over every token.',
      'The reported shape is smooth; the experienced shape is not.',
      'Keep the individual gaps, or you cannot see the thing users complain about.',
    ]}>
      <p>TPOT is a mean, and means are lossy in a specific direction: they turn one bad moment into a small penalty everywhere. That matters here because users do not experience the mean. They experience the pause.</p>
      <StreamExplorer figure="09"/>
      <p>Drag the stall up and watch TPOT drift while the stream itself stays steady except for one gap. Anyone reading only TPOT sees a slightly slower model. Anyone watching the output sees it freeze. Those are the same run.</p>
    </LessonSection>

    <LessonSection id="goodput" number="04" label="THE NUMBER THAT MATTERS" title="Goodput, not throughput." summary={[
      'Throughput counts tokens; goodput counts requests that met every limit at once.',
      'Each limit passes more often alone than the limits pass together.',
      'Percentile SLOs describe the population; goodput describes served requests. Report both.',
    ]}>
      <p>Throughput is the number most readily quoted and the least connected to whether anyone was served well. A server can post excellent aggregate tokens per second while a third of its requests miss their latency targets. Chapter two showed exactly how, since batching buys throughput by spending per-sequence speed.</p>
      <p>Goodput fixes the accounting. A request counts only if it satisfied <em>every</em> stated limit. Switch to the goodput tab above and move the two limits: each one passes on its own more often than both pass together, and the joint number is the one that maps onto a user's experience.</p>
      <div className="key-idea warning"><p><b>Do not mix these two</b><br/>“P90 TTFT under 300 ms” is a statement about the population. “90% goodput at TTFT ≤ 300 ms and TPOT ≤ 80 ms” is a statement about individual requests meeting a joint condition. They answer different questions and they are not interchangeable.</p></div>
    </LessonSection>

    <LessonSection id="a-defensible-run" number="05" label="TAKE THE NEXT STEP" title="What makes a run defensible." summary={[
      'State the workload, the configuration, the boundary, and the arrival pattern.',
      'Keep raw per-token timestamps; every metric here is derived from them.',
      'Compare against your own baseline, not against someone else’s hardware.',
    ]}>
      <p>A result worth keeping records enough to be rerun: the exact tokenized workload and its length distribution, the engine version and every flag, the hardware and its topology, the arrival pattern, the concurrency, the measurement boundary, and the raw timestamps. All the metrics on this page are derived, so if you keep the timestamps you can recompute any of them later, including ones you did not think to report.</p>
      <Sequence label="The measurement" steps={[
        { name: 'Workload', question: 'What are you sending?', detail: 'prompts · concurrency · lengths' },
        { name: 'Boundary', question: 'Where is the clock?', detail: 'client · gateway · server' },
        { name: 'Raw timestamps', question: 'What did you actually record?', detail: 'arrival times, per token' },
        { name: 'Derived metrics', question: 'What do they mean?', detail: 'TTFT · TPOT · ITL · goodput' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>Keep the raw timestamps. Every argument about which metric to use is recoverable from them, and no argument is recoverable from a summary someone already averaged.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#benchmarking">Our benchmark methodology <ArrowUpRight size={13}/></a>
        <a href="#equations">Metric definitions on the cheatsheet <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#profile">
      <div><span className="eyebrow">UP NEXT · CHAPTER 06 · FINDING THE BOTTLENECK</span><h3>Now find out why.</h3><p>A slow server has many possible causes. Narrow them with evidence.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
