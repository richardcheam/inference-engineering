import React, { useEffect, useMemo, useRef, useState } from 'react';
import records from '../../experiments/001-feasibility/calculations.json';
import { platforms } from './bandwidth.mjs';
import { placeMemory } from './parallel.mjs';

/**
 * H1 — THE DIVISION FIELD  (Art Direction II, chapter 07 pilot)
 *
 * The thesis the composition has to carry, without a caption doing the work:
 *
 *   as the device count rises, PER-DEVICE LOAD FALLS
 *   while MODELLED SYNCHRONISATION MARKS ACCUMULATE.
 *
 * Composed as a measured drawing: a dimension margin carrying the instrument
 * readings, and a plate carrying the object. Four registers, sharing no scale:
 *
 *   1  MEMORY         per-device bytes, absolute, against a fixed capacity datum
 *   2  SYNCHRONISATION  a count — one numbered mark per modelled sync point
 *   3  CACHE COPIES   a count — one unit per live-cache replica
 *   4  DEVICE SCALE   the ordinal control, 1 · 2 · 4 · 8 · 16
 *
 * THE INTEGRITY CONTRACT (concept §4.0) — unchanged by the art-direction pass,
 * and the thing to check in review:
 *
 *   device width      carries NO quantity. Every device here is the same 141 GB
 *                     part, so the width is constant at every D — a function of
 *                     the viewport, never of the data.
 *   field extent      EMERGES from the number of devices, because constant-width
 *                     units are repeated. It therefore expresses POPULATION
 *                     COUNT and nothing else. It must never be read as memory,
 *                     latency, bandwidth or physical network distance.
 *   fill height       absolute bytes. One GB-per-pixel across every state.
 *   gap width         carries NO quantity. Separation and index only.
 *   sync marks        a COUNT. Spacing carries no quantity, length carries no
 *                     distance, and none of it is a duration.
 *   cache copies      a COUNT. One unit is one full copy of the live cache.
 *
 *   => WIDTH NEVER ENCODES MEMORY. DISTANCE NEVER ENCODES LATENCY.
 *      EXTENT IS POPULATION, AND ONLY POPULATION.
 *
 * Every number is `placeMemory`, the same tested function the trade-off figure,
 * the scroll scene and the explorer in this chapter already run.
 */

const SCALE = [1, 2, 4, 8, 16];
const WORKLOAD = { model: 'glm-5.3', context: 32768, sequences: 8, kvHeads: 8, strategy: 'tp' };
const CAPACITY = platforms['h200-sxm'].capacityBytes;

/* The memory register's frame, expressed in the quantity it shows. 210 GB puts
   the 141 GB datum at 67% of the frame: high enough that a state can sit over
   capacity and still be read (D=4 at 194.8 GB), low enough that the states that
   matter are not squashed into the bottom sliver. Larger values are clipped and
   annotated with their multiple rather than rescaled, because rescaling per
   state would destroy the comparison between states. */
const FRAME_GB = 210;

const gb = bytes => bytes / 1e9;
/* The precision convention the explorer in this chapter already uses, so the
   two figures state the same quantity the same way. */
const one = n => n.toFixed(n < 10 ? 2 : 1);
const pad = n => String(n).padStart(2, '0');
const WORDS = { 0: 'No', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 7: 'Seven', 8: 'Eight', 15: 'Fifteen', 16: 'Sixteen' };

/**
 * The statement, at every state, in the construction the approved concept fixes
 * for D=8: a count of devices, then the count of modelled sync points. The
 * epistemic status travels with it and is never optional.
 */
function statement(devices, sync) {
  const d = `${WORDS[devices] ?? devices} device${devices === 1 ? '' : 's'}.`;
  const s = sync === 0
    ? 'No synchronisation points.'
    : `${WORDS[sync] ?? sync} synchronisation point${sync === 1 ? '' : 's'}.`;
  return [d, s];
}

/** One reading in the dimension margin: label over value. */
function Reading({ label, value, unit, tone }) {
  return <div className={`df-reading${tone ? ` ${tone}` : ''}`}>
    <span className="df-reading-label">{label}</span>
    <span className="df-reading-value">{value}{unit && <small>{unit}</small>}</span>
  </div>;
}

export default function DivisionField({ figure = '12' }) {
  const [index, setIndex] = useState(3);          // SCALE[3] === 8, the state the chapter argues for
  const devices = SCALE[index];
  const field = useRef(null);

  const r = useMemo(
    () => placeMemory({ ...WORKLOAD, devices, capacityPerDevice: CAPACITY }, records),
    [devices],
  );

  const perDevice = gb(r.perDeviceBytes);
  const weights = gb(r.weightBytesPerDevice);
  const cache = gb(r.cacheBytesPerDevice);
  const capacity = gb(r.capacityPerDevice);
  const aggregate = gb(r.cacheBytesTotal);
  const oneCopy = aggregate / r.kvReplicas;

  const pct = value => (100 * value) / FRAME_GB;
  const exceedsFrame = perDevice > FRAME_GB;

  /* The drawing breaks the article measure: it runs from the workspace's left
     edge out to the table of contents. The article grid's outer tracks are
     flexible (`minmax(--page-gutter, 1fr)`), so these distances cannot be
     static values; they are measured, the way `--topbar-height` already is.

     It stops at the rail rather than at the viewport because the Field Guide is
     `position: fixed` — a `100vw` figure slides underneath it and hides its own
     left edge — and the right rail is sticky, so a figure reaching the viewport
     edge runs under the table of contents, which it did on the first build.
     What it gains instead is the left gutter: 388px at 2560 that previously
     belonged to nothing, which the dimension margin now claims.

     If measurement never runs the margins stay 0 and the figure is simply
     article-width — a safe failure rather than an overflow. */
  useEffect(() => {
    const el = field.current;
    const host = el?.parentElement;
    const layout = el?.closest('.reading-layout');
    if (!el || !host || !layout) return undefined;
    const measure = () => {
      const a = host.getBoundingClientRect();
      const box = layout.getBoundingClientRect();
      const rail = layout.querySelector('.page-rail');
      const railBox = rail?.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(layout).columnGap || '0') || 0;
      const end = railBox && railBox.width > 0 ? railBox.left - gap : box.right;
      el.style.setProperty('--bleed-start', `${Math.max(0, Math.round(a.left - box.left))}px`);
      el.style.setProperty('--bleed-end', `${Math.max(0, Math.round(end - a.right))}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /* While this artifact is the active scene, the publication's floating
     utilities recede (see masthead.css). On a phone the "on this page" control
     sits exactly where the synchronisation register is drawn, and a global
     utility should not print itself on top of a chapter's hero object. The
     attribute is cleared on exit and on unmount, so navigating away always
     restores it. */
  useEffect(() => {
    const el = field.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) root.dataset.heroScene = 'division-field';
        else if (root.dataset.heroScene === 'division-field') delete root.dataset.heroScene;
      },
      // Only while the drawing genuinely occupies the viewport, not the moment
      // its first pixel appears.
      { threshold: 0, rootMargin: '-25% 0px -25% 0px' },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (root.dataset.heroScene === 'division-field') delete root.dataset.heroScene;
    };
  }, []);

  const [line, points] = statement(devices, r.collectivesPerStep);

  return <figure className="division-field" ref={field} data-state={`d${devices}`}>
    <figcaption className="df-head">
      <span className="df-head-name">The division field</span>
      <span className="figure-id">FIG. {figure}</span>
    </figcaption>

    <p className="df-statement">
      <b>{line}</b>
      <b className="df-statement-cost">{points}</b>
    </p>
    <p className="df-status">
      MODELLED · placeMemory(D&nbsp;=&nbsp;{devices}) · a count of synchronisation points
      per step, not a measurement of time
    </p>

    {/* The control sits above the drawing: the reader sets the parameter and the
        object answers. It is also then nowhere near the floating "on this page"
        control that sits in the corner of a phone. */}
    <div className="df-scale">
      <label className="df-reading-label" htmlFor="division-field-scale">DEVICE SCALE</label>
      <div className="df-scale-track">
        <input
          id="division-field-scale"
          className="df-scale-input"
          type="range"
          min="0"
          max={SCALE.length - 1}
          step="1"
          value={index}
          onChange={e => setIndex(Number(e.target.value))}
          aria-valuetext={`${devices} device${devices === 1 ? '' : 's'}, ${one(perDevice)} of ${one(capacity)} gigabytes per device, ${r.collectivesPerStep} modelled synchronisation points per step`}
        />
        <ol className="df-stops" aria-hidden="true">
          {SCALE.map((d, i) => <li
            key={d}
            className={i === index ? 'current' : ''}
            style={{ '--at': `${(100 * i) / (SCALE.length - 1)}%` }}
          >
            <span className="df-stop-tick"/>
            <button type="button" tabIndex={-1} onClick={() => setIndex(i)}>{d}</button>
          </li>)}
        </ol>
      </div>
    </div>

    <div className="df-plate">
      {/* ---- The dimension margin: the instrument readings, off the object --- */}
      <div className="df-dimensions">
        <Reading label="PER DEVICE" value={one(perDevice)} unit="GB" tone={r.fits ? 'fits' : 'over'}/>
        <Reading label="CAPACITY" value={one(capacity)} unit="GB"/>
        <Reading label="WEIGHTS / DEVICE" value={one(weights)} unit="GB"/>
        <Reading label="CACHE / DEVICE" value={one(cache)} unit="GB"/>
        {/* Rotated, the in-frame headroom dimension has nowhere to sit that is
            not on top of a band, so on a phone it becomes a reading instead. */}
        {r.fits && <div className="df-reading only-narrow">
          <span className="df-reading-label">HEADROOM / DEVICE</span>
          <span className="df-reading-value">{one(gb(r.headroomBytes))}<small>GB</small></span>
        </div>}
        {exceedsFrame && <div className="df-instrument">
          <span>{one(perDevice)} GB</span>
          <span>{(perDevice / capacity).toFixed(1)}× CAPACITY</span>
          <span>{(perDevice / FRAME_GB).toFixed(1)}× DISPLAY RANGE</span>
          <span className="df-instrument-note">CLIPPED · NOT RESCALED</span>
        </div>}
      </div>

      {/* ---- The plate: the object itself ----------------------------------- */}
      <div className="df-object">
        <div className="df-frame">
          {/* The capacity datum. Reference only: never interactive, never focusable. */}
          <div className="df-datum" style={{ '--capacity': `${pct(capacity)}%` }} aria-hidden="true">
            <span className="df-datum-label">{one(capacity)} GB · CAPACITY</span>
          </div>

          {/* The band between the units and the datum is unused capacity, and
              it is the largest empty area in the drawing. A dimension string
              claims it with the quantity it actually represents rather than
              leaving it as blank space. `headroomBytes` is the model's own. */}
          {r.fits && <div
            className="df-headroom"
            style={{ '--from': `${pct(perDevice)}%`, '--to': `${pct(capacity)}%` }}
            aria-hidden="true"
          >
            <span className="df-headroom-label">
              {one(gb(r.headroomBytes))}<small>GB HEADROOM</small>
            </span>
          </div>}

          <ol className="df-devices" data-fits={r.fits ? 'true' : 'false'}>
            {Array.from({ length: devices }, (_, i) => <li key={i} className="df-device" style={{ '--i': i }}>
              {/* `--extent` rather than a height: the same percentage of the same
                  absolute frame drives height on the vertical composition and
                  length on the rotated one, so the scale survives the rotation. */}
              <span className="df-fill" data-exceeds={exceedsFrame ? 'true' : undefined}>
                <span className="df-band df-weights" style={{ '--extent': `${Math.min(pct(weights), 100)}%` }}/>
                <span className="df-band df-cache" style={{ '--extent': `${Math.min(pct(cache), Math.max(0, 100 - pct(weights)))}%` }}/>
              </span>
            </li>)}
          </ol>
        </div>

        {/* The device index, outside the clipped frame so an over-capacity state
            can never clip it. */}
        <ol className="df-axis" aria-hidden="true">
          {Array.from({ length: devices }, (_, i) => <li key={i} className="df-axis-cell">
            <small className="df-index">{pad(i)}</small>
          </li>)}
        </ol>

        {/* ---- Register 2 — synchronisation, counted -------------------------
            Each mark is numbered in the house's own notation, so the marks carry
            the evidence rather than one large numeral doing all the work. Each
            sits in the gap the layout already leaves, absolutely positioned,
            consuming no width: it cannot touch the memory scale. A count, not a
            connection, and the spacing between marks says nothing about time. */}
        <div className="df-register df-sync-register">
          <ol className="df-sync-rail" aria-hidden="true">
            {Array.from({ length: devices }, (_, i) => <li key={i} className="df-axis-cell">
              {i < devices - 1 && <span className="df-sync" style={{ '--i': i }}>
                <i className="df-sync-tick"/>
                <small className="df-sync-n">{pad(i + 1)}</small>
              </span>}
            </li>)}
          </ol>
          <p className="df-register-read">
            <span className="df-reading-label">SYNCHRONISATION · MODELLED</span>
            <span className="df-register-note">
              {r.collectivesPerStep === 0
                ? 'none in this model at one device'
                : `${r.collectivesPerStep} points per step · one per gap above`}
            </span>
          </p>
        </div>

        {/* ---- Register 3 — cache copies, counted ---------------------------
            Replication is a structural event, not a bar growing: past the stored
            head count a whole second copy of the live cache exists. One unit is
            one copy, so the transition is a unit appearing. */}
        <div className="df-register df-copies-register" data-replicated={r.kvReplicas > 1 ? 'true' : undefined}>
          <ol className="df-copies" aria-hidden="true">
            {Array.from({ length: r.kvReplicas }, (_, i) => <li key={i} className="df-copy" style={{ '--i': i }}>
              <small>{one(oneCopy)} GB</small>
            </li>)}
          </ol>
          <p className="df-register-read">
            <span className="df-reading-label">LIVE CACHE · COPIES</span>
            <span className="df-register-note">
              {r.kvReplicas > 1
                ? `× ${r.kvReplicas} = ${one(aggregate)} GB aggregate · ${WORKLOAD.kvHeads} stored KV heads cannot divide ${devices} ways`
                : `× 1 = ${one(aggregate)} GB aggregate · the cache still divides exactly`}
            </span>
          </p>
        </div>
      </div>
    </div>

    <p className="df-summary" role="status">
      {devices} device{devices === 1 ? '' : 's'}: {one(weights)} GB of weights and {one(cache)} GB
      of live cache each, {r.fits ? 'under' : 'over'} a {one(capacity)} GB capacity.
      {' '}{r.collectivesPerStep} modelled synchronisation point{r.collectivesPerStep === 1 ? '' : 's'} per step.
      {' '}Live cache held in {r.kvReplicas} cop{r.kvReplicas === 1 ? 'y' : 'ies'}, {one(aggregate)} GB aggregate.
      {r.fits && ` ${one(gb(r.headroomBytes))} GB of headroom per device.`}
    </p>

    <p className="df-provenance">
      GLM-5.3 under tensor parallelism, eight sequences at 32K tokens, against a
      141 GB device. Every value is <code>placeMemory</code> at that device count,
      the same function the figure above and the explorer below run. Weights and
      cache only: activations, workspaces and communication buffers are not
      modelled. Synchronisation points are a shape the model reports, not a
      measured count, and say nothing about how long each one takes.
    </p>
  </figure>;
}
