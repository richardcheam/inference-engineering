import React from 'react';

/**
 * A numbered editorial sequence on a continuous rule (module 14, grammars A
 * and B).
 *
 * It replaces `A → B → C`, where the arrow was carrying the whole relationship
 * and the gaps between labels held nothing. Each stop states what it is and
 * what question it answers, and the rule beneath carries the progression, so
 * direction is shown by position rather than by punctuation.
 *
 * `conclusion` is the consequence, if the sequence has one worth naming: it is
 * set apart rather than made a fourth stop, because it is not another step.
 */
export default function Sequence({ label, steps, conclusion, emphasis = 'none' }) {
  return <figure className="sequence">
    {label && <figcaption className="sequence-label">{label}</figcaption>}

    <ol className="sequence-steps" style={{ '--steps': steps.length }}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const lit = emphasis === 'last' && last;
        return <li key={step.name} className={lit ? 'emphasis' : ''}>
          <span className="sequence-number">{String(i + 1).padStart(2, '0')}</span>
          <b className="sequence-name">{step.name}</b>
          {step.question && <span className="sequence-question">{step.question}</span>}
          {step.detail && <span className="sequence-detail">{step.detail}</span>}
        </li>;
      })}
    </ol>

    {conclusion && <p className="sequence-conclusion">{conclusion}</p>}
  </figure>;
}
