import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Sequence from './Sequence';
import LessonSection from './LessonSection';
import SpeculateExplorer from './SpeculateExplorer';
import SpeculateAnimation from './SpeculateAnimation';
import { MathFormula } from './Lesson';

export const speculateToc = [
  { id: 'spare-bandwidth', label: 'Spending spare compute' },
  { id: 'the-condition', label: 'The break-even condition' },
  { id: 'see-it-turn', label: 'Watch it turn negative' },
  { id: 'load-changes-it', label: 'Load changes the answer' },
  { id: 'measure-acceptance', label: 'Measure your acceptance' },
];

export function SpeculateArt() {
  const heights = [100, 82, 66, 52, 100];
  return <div className="memory-art speculate-art" role="img" aria-label="Four drafted tokens with decaying acceptance, and one verified token.">
    <div className="art-grid"/>
    <span className="art-label top">FOUR GUESSES, ONE CERTAINTY</span>
    <div className="art-drafts">{heights.map((h, i) => <i key={i} className={i === 4 ? 'verified' : ''} style={{ height: `${h}%` }}/>)}</div>
    <span className="art-label bottom"><i/> EACH ONE NEEDS THE LAST</span>
  </div>;
}

export default function SpeculateLesson() {
  return <div className="lesson-body">
    <LessonSection id="spare-bandwidth" number="01" label="THE NINTH QUESTION" title="Decode leaves the machine half idle." summary={[
      'A memory-bound decode step has arithmetic capacity going spare.',
      'Speculation spends that spare capacity on guesses, and verifies them in one pass.',
    ]}>
      <p>Chapter three established that decode is bandwidth-bound: the step reads every resident weight and does very little arithmetic with each one. That means the compute units are idle for much of the step. Speculation is the idea of spending that idle capacity on guessing several tokens ahead, then checking them all in a single pass of the real model.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>Verification of k draft tokens costs roughly one ordinary step, because the same weights are read once. That is the entire source of the win, and it is why the technique is bandwidth arithmetic rather than a modelling trick.</p></div>
    </LessonSection>

    <LessonSection id="the-condition" number="02" label="THE ARITHMETIC" title="The condition is an inequality, not a feature flag." summary={[
      'Drafted tokens only count if every token before them was also accepted.',
      'Expected acceptance is therefore a geometric sum, not a simple multiple.',
      'Verification yields one correct token even when every draft is rejected.',
    ]}>
      <p>The drafts form a chain. The second guess only helps if the first was right, the third only if the first two were, and so on. That makes the expected yield a truncated geometric series rather than the acceptance rate times the draft length, a distinction that matters a great deal once acceptance drops.</p>
      <MathFormula legend={[
        [String.raw`\mathbb{E}[a]`, 'expected accepted draft tokens in one round'],
        ['k', 'draft length: tokens guessed before verifying'],
        ['p', 'acceptance rate: probability one drafted token survives verification'],
        [String.raw`t_{\text{draft}}`, 'cost of producing one draft token, in ordinary decode steps'],
        [String.raw`t_{\text{verify}}`, 'cost of verifying the whole draft, roughly one ordinary step'],
        [String.raw`t_{\text{step}}`, 'the ordinary decode step this is competing against'],
      ]} note="The +1 is the token verification produces regardless. Speculation pays when the left side is smaller.">{String.raw`\mathbb{E}[a] = \sum_{i=1}^{k} p^{\,i} \qquad \frac{k\,t_{\text{draft}} + t_{\text{verify}}}{\mathbb{E}[a] + 1} \;<\; t_{\text{step}}`}</MathFormula>
    </LessonSection>

    <LessonSection id="see-it-turn" number="03" label="SEE THE CONSEQUENCES" title="Watch it turn negative." summary={[
      'At high acceptance, longer drafts pay more.',
      'At low acceptance, longer drafts actively cost more: you pay to generate tokens you throw away.',
      'There is a specific acceptance rate below which the feature is a slowdown.',
    ]}>
      <p>Set acceptance high and lengthen the draft: the speedup climbs. Now drop acceptance and lengthen it again. The same control that helped now hurts, because every extra drafted token costs time and returns almost nothing.</p>
      <SpeculateExplorer figure="15"/>
      <p>The break-even acceptance rate is the number worth carrying away. Below it, turning speculation on makes your server slower while every dashboard still shows it working exactly as designed.</p>
      <p>The arithmetic is easier to trust once you have watched a round happen. Step through one: four guesses, one verification pass, and a commit that keeps the accepted prefix and discards everything after the first mistake.</p>
      <SpeculateAnimation figure="16"/>
      <p>Drag acceptance to zero and step through again. Every draft is thrown away, and the round still emits one token, since the verification pass produces it regardless. That floor is why speculation degrades gracefully instead of failing, and why a low acceptance rate costs you time rather than correctness.</p>
    </LessonSection>

    <LessonSection id="load-changes-it" number="04" label="THE PART THAT BITES" title="The answer changes with load." summary={[
      'Speculation trades spare compute for tokens, and at high batch there is no spare compute.',
      'A feature that helps a single user can hurt a loaded server.',
    ]}>
      <p>Everything above assumed idle arithmetic capacity to spend. Chapter three showed that batching fills exactly that capacity: more tokens per step means more arithmetic per weight read. So the conditions that make speculation profitable are the conditions of a lightly loaded server, and they disappear as concurrency rises.</p>
      <div className="key-idea warning"><p><b>Benchmark it at your real concurrency</b><br/>Speculation benchmarked at batch one and deployed at batch thirty-two is one of the more reliable ways to make a system slower while holding a measurement that says otherwise. The draft model also consumes memory and bandwidth that the target model would otherwise have had.</p></div>
      <p>There is a scheduling consequence too. Verification produces a variable number of tokens per round, so batch composition changes step to step, and that variance shows up as the spiky inter-token latency chapter five taught you to look for.</p>
    </LessonSection>

    <LessonSection id="measure-acceptance" number="05" label="TAKE THE NEXT STEP" title="Measure acceptance on your own workload." summary={[
      'Acceptance is workload-specific and cannot be borrowed from a published number.',
      'Compare speculation on and off at the concurrency you actually serve.',
    ]}>
      <p>Acceptance depends on the draft model, the target model, the prompt distribution, the sampling temperature, and how much context is shared between requests. It is not a property of the technique. The measurement worth running is the plainest possible one: the same workload at the same concurrency, with the feature off and on, reporting acceptance alongside the latency change so the result explains itself.</p>
      <Sequence label="Deciding on speculation" steps={[
        { name: 'Break-even rate', question: 'What acceptance do you need?', detail: 'draft length · verify cost' },
        { name: 'Measured acceptance', question: 'What do you actually get?', detail: 'on your prompts, your drafter' },
        { name: 'Off/on at real load', question: 'Does it still pay when busy?', detail: 'spare compute disappears' },
        { name: 'Keep or drop', question: 'One decision, written down.', detail: 'with the load it assumed' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>Compute the break-even acceptance before enabling the feature. It converts an open-ended tuning exercise into a single measurement with a threshold to compare against.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#equations">The break-even condition <ArrowUpRight size={13}/></a>
        <a href="#queue">Open questions on speculation <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#production">
      <div><span className="eyebrow">UP NEXT · CHAPTER 10 · THE DEPLOYMENT</span><h3>Now put it all together.</h3><p>One design, with its uncertainties written down.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
