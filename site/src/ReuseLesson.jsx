import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import PhaseScene from './PhaseScene';
import Sequence from './Sequence';
import LessonSection from './LessonSection';
import ReuseExplorer, { SparsityComparison } from './ReuseExplorer';
import { MathFormula } from './Lesson';

export const reuseToc = [
  { id: 'reuse-is-the-game', label: 'Reuse is the game' },
  { id: 'two-machines', label: 'Two machines, one model' },
  { id: 'expert-reuse', label: 'Watch experts light up' },
  { id: 'active-parameters', label: 'What “active” really means' },
  { id: 'what-to-measure', label: 'What to measure' },
];

export function ReuseArt() {
  // Eight of thirty-two lit: one token's top-k, in GLM's proportion.
  const lit = new Set([2, 5, 9, 12, 17, 20, 26, 30]);
  return <div className="memory-art reuse-art" role="img" aria-label="A grid of experts with eight of thirty-two lit: the share one token touches.">
    <div className="art-grid"/>
    <span className="art-label top">ONE TOKEN, ONE STEP</span>
    <div className="art-experts">{Array.from({ length: 32 }, (_, i) => <i key={i} className={lit.has(i) ? 'lit' : ''}/>)}</div>
    <span className="art-label bottom"><i/> EIGHT OF TWO HUNDRED FIFTY-SIX</span>
  </div>;
}

export default function ReuseLesson() {
  return <div className="lesson-body">
    <LessonSection id="reuse-is-the-game" number="01" label="THE THIRD QUESTION" title="Reuse is the whole game." summary={[
      'A weight byte you read is wasted unless it helps produce more than one token.',
      'Prefill and decode differ only in how many tokens share each read.',
    ]}>
      <p>Chapter two ended on a number: traffic per step, divided by bandwidth, gives a floor under the step time. That floor moved a lot when you changed the batch, and the reason was always the same. Reading a weight is expensive. Using it once is wasteful. Every serving decision you will make is, underneath, a decision about how many tokens get to share each byte you pull out of memory.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>Reading weights costs bandwidth. Using them costs arithmetic. The ratio between the two decides which of the machine’s ceilings you hit first.</p></div>
    </LessonSection>

    <LessonSection id="two-machines" number="02" label="ONE MODEL, TWO WORKLOADS" title="Prefill and decode are different machines." summary={[
      'Prefill reads each weight once and applies it to every token in the prompt.',
      'Decode reads each weight once and applies it to one token per sequence.',
      'The formula is identical; only the token count changes, and it changes by orders of magnitude.',
    ]}>
      <p>A request arrives and the engine does two quite different things with it. First it reads the whole prompt and builds the cache for it: <em>prefill</em>. Then it produces output one token at a time: <em>decode</em>. People talk about these as phases of one job, which they are, but for the hardware they are almost opposite workloads.</p>
      <MathFormula legend={[
        ['I', 'arithmetic intensity: operations performed per byte moved'],
        [String.raw`N_{\text{ops}}`, 'arithmetic the step performs, which grows with the number of tokens in it'],
        ['Q', 'bytes the step moves, which is mostly the weights and barely depends on the token count'],
        ['n', 'tokens in the step: the whole prompt during prefill, one per sequence during decode'],
        ['W', 'resident weight bytes, read once per step'],
      ]} note="Two numbers, one ratio. The second form is the approximation worth carrying: intensity tracks how many tokens share each weight read.">{String.raw`I = \frac{N_{\text{ops}}}{Q} \quad\approx\quad \frac{2\,n\,P_{\text{active}}}{W}`}</MathFormula>
      <p>A four-thousand-token prompt prefills in steps that each carry thousands of tokens. A decode step for eight concurrent users carries eight. The weights read are the same either way. That is a difference of two or three orders of magnitude in intensity, from one line of the same model, and it is why prefill tends to run out of arithmetic while decode runs out of bandwidth.</p>
      <PhaseScene figure="04"/>
      <div className="key-idea"><p><b>Why batching is the decode lever</b><br/>You cannot make decode compute-bound by buying a faster chip. You make it less memory-bound by putting more tokens in each step, so more of them share the same weight read.</p></div>
    </LessonSection>

    <LessonSection id="expert-reuse" number="03" label="SEE THE CONSEQUENCES" title="Watch the experts light up." summary={[
      'On a sparse model, a step reads only the experts its tokens route to.',
      'Adding tokens finds experts you were already going to read, so the cost per token collapses.',
      'By sixty-four tokens the three pinned MoE checkpoints are reading most of their experts.',
    ]}>
      <p>For a dense model, sharing is simple: every token uses every weight. Sparse models are more interesting. A token is routed to a handful of experts, so a step reads only the experts its own tokens asked for. With one token in flight you read very few. With many tokens in flight, their choices overlap.</p>
      <ReuseExplorer figure="05"/>
      <p>Start at one token and slide up. The count of experts touched rises quickly at first, because early tokens mostly pick experts nobody has picked yet, then flattens as the layer runs out of experts left to discover. The cost per token falls the whole way, but it falls for two different reasons, and the handover between them is the thing worth understanding.</p>
    </LessonSection>

    <LessonSection id="active-parameters" number="04" label="CORRECT AN EARLIER ASSUMPTION" title="What “active parameters” really means." summary={[
      'Active parameters describe one token in isolation, not a loaded server.',
      'Chapter two assumed every weight is read once per step: too pessimistic for sparse models at small batch, about right at large batch.',
      'A sparse checkpoint’s memory advantage is a small-batch advantage.',
    ]}>
      <p>Chapter one warned that active parameters describe some of the work per token, not how much weight storage you need. There is a second half to that warning, and it lands here. Active parameters also describe <em>one token on its own</em>. Serve sixty-four at once and their routing choices overlap until you are reading most of the checkpoint anyway.</p>
      <SparsityComparison/>
      <p>This also corrects something chapter two did on purpose. That bound assumed the resident weights are read once, in full, every step. For a dense checkpoint like Mistral that is right. For these three it is too pessimistic at small batch: at one token GLM reads about three per cent of its expert weights, not all of them, and it becomes roughly right as the batch grows. A model that is honest about its own limits is more useful than one that is quietly wrong in an unknown direction.</p>
      <div className="key-idea warning"><p><b>The trap in the marketing number</b><br/>“Thirty-five billion total, three billion active” is a true statement about one token. It is not a statement about your server at a healthy batch size, where the traffic per step is closer to the total than to the active figure.</p></div>
    </LessonSection>

    <LessonSection id="what-to-measure" number="05" label="TAKE THE NEXT STEP" title="What you would measure to check this." summary={[
      'Sweep batch size at fixed context and watch where cost per token stops improving.',
      'Routing statistics from the engine beat any uniform-routing model, including this one.',
    ]}>
      <p>Everything on this page is arithmetic over a routing model that assumes tokens choose experts independently and uniformly. Real routing does neither. The useful move is to hold context fixed, sweep the batch, and find the point where cost per token stops improving; the model here predicts roughly where that knee sits, and the distance between prediction and measurement tells you how far real routing is from uniform.</p>
      <Sequence label="Checking the model" steps={[
        { name: 'Reuse model', question: 'What does the arithmetic predict?', detail: 'uniform, independent routing' },
        { name: 'Predicted knee', question: 'Where should cost flatten?', detail: 'experts touched per batch' },
        { name: 'Batch sweep', question: 'Where does it flatten in fact?', detail: 'fixed context, rising batch' },
        { name: 'Routing counters', question: 'Was the assumption true?', detail: 'real expert selection' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>When a vendor number describes one token, ask what it becomes at your batch size. Most of the surprising results in serving come from a per-token fact being quietly applied to a loaded server.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#sources">Pinned configurations and routing figures <ArrowUpRight size={13}/></a>
        <a href="#equations">Expert reuse on the cheatsheet <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#engine">
      <div><span className="eyebrow">UP NEXT · CHAPTER 04 · ENGINE INTERNALS</span><h3>Now meet the scheduler.</h3><p>The layer that decides which steps happen at all.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
