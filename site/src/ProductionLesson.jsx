import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Sequence from './Sequence';
import LessonSection from './LessonSection';

export const productionToc = [
  { id: 'design-is-a-claim', label: 'A design is a set of claims' },
  { id: 'the-chain', label: 'The chain, end to end' },
  { id: 'the-register', label: 'Your uncertainty register' },
  { id: 'failure-first', label: 'Design for the bad day' },
  { id: 'what-remains', label: 'What remains unproven' },
];

export function CapstoneArt() {
  return <div className="memory-art capstone-art" role="img" aria-label="Nine chapters stacked into one design.">
    <div className="art-grid"/>
    <span className="art-label top">NINE QUESTIONS</span>
    <div className="art-stack-rows">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ width: `${44 + i * 6}%` }}/>)}</div>
    <span className="art-label bottom"><i/> ONE DEFENSIBLE DESIGN</span>
  </div>;
}

/** The chapters as a checklist, each carrying what it can and cannot establish. */
const CHAIN = [
  { n: '01', q: 'Will it fit?', settles: 'Weights, state and execution memory against real per-device capacity.', open: 'Fitting says nothing about speed.', href: '#feasibility' },
  { n: '02', q: 'How fast can it possibly go?', settles: 'A floor under the decode step from memory traffic and bandwidth.', open: 'A bound is not a measurement.', href: '#hardware' },
  { n: '03', q: 'Who shares the weights?', settles: 'Arithmetic intensity, and what batching does to a sparse checkpoint.', open: 'Real routing is not uniform.', href: '#reuse' },
  { n: '04', q: 'What does the engine do?', settles: 'Block allocation, and what a prefix cache hit actually saves.', open: 'Eviction and admission behaviour under real load.', href: '#engine' },
  { n: '05', q: 'What did you measure?', settles: 'TTFT, TPOT, ITL and goodput at a declared boundary.', open: 'Numbers require hardware to collect.', href: '#measure' },
  { n: '06', q: 'Why is it slow?', settles: 'A differential, and the test that separates its candidates.', open: 'Requires a running system to discriminate.', href: '#profile' },
  { n: '07', q: 'How many devices?', settles: 'What each strategy shards, and what it charges per step.', open: 'Measured collective cost on the real topology.', href: '#parallel' },
  { n: '08', q: 'How small can the weights go?', settles: 'Stored bytes including scales, and where execution precision differs.', open: 'Quality, which needs a matched evaluation.', href: '#quantize' },
  { n: '09', q: 'Should it guess ahead?', settles: 'The break-even acceptance rate for a given cost structure.', open: 'Acceptance on your own workload at your own concurrency.', href: '#speculate' },
];

function DesignChecklist() {
  const [done, setDone] = useState([]);
  const toggle = n => setDone(v => (v.includes(n) ? v.filter(x => x !== n) : [...v, n]));
  return <div className="explorer checklist-explorer">
    <div className="explorer-heading">
      <div><span>Deployment design checklist</span></div>
      <span className="small-badge">{done.length} OF {CHAIN.length} ANSWERED</span>
    </div>
    <div className="checklist">
      {CHAIN.map(item => <div key={item.n} className={`checklist-row ${done.includes(item.n) ? 'done' : ''}`}>
        <button onClick={() => toggle(item.n)} aria-pressed={done.includes(item.n)} aria-label={`Mark ${item.q} answered`}>
          <span className="checklist-n">{item.n}</span>
          <span className="checklist-box"/>
        </button>
        <div>
          <a href={item.href}><b>{item.q}</b></a>
          <p><span className="settles">Settles:</span> {item.settles}</p>
          <p><span className="open">Still open:</span> {item.open}</p>
        </div>
      </div>)}
    </div>
    <div className="assumptions">
      <div>
        <p>Ticking every box does not produce a validated deployment. It produces a design whose assumptions are written down, which is the thing you can hand to a reviewer, and the thing you can compare measurements against once hardware exists.</p>
        <p>This checklist is scoped to what this workspace has actually built. Tokenizer behaviour, request routing, multi-tenancy, cost, and safety are all real deployment concerns and none of them appear here.</p>
      </div>
    </div>
  </div>;
}

export default function ProductionLesson() {
  return <div className="lesson-body">
    <LessonSection id="design-is-a-claim" number="01" label="THE TENTH QUESTION" title="A design is a set of claims you can be wrong about." summary={[
      'Every choice in a serving design rests on an assumption that could fail.',
      'A reviewable design names those assumptions instead of burying them.',
    ]}>
      <p>The nine chapters before this each answered one question and left something open. A deployment design is what you get when you chain them together and are honest about the joints. The goal is not a configuration that works, since you cannot know that yet, but a configuration whose reasoning someone else can check, and whose failure modes you have already named.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>“It works on my benchmark” and “I know why it works” are different states. Only the second one survives a new model, a new workload, or a bad night.</p></div>
    </LessonSection>

    <LessonSection id="the-chain" number="02" label="SEE THE CONSEQUENCES" title="The chain, end to end." summary={[
      'Nine questions, each settling something and leaving something open.',
      'The open items are the ones that need hardware, and they are the honest scope of what remains.',
    ]}>
      <p>Here is the whole field guide as a working checklist. Each row records what that chapter can settle from analysis alone, and what it explicitly cannot. Tick the ones you could answer today for a model you actually care about.</p>
      <DesignChecklist/>
      <p>The right-hand column is the useful half. Every item there is a measurement waiting for hardware, and together they are a precise statement of what this workspace has not yet proven.</p>
    </LessonSection>

    <LessonSection id="the-register" number="03" label="WHAT TO WRITE DOWN" title="Keep an uncertainty register." summary={[
      'For each assumption: what you assumed, why, what would change it, and what it would cost if wrong.',
      'Reviewers can only challenge assumptions you have written down.',
    ]}>
      <p>Every interactive example in this guide carries an assumptions block, and that is the habit scaled down to one component. Scaled up, it is a register: a list of the things your design depends on that you have not verified, each with the observation that would settle it.</p>
      <p>The workspace already keeps one of these. The decision notes record why GH200 is a case study rather than a target, why the reuse model assumes uniform routing, why DeepSeek's expert precision is a labelled assumption rather than a fact, and what evidence would change each. That format transfers directly to a deployment.</p>
      <div className="key-idea"><p><b>The register is not a disclaimer</b><br/>It is a work queue, ordered by how much a wrong assumption would cost. The top entry is what you measure first when hardware arrives.</p></div>
    </LessonSection>

    <LessonSection id="failure-first" number="04" label="THE PART THAT BITES" title="Design for the bad day, not the demo." summary={[
      'Decide what happens when the cache is full, a device fails, or load doubles.',
      'Admission control is a design choice; without one, overload is decided by luck.',
    ]}>
      <p>A serving design that only describes the happy path is unfinished. Three questions are worth answering before deployment rather than during an incident. What happens when the cache pool is exhausted: preempt, queue, or reject? What happens when load exceeds capacity: degrade latency for everyone, or protect a subset and shed the rest? What happens when one device in a sharded group fails?</p>
      <p>The last one matters more than it looks. Chapter seven's collectives mean a tensor-parallel group is a single failure domain: lose one rank and the group stops, not degrades. That is a deliberate trade for capacity, and it should be a decision rather than a discovery.</p>
      <div className="key-idea warning"><p><b>Overload without admission control</b><br/>If nothing rejects requests, an overloaded server degrades everyone's latency together until nobody is inside their SLO. Goodput goes to zero while throughput still looks respectable: chapter five's distinction, in its most expensive form.</p></div>
    </LessonSection>

    <LessonSection id="what-remains" number="05" label="WHERE THIS ENDS" title="What this guide has not proven." summary={[
      'Every number here is analytical: pinned metadata, arithmetic, and inspected source.',
      'No model has been served, no benchmark run, and no performance claim made.',
      'That is the correct state, and the boundary is the point.',
    ]}>
      <p>It is worth saying plainly at the end. Nothing in these ten chapters is a benchmark result. The figures come from pinned configurations, tensor indices, inspected engine source, and arithmetic over those, each labelled with what kind of claim it is. No model has been loaded, no GPU has been measured, and no improvement has been demonstrated.</p>
      <p>That boundary is not a gap in the work; it is the work. An engineer who can predict a system's behaviour and say exactly which predictions remain untested is in a far better position than one holding benchmark numbers they cannot explain. When hardware arrives, every open item above becomes a specific experiment with a prediction already written down.</p>
      <Sequence label="The loop" steps={[
        { name: 'Analysis', question: 'What does the arithmetic say?', detail: 'bounds, from pinned numbers' },
        { name: 'Prediction', question: 'Write it down before you run.', detail: 'a number you can be wrong about' },
        { name: 'Measurement', question: 'What happened?', detail: 'same workload, real hardware' },
        { name: 'Revised model', question: 'What did the gap teach you?', detail: 'the model, not the excuse' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>Write the prediction before the measurement, and keep both. The gap between them is the only thing that ever taught anyone how a system really works.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#decisions">The decision register <ArrowUpRight size={13}/></a>
        <a href="#queue">The open investigation queue <ArrowUpRight size={13}/></a>
        <a href="#roadmap">The learning path <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#queue">
      <div><span className="eyebrow">WHERE TO GO NEXT</span><h3>The open questions.</h3><p>What needs hardware, and what to measure first when it arrives.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
