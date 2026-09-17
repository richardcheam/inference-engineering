import React from 'react';
import { ArrowRight, ArrowUpRight, FileCode2 } from 'lucide-react';
import Sequence from './Sequence';
import LessonSection from './LessonSection';
import PrefixExplorer from './PrefixExplorer';
import EngineAnimation from './EngineAnimation';
import { MathFormula } from './Lesson';
import SchedulerScene from './SchedulerScene';

export const engineToc = [
  { id: 'engine-is-a-scheduler', label: 'The engine is a scheduler' },
  { id: 'blocks-not-tokens', label: 'Cache is blocks, not tokens' },
  { id: 'prefix-hit', label: 'What a cache hit saves' },
  { id: 'watch-the-loop', label: 'Watch the step loop' },
  { id: 'read-the-source', label: 'Read it in the source' },
  { id: 'cold-and-warm', label: 'Cold and warm' },
];

export function BlockArt() {
  const kinds = ['reused', 'reused', 'reused', 'reused', 'reused', 'reused', 'recomputed', 'padding'];
  return <div className="memory-art block-art" role="img" aria-label="Eight cache blocks: six reused, one recomputed, one padding.">
    <div className="art-grid"/>
    <span className="art-label top">ONE PROMPT, IN BLOCKS</span>
    <div className="art-blocks">{kinds.map((k, i) => <i key={i} className={k}/>)}</div>
    <span className="art-label bottom"><i/> THE LAST BLOCK ALWAYS PAYS</span>
  </div>;
}

export default function EngineLesson() {
  return <div className="lesson-body">
    <LessonSection id="engine-is-a-scheduler" number="01" label="THE FOURTH QUESTION" title="The engine is a scheduler." summary={[
      'Serving is not a function call per request; it is an allocator and a queue.',
      'The engine decides what runs each step, and that decision changes your latency more than the kernel does.',
    ]}>
      <p>So far the model has been arithmetic: bytes, rates, reuse. A real engine adds something the arithmetic does not capture. It holds many requests at once, decides which of them get tokens in the next step, and manages a finite pool of cache on their behalf. Most of the surprises in production serving come from that layer, not from the model.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>The model determines what a step costs. The scheduler determines which steps happen, for whom, and in what order.</p></div>
      <p>Watch that happen once, with three requests and a pool too small for all of them. Scroll through it: the stage stays put while the explanation moves.</p>
      <SchedulerScene figure="06"/>
    </LessonSection>

    <LessonSection id="blocks-not-tokens" number="02" label="HOW THE CACHE IS HELD" title="The cache is blocks, not tokens." summary={[
      'Cache is allocated in fixed-size blocks, so a sequence rounds up to a whole number of them.',
      'That rounding is wasted capacity, and it also constrains where reuse can begin and end.',
    ]}>
      <p>An engine does not hand out cache one token at a time. It allocates fixed-size blocks and maps a sequence onto as many as it needs. This is what lets a server pack many sequences of different lengths into one pool without fragmenting it, and it is also why almost every number in this chapter rounds.</p>
      <MathFormula legend={[
        ['b', 'blocks a sequence occupies'],
        ['T', 'live tokens in the sequence'],
        ['S', 'block size: tokens held per block, set by the engine rather than by you'],
        ['p', 'padding: allocated slots the sequence has not filled'],
      ]} note="The ceiling is the whole point. A sequence one token past a boundary costs an entire extra block.">{String.raw`b = \left\lceil \frac{T}{S} \right\rceil \qquad p = bS - T`}</MathFormula>
      <p>Padding is the obvious cost, and the smaller one. The more interesting consequence is that block boundaries become the only places where cached state can be picked up again.</p>
    </LessonSection>

    <LessonSection id="prefix-hit" number="03" label="SEE THE CONSEQUENCES" title="A cache hit is not a free prefill." summary={[
      'The lookup stops one token short of the prompt, because the last token still needs its logits.',
      'Reuse then aligns down to a block boundary, so the whole final block is recomputed.',
      'A prompt reported as a 100% hit can still recompute an entire block of tokens.',
    ]}>
      <p>If a prompt has been seen before, its cache entries are still there, and the engine can skip recomputing them. That is prefix caching, and it is the single biggest lever on time-to-first-token for repeated or shared prompts. It is also routinely overstated, in a way you can predict exactly.</p>
      <PrefixExplorer figure="07"/>
      <p>Set the whole prompt as cached and the metric will say one hundred per cent. The prefill still recomputes the last block. Now nudge the prompt length by a single token and watch that block appear and vanish: the same request, the same cache, the same reported hit rate, and a different amount of real work.</p>
    </LessonSection>

    <LessonSection id="watch-the-loop" number="04" label="WATCH IT RUN" title="One step at a time." summary={[
      'Prefill fills whole blocks; decode appends one token per step per request.',
      'A new block opens exactly when the previous one fills.',
      'When the pool runs out, something has to be preempted and recomputed.',
    ]}>
      <p>The arithmetic above says what a step costs. This says what a step <em>does</em>. Press play and watch the pool fill, or step through it one frame at a time; the interesting moments are easier to catch with the arrow keys than at speed.</p>
      <EngineAnimation figure="08"/>
      <p>The third scenario is the one worth stepping through slowly. Request B arrives with the same prompt as A, reuses the aligned prefix blocks (drawn dashed) and still recomputes the tail. That is the same gap the explorer measured, now visible as blocks rather than as a percentage.</p>
      <p>The second scenario shows something the static picture cannot. Admission checks whether the <em>prompt</em> fits, not whether the request has room to grow, so the pool can run out mid-flight. Then a request that was running gets preempted and its generated tokens are thrown away, to be recomputed later.</p>
    </LessonSection>

    <LessonSection id="read-the-source" number="05" label="CHECK IT IN THE IMPLEMENTATION" title="This is in the source, not inferred." summary={[
      'The lookup limit and the alignment requirement are both explicit in vLLM’s cache manager.',
      'The code comments say what the consequence is, in the implementers’ own words.',
    ]}>
      <p>Both rules in that example come from one pinned file, at one commit. This is worth reading directly, because it is a good example of behaviour that no amount of black-box benchmarking would explain, sitting in plain sight in a comment.</p>
      <div className="source-quote">
        <div className="source-quote-head"><FileCode2 size={14}/><span>vllm/v1/core/kv_cache_manager.py</span><span className="source-lines">lines 289–295</span></div>
        <pre><code>{`# NOTE: When all tokens hit the cache, we must recompute the last token
# to obtain logits. Thus, set max_cache_hit_length to prompt_length - 1.
# This can trigger recomputation of an entire block, rather than just
# the single last token, because allocate_slots() requires
# num_computed_tokens to be block-size aligned. Removing this limitation
# could slightly improve performance in the future.
max_cache_hit_length = request.num_tokens - 1`}</code></pre>
        <p>And the alignment it refers to, asserted at line 829: <code>assert num_computed_tokens % manager.block_size == 0</code></p>
      </div>
      <div className="key-idea warning"><p><b>What this means for a metric</b><br/>A cache-hit percentage describes what was found, not what was skipped. Two deployments with identical hit rates can do materially different amounts of prefill. If you are tuning against hit rate alone, you are tuning against the wrong number.</p></div>
      <p>The same file carries a second subtlety for hybrid models: different cache groups can hit to different depths, and the reconciled boundary is the shallower one. A model with sliding-window or recurrent state cannot reuse a full-attention prefix beyond what those states also retain.</p>
    </LessonSection>

    <LessonSection id="cold-and-warm" number="06" label="TAKE THE NEXT STEP" title="Measure cold against warm." summary={[
      'Send identical tokenized content twice, with the cache state stated rather than assumed.',
      'The improvement should be time-to-first-token, not throughput.',
    ]}>
      <p>The experiment that checks all of this is small. Take one prompt, send it against a cold cache, then send the identical tokenized content again. The prediction is specific: time-to-first-token improves, output throughput barely moves, and the improvement is smaller than the hit rate implies by roughly one block of prefill.</p>
      <Sequence label="The experiment" steps={[
        { name: 'Same prompt',  question: 'Hold the input fixed.',       detail: 'one request, unchanged' },
        { name: 'Cold cache',   question: 'Nothing has been seen.',      detail: 'full prefill · baseline TTFT' },
        { name: 'Warm cache',   question: 'What did the hit save?',      detail: 'reported hit · recomputed tail' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>When a metric and a mechanism disagree, read the allocator. Serving behaviour that looks mysterious from the outside is usually documented in the code that manages the memory.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#engines">The pinned source investigation <ArrowUpRight size={13}/></a>
        <a href="#sources">Saved engine source files <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#measure">
      <div><span className="eyebrow">UP NEXT · CHAPTER 05 · MEASUREMENT</span><h3>Now put a number on it.</h3><p>Turn a stream of tokens into metrics you can defend.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
