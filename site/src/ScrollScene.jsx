import React, { useEffect, useRef, useState } from 'react';

/**
 * A reusable explanatory scroll scene (module 12, level 3).
 *
 * One technical visual stays spatially stable while the explanation beside it
 * advances: §6's sticky stage. The captions are ordinary blocks in the document
 * flow, so every word is in the DOM whether or not the scene ever animates, and
 * a screen reader or a found-in-page match reaches them normally.
 *
 * Activation is an IntersectionObserver over the caption blocks, not a scroll
 * handler (§23). That makes reverse scrolling, rapid direction changes, resize
 * and deep links work by construction: the observer reports whichever caption
 * is crossing the middle of the viewport, however the reader got there.
 *
 * When the viewport is too short or narrow for a sticky stage, or the reader
 * prefers reduced motion, the scene renders as a stacked storyboard instead:
 * one stage per state with its caption beneath. No information is lost and
 * nothing moves.
 */
export default function ScrollScene({ states, renderStage, label, id }) {
  const [active, setActive] = useState(0);
  const [stacked, setStacked] = useState(true);
  const captionRefs = useRef([]);

  // The sticky treatment needs both room to work and the reader's consent.
  useEffect(() => {
    const queries = [
      window.matchMedia('(min-width: 1100px)'),
      window.matchMedia('(min-height: 620px)'),
      window.matchMedia('(prefers-reduced-motion: no-preference)'),
    ];
    const update = () => setStacked(!queries.every(q => q.matches));
    update();
    queries.forEach(q => q.addEventListener('change', update));
    return () => queries.forEach(q => q.removeEventListener('change', update));
  }, []);

  useEffect(() => {
    if (stacked) return;
    const nodes = captionRefs.current.filter(Boolean);
    if (!nodes.length) return;

    // The observer says *that* something changed; the geometry says *which*
    // caption owns the stage. Reading it this way survives a jump: paging with
    // the keyboard moves most of a viewport at once, and an activation band
    // narrow enough to be precise is narrow enough for a jump to clear
    // entirely, which skipped states 1 through 4 for anyone not using a wheel.
    const pick = () => {
      const middle = window.innerHeight / 2;
      let best = 0, bestDistance = Infinity;
      nodes.forEach(node => {
        const box = node.getBoundingClientRect();
        const distance = Math.abs((box.top + box.bottom) / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = Number(node.dataset.index);
        }
      });
      setActive(current => (current === best ? current : best));
    };

    // Thresholds rather than a thin band, so any change in how much of a
    // caption is showing wakes us up, however the reader got there.
    const observer = new IntersectionObserver(pick,
      { threshold: [0, 0.25, 0.5, 0.75, 1] });
    nodes.forEach(n => observer.observe(n));
    pick();
    return () => observer.disconnect();
  }, [stacked, states.length]);

  if (stacked) {
    return <div className="scroll-scene stacked" id={id}>
      <ol className="scene-storyboard" aria-label={label}>
        {states.map((state, i) => <li key={state.id}>
          <p className="scene-step"><span>{String(i + 1).padStart(2, '0')}</span>{state.label}</p>
          <div className="scene-stage">{renderStage(state, i)}</div>
          <p className="scene-caption">{state.caption}</p>
        </li>)}
      </ol>
    </div>;
  }

  return <div className="scroll-scene" id={id}>
    <div className="scene-grid">
      <div className="scene-sticky">
        <div className="scene-stage" aria-hidden="true">{renderStage(states[active], active)}</div>
        <ol className="scene-progress" aria-hidden="true">
          {states.map((state, i) => <li key={state.id} className={i === active ? 'active' : i < active ? 'past' : ''}>
            <span>{String(i + 1).padStart(2, '0')}</span>{state.label}
          </li>)}
        </ol>
      </div>
      <ol className="scene-captions" aria-label={label}>
        {states.map((state, i) => <li key={state.id} data-index={i}
          ref={node => { captionRefs.current[i] = node; }}
          className={i === active ? 'active' : ''}>
          <p className="scene-step"><span>{String(i + 1).padStart(2, '0')}</span>{state.label}</p>
          <p className="scene-caption">{state.caption}</p>
        </li>)}
      </ol>
    </div>
  </div>;
}
