import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import LessonSection from './LessonSection';
import DiagnoseExplorer from './DiagnoseExplorer';

export const profileToc = [
  { id: 'slow-is-not-a-cause', label: '“Slow” is not a cause' },
  { id: 'the-differential', label: 'Build a differential' },
  { id: 'discriminate', label: 'Run the discriminating test' },
  { id: 'critical-path', label: 'Follow the critical path' },
  { id: 'before-you-change', label: 'Before you change anything' },
];

export function ScopeArt() {
  const rows = [
    { w: 92, on: true }, { w: 64, on: false }, { w: 78, on: true },
    { w: 41, on: false }, { w: 55, on: false },
  ];
  return <div className="memory-art scope-art" role="img" aria-label="Five candidate explanations, two of them still standing.">
    <div className="art-grid"/>
    <span className="art-label top">FIVE EXPLANATIONS</span>
    <div className="art-candidates">{rows.map((r, i) => <span key={i} className={r.on ? 'standing' : 'ruled-out'}>
      <i style={{ width: `${r.w}%` }}/>
    </span>)}</div>
    <span className="art-label bottom"><i/> TWO SURVIVE THE EVIDENCE</span>
  </div>;
}

export default function ProfileLesson() {
  return <div className="lesson-body">
    <LessonSection id="slow-is-not-a-cause" number="01" label="THE SIXTH QUESTION" title="“It's slow” is a symptom, not a cause." summary={[
      'The same symptom has many possible mechanisms, and they need opposite fixes.',
      'Changing something and watching the number move is not evidence about why.',
    ]}>
      <p>Chapter five gave you numbers you can defend. This one is about the harder move: turning a bad number into a mechanism. A high time-to-first-token is consistent with a queue, with prefill crowding out decode, with a cache that keeps evicting, and with a device waiting on a link. Those need different fixes, and several of them make the others worse.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>A change that improves a number has not explained it. Tuning until something gets faster leaves you with a faster system you still cannot reason about, and no way to know what breaks it next.</p></div>
    </LessonSection>

    <LessonSection id="the-differential" number="02" label="SEE THE CONSEQUENCES" title="Build a differential, not a guess." summary={[
      'List every mechanism that would produce what you observed.',
      'Ties are informative: they tell you which measurement to run next.',
      'A candidate with no falsifying test does not belong on the list.',
    ]}>
      <p>Borrow the discipline from diagnosis. Write down the observations you have actually made, list the mechanisms that would each produce all of them, and only then ask which measurement separates the survivors. Select what you have genuinely measured below; the point of the exercise is how often the evidence leaves several candidates standing.</p>
      <DiagnoseExplorer figure="10"/>
      <p>Two candidates explaining the same symptoms equally well is the normal state, and it is useful. It means the next thing to do is a measurement rather than a change.</p>
    </LessonSection>

    <LessonSection id="discriminate" number="03" label="THE MOVE THAT WORKS" title="Prefer the test that can embarrass you." summary={[
      'A good test has a result that would make you abandon your favourite explanation.',
      'Vary one factor. Two factors at once produce a result you cannot attribute.',
    ]}>
      <p>The useful test is not the one most likely to confirm you. It is the one whose outcome differs most between the candidates you are trying to separate. If your leading hypothesis is bandwidth-bound decode and your rival is queueing, raising the batch size separates them cleanly: bandwidth-bound decode trades per-sequence rate for aggregate throughput, while a queue-bound server improves both at once or neither.</p>
      <div className="key-idea"><p><b>One factor at a time</b><br/>Changing the batch size and the context length together produces a number that no hypothesis predicted and none can be blamed for. It feels efficient and it throws away the information you ran the experiment to get.</p></div>
      <p>Write the prediction down before running it. A hypothesis that only becomes specific after you have seen the result is not a hypothesis.</p>
    </LessonSection>

    <LessonSection id="critical-path" number="04" label="WHERE THE TIME GOES" title="Follow the critical path, not the biggest number." summary={[
      'Time on the critical path is the only time whose removal helps.',
      'Overlapped work can be large and still cost you nothing.',
      'Matched idle gaps across devices mean waiting, not slowness.',
    ]}>
      <p>Profiles are full of large numbers that do not matter. Work that overlaps with other work is free until it becomes the longest thing running. The question to ask of any expensive operation is not how long it took, but whether anything was waiting on it.</p>
      <p>This is why timelines beat totals. A total tells you a kernel took a long time; a timeline tells you whether anything else could have run meanwhile. And when several devices are involved, idle gaps that line up across ranks mean they are blocking on each other: a different problem, with a different fix, from every rank being independently slow.</p>
      <div className="key-idea warning"><p><b>Measuring changes the thing measured</b><br/>Profilers add overhead, and they add it unevenly. Synchronising to get clean per-operation timings can serialise work that normally overlaps, which makes the profile disagree with the production behaviour it was meant to explain.</p></div>
    </LessonSection>

    <LessonSection id="before-you-change" number="05" label="TAKE THE NEXT STEP" title="Before you change anything." summary={[
      'Name the hypothesis, the counter-hypothesis, and the test that separates them.',
      'Record the baseline first; a fix with no baseline is a story.',
    ]}>
      <p>The workspace cheatsheet already ends with the right checklist, and it is worth repeating as the closing habit of this chapter: which workload, which constrained resource, which observation supports that, what else explains it, which metric should change, what experiment would disprove it, and what it costs in quality or operational complexity.</p>
      <div className="decision-flow"><span>Symptom</span><ArrowRight/><span>Differential</span><ArrowRight/><span>Discriminating test</span><ArrowRight/><span>Mechanism</span></div>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>Write the counter-hypothesis down before you run the test. It is the cheapest protection against finding what you expected in data that did not contain it.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#benchmarking">Our measurement protocol <ArrowUpRight size={13}/></a>
        <a href="#equations">The pre-optimisation checklist <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#parallel">
      <div><span className="eyebrow">UP NEXT · CHAPTER 07 · PARALLELISM AND PLACEMENT</span><h3>Now spread it across devices.</h3><p>What sharding buys, and what it quietly charges.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
