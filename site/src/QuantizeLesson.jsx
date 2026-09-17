import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Sequence from './Sequence';
import LessonSection from './LessonSection';
import PrecisionExplorer from './PrecisionExplorer';
import { MathFormula } from './Lesson';

export const quantizeToc = [
  { id: 'two-questions', label: 'Two different questions' },
  { id: 'scales-cost', label: 'The scales cost bytes' },
  { id: 'see-the-bytes', label: 'See the bytes' },
  { id: 'support-is-per-backend', label: 'Support is per backend' },
  { id: 'prove-the-quality', label: 'Proving the quality' },
];

export function PrecisionArt() {
  const rows = [[16, 'bf16'], [8, 'fp8'], [4, 'fp4']];
  return <div className="memory-art precision-art" role="img" aria-label="Three storage widths: sixteen, eight and four bits.">
    <div className="art-grid"/>
    <span className="art-label top">THE SAME WEIGHT</span>
    <div className="art-widths">{rows.map(([bits, id]) => <span key={id} className={id}>
      <i style={{ width: `${bits / 16 * 100}%` }}/><small>{bits}b</small>
    </span>)}</div>
    <span className="art-label bottom"><i/> STORED IS NOT EXECUTED</span>
  </div>;
}

export default function QuantizeLesson() {
  return <div className="lesson-body">
    <LessonSection id="two-questions" number="01" label="THE EIGHTH QUESTION" title="Storage and execution are different questions." summary={[
      'A checkpoint’s format says how the weights are stored, not how the maths is done.',
      'The memory saving is nearly guaranteed; the arithmetic saving depends on the backend.',
    ]}>
      <p>Quantization is the most reliable way to make a model fit and the most commonly misread. A four-bit checkpoint is genuinely four bits on disk and in memory, which is a real win for both of chapter one's capacity and chapter two's bandwidth. It is frequently not four bits in the multiply, because the kernel unpacks it first.</p>
      <div className="key-idea"><p><b>Keep this distinction in mind</b><br/>Stored bits, unpacking, matrix-operation dtype, accumulator dtype, and KV dtype are five separate facts. A checkpoint tells you the first one.</p></div>
    </LessonSection>

    <LessonSection id="scales-cost" number="02" label="THE ARITHMETIC" title="A four-bit checkpoint is not four bits per parameter." summary={[
      'Quantized weights carry per-group scales, and those scales are real bytes.',
      'Finer groups mean better fidelity and more overhead, and the trade is explicit.',
    ]}>
      <p>Quantized weights are stored in groups that share a scaling factor. Those factors have to be stored too, usually at a wider precision than the values they scale, and any honest footprint has to count them.</p>
      <MathFormula legend={[
        [String.raw`B_{\text{eff}}`, 'effective bits per parameter, including the overhead'],
        ['w', 'nominal stored width of each value, in bits'],
        ['s', 'width of one scale, in bits; typically wider than the values'],
        ['g', 'group size: values that share a scale'],
      ]} note="At g = 128 and a 16-bit scale, a nominally 4-bit format costs 4.125 bits per parameter. At g = 32 it costs 4.5.">{String.raw`B_{\text{eff}} = w + \frac{s}{g}`}</MathFormula>
      <p>The overhead is small, but it is not zero, and it moves in the opposite direction to quality. Smaller groups track the weight distribution more closely and cost more bytes doing it.</p>
    </LessonSection>

    <LessonSection id="see-the-bytes" number="03" label="SEE THE CONSEQUENCES" title="See where the bytes actually go." summary={[
      'Compare stored formats against a BF16 baseline on the same parameter count.',
      'Watch the scale overhead grow as the group shrinks.',
    ]}>
      <p>Take a hundred-billion-parameter model and move it between formats. The payload shrinks with the bit width, the scales appear as a separate slice, and the effective bits per parameter never quite matches the number on the label.</p>
      <PrecisionExplorer figure="13"/>
      <p>This is also why our four pinned checkpoints were measured by summing their tensor indices rather than multiplying a parameter count by a bit width. Real checkpoints mix formats across tensors, and the only reliable footprint is the one the index actually reports.</p>
    </LessonSection>

    <LessonSection id="support-is-per-backend" number="04" label="THE PART THAT BITES" title="Support is a property of your backend, not the file." summary={[
      'The same checkpoint runs natively on one accelerator and is upcast on another.',
      'Quantized weights do not imply a quantized cache, which is a separate decision.',
    ]}>
      <p>Chapter one's hardware note applies with full force here: record format support at the kernel level, not the file level. The questions are what bits are stored, where unpacking happens, what dtype the matrix operation runs in, what the accumulator is, and separately what the KV cache is stored as.</p>
      <div className="key-idea warning"><p><b>Quantized weights do not quantize the cache</b><br/>These are independent settings. A model with FP8 weights and a BF16 cache is completely ordinary, and at long context the cache can be the larger term; chapter one's explorer shows exactly when.</p></div>
      <p>This is also where the workspace's own support table earns its keep. For each of our four checkpoints, the engine recipes disagree about minimum versions, required images, and which numerical formats are actually available. None of that is visible in the checkpoint.</p>
    </LessonSection>

    <LessonSection id="prove-the-quality" number="05" label="TAKE THE NEXT STEP" title="Prove the quality separately." summary={[
      'Memory and latency improvements are measurable immediately; quality is not.',
      'Use a matched evaluation set and compare against the same model at full precision.',
    ]}>
      <p>Everything on this page is a capacity and bandwidth result. Whether the quantized model still answers correctly is a different measurement, and the honest version compares the same prompts against the same model at higher precision rather than against a published score for a different setup.</p>
      <Sequence label="Before you quantize" steps={[
        { name: 'Stored format', question: 'What is on disk?', detail: 'bits per value · scales · groups' },
        { name: 'Kernel support', question: 'What can the stack execute?', detail: 'supported paths, not formats' },
        { name: 'Memory and latency', question: 'What did it actually buy?', detail: 'resident bytes · step time' },
        { name: 'Matched quality set', question: 'Did the answers change?', detail: 'same prompts, both precisions' },
      ]}/>
      <div className="takeaway"><div><h3>The engineering habit</h3><p>Quote a quantization result as three numbers, not one: what it saved, what it cost in latency, and what it did to quality on your own evaluation. A format name on its own is not a result.</p></div></div>
      <div className="lesson-sources">
        <span className="eyebrow">EVIDENCE BEHIND THIS LESSON</span>
        <a href="#engines">Per-model engine support evidence <ArrowUpRight size={13}/></a>
        <a href="#models">How the pinned footprints were measured <ArrowUpRight size={13}/></a>
      </div>
    </LessonSection>

    <a className="next-lesson" href="#speculate">
      <div><span className="eyebrow">UP NEXT · CHAPTER 09 · SPECULATION</span><h3>Now guess ahead.</h3><p>When drafting tokens pays, and when it quietly costs.</p></div>
      <span className="next-arrow"><ArrowRight size={24}/></span>
    </a>
  </div>;
}
