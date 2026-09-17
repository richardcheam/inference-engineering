import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { lessons } from './content';
import DecodeWalkthrough from './DecodeWalkthrough';

/**
 * The entry point. Identity before taxonomy: what this workspace claims, the one
 * mechanism every chapter is about, then the chapters as an editorial index
 * rather than a card grid. The evidence stance is stated here because it is the
 * first thing a reader is entitled to know about a page full of numbers.
 */
export default function Home() {
  return <div className="home">
    <header className="home-hero">
      <span className="kicker">INFERENCE ENGINEERING</span>
      <h1>
        <span>A model either fits, or it doesn’t.</span>
        <span>Then it’s fast enough, or it isn’t.</span>
      </h1>
      <p className="home-lede">
        Ten chapters on LLM inference engineering, worked from pinned model configurations,
        inspected engine source, and arithmetic you can check line by line.
      </p>
      <a className="home-start" href="#feasibility">Start with chapter one <ArrowRight size={17}/></a>
    </header>

    <section className="home-figure" aria-labelledby="home-figure-title">
      <div className="home-figure-head">
        <span className="eyebrow">THE LOOP EVERYTHING IS ABOUT</span>
        <h2 id="home-figure-title">One prompt, one token at a time.</h2>
        <p>
          Memory budgets, bandwidth floors, batching, caching, speculation: every idea in this
          guide is a claim about what happens below. Press play before reading anything else.
        </p>
      </div>
      <DecodeWalkthrough figure="01"/>
    </section>

    <section className="home-index" aria-labelledby="home-index-title">
      <h2 id="home-index-title" className="home-index-title">The chapters</h2>
      <ol className="chapter-index">
        {lessons.map(lesson => <li key={lesson.id}>
          <a href={`#${lesson.id}`}>
            <span className="chapter-number">{lesson.chapter}</span>
            <span className="chapter-text">
              <b>{lesson.title}</b>
              <small>{lesson.intent}</small>
            </span>
            <span className="chapter-time">{lesson.time}</span>
            <ArrowRight size={16} className="chapter-arrow"/>
          </a>
        </li>)}
      </ol>
    </section>

    <section className="home-evidence">
      <span className="eyebrow">WHAT THIS IS NOT</span>
      <p>
        Nothing here is a benchmark result. No model has been run, no GPU has been measured.
        Every figure comes from a pinned checkpoint, a pinned engine revision, or arithmetic
        over those, and each claim says which kind it is. Where a number would have to be
        invented, the page says so instead.
      </p>
      <a className="inline-link" href="#sources">Every source, pinned by revision <ArrowUpRight size={16}/></a>
    </section>
  </div>;
}
