import React, { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, MoreHorizontal } from 'lucide-react';
import { SPEEDS, transport } from './timeline.mjs';
import { initPlayback, isRunning, playback, primaryAction } from './playback.mjs';

/**
 * EDITORIAL PLAYBACK — module 13.
 *
 * The concept is the controller. What the learner sees first is the stage they
 * are in and the stages on either side of it; the playback machinery is one
 * button that changes verb with the state. Previous, next, reset and a
 * permanently visible speed selector are gone: the stages are the navigation
 * (§7), replay appears only once there is something to replay (§13), and speed
 * lives behind a quiet secondary control (§12).
 *
 * Four concerns are kept apart (§29): playback state is `playback.mjs`,
 * technical state is the frame list its owner computed, viewport observation is
 * the hook below, and rendering is this component.
 */

/* ---- §33 One page, one moving example -------------------------------------
   Instances report how much of themselves is showing; only the most prominent
   is allowed to run. Without this, a page with two living examples animates in
   two places at once and neither reads. */
const visible = new Map();
const listeners = new Set();
function report(id, ratio) {
  if (ratio > 0) visible.set(id, ratio); else visible.delete(id);
  let best = null, bestRatio = 0;
  for (const [key, value] of visible) if (value > bestRatio) { best = key; bestRatio = value; }
  for (const fn of listeners) fn(best);
}

const BASE_MS = 900;
/** §30: a third of the example showing is "meaningfully visible", not 2px of it. */
const ENTER_RATIO = 0.35;

/* The cursor advances here rather than through `advance`, because playback is
   no longer a boolean on the timeline: whether the clock runs is the machine's
   business. Everything else still goes through the tested reducer. */
const tick = state => (state.frame + 1 >= state.total ? state : { ...state, frame: state.frame + 1 });
const timelineReducer = (state, action) => (action.type === 'tick' ? tick(state) : transport(state, action));

export function useEditorialPlayback(total) {
  const id = useId();
  const stageRef = useRef(null);
  const [frame, dispatchFrame] = useReducer(timelineReducer, { frame: 0, playing: false, total, speed: 1 });
  const [play, dispatchPlay] = useReducer(
    playback, undefined,
    () => initPlayback({
      reducedMotion: typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }),
  );
  const [prominent, setProminent] = useState(null);

  // A new scenario is a new example: new length, cursor home, ready to open.
  useEffect(() => {
    dispatchFrame({ type: 'resize', total });
    dispatchFrame({ type: 'reset' });
    dispatchPlay({ type: 'reset' });
  }, [total]);

  // §5: the preference can change while the page is open.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => dispatchPlay({ type: 'reduced_motion', value: query.matches });
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // §30 viewport observation, and §33 prominence.
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    listeners.add(setProminent);
    const observer = new IntersectionObserver(
      entries => { for (const entry of entries) report(id, entry.intersectionRatio); },
      { threshold: [0, 0.15, ENTER_RATIO, 0.6, 1] },
    );
    observer.observe(node);
    return () => { observer.disconnect(); report(id, 0); listeners.delete(setProminent); };
  }, [id]);

  useEffect(() => {
    const ratio = visible.get(id) ?? 0;
    dispatchPlay({ type: ratio >= ENTER_RATIO && prominent === id ? 'enter' : 'exit' });
  }, [prominent, id]);

  // One clock for the whole example (§31), derived from the machine.
  useEffect(() => {
    if (!isRunning(play)) return undefined;
    const timer = setInterval(() => dispatchFrame({ type: 'tick' }), BASE_MS / frame.speed);
    return () => clearInterval(timer);
  }, [play.mode, frame.speed]);

  // The timeline reaching its end is what completes the example.
  useEffect(() => {
    if (frame.frame >= frame.total - 1 && isRunning(play)) dispatchPlay({ type: 'ended' });
  }, [frame.frame, frame.total, play.mode]);

  return { frame, dispatchFrame, play, dispatchPlay, stageRef };
}

/* ---- §11 Scenario navigation, numbered rather than segmented -------------- */
export function ScenarioNav({ scenarios, current, onSelect, label }) {
  return <nav className="scenario-nav" aria-label={label}>
    {scenarios.map((s, i) => <button key={s.id}
      className={s.id === current ? 'active' : ''}
      aria-current={s.id === current ? 'true' : undefined}
      onClick={() => onSelect(s.id)}>
      <span className="scenario-number">{String(i + 1).padStart(2, '0')}</span>
      <span className="scenario-label">{s.label}</span>
    </button>)}
  </nav>;
}

export default function EditorialPlayback({
  frame, dispatchFrame, play, dispatchPlay, stages = [], label, caption,
}) {
  const atEnd = frame.frame >= frame.total - 1;
  const action = primaryAction(play, atEnd);
  const [settingsOpen, setSettings] = useState(false);

  // Which conceptual stage owns the current frame.
  const stageIndex = useMemo(() => {
    if (!stages.length) return -1;
    let index = 0;
    stages.forEach((s, i) => { if (frame.frame >= s.frame) index = i; });
    return index;
  }, [stages, frame.frame]);

  const primary = useCallback(() => {
    if (action === 'replay') { dispatchFrame({ type: 'reset' }); dispatchPlay({ type: 'replay' }); }
    else dispatchPlay({ type: action === 'pause' ? 'pause' : 'play' });
  }, [action, dispatchFrame, dispatchPlay]);

  // §22: moving the cursor is inspection, so playback yields.
  const goToFrame = useCallback(target => {
    dispatchPlay({ type: 'inspect' });
    dispatchFrame({ type: 'seek', frame: target });
  }, [dispatchFrame, dispatchPlay]);

  // A menu that stays open sits over the stage rail and swallows clicks meant
  // for it, so it dismisses the way a menu is expected to (§21 keyboard, §14
  // secondary controls must not trap the learner).
  const settingsRef = useRef(null);
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onPointer = event => {
      if (!settingsRef.current?.contains(event.target)) setSettings(false);
    };
    const onKey = event => { if (event.key === 'Escape') setSettings(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const Icon = action === 'pause' ? Pause : action === 'replay' ? RotateCcw : Play;
  const verb = action === 'pause' ? 'Pause' : action === 'replay' ? 'Replay' : 'Play';

  return <div className="playback" data-mode={play.mode}>
    {stages.length > 0 && <div className="playback-stages">
      <p className="playback-where">
        <b>{stages[stageIndex]?.label}</b>
        <span className="playback-count">{String(frame.frame + 1).padStart(2, '0')} / {String(frame.total).padStart(2, '0')}</span>
      </p>
      {/* §7 The stages are the navigation. */}
      <ol className="stage-rail">
        {stages.map((stage, i) => <li key={stage.id}
          className={i === stageIndex ? 'active' : i < stageIndex ? 'past' : ''}>
          <button onClick={() => goToFrame(stage.frame)}
            aria-current={i === stageIndex ? 'step' : undefined}>
            <span className="stage-mark" aria-hidden="true"/>
            <span className="stage-name">{stage.label}</span>
            {stage.hint && <small>{stage.hint}</small>}
          </button>
        </li>)}
      </ol>
    </div>}

    <div className="playback-bar">
      <button className="playback-primary" onClick={primary} aria-label={`${verb} ${label}`}>
        <Icon size={15}/>
        <span>{verb}</span>
      </button>

      {/* §10 Scrubbing stays available and keyboard-operable, but is no longer
          the main way to move: it is the fine adjustment under the stages. */}
      <input className="playback-scrub" type="range"
        min="0" max={Math.max(frame.total - 1, 0)} step="1" value={frame.frame}
        aria-label={`Step through ${label}`}
        onPointerDown={() => dispatchPlay({ type: 'scrub_start' })}
        onPointerUp={() => dispatchPlay({ type: 'scrub_end' })}
        onKeyDown={() => dispatchPlay({ type: 'inspect' })}
        onChange={e => dispatchFrame({ type: 'seek', frame: Number(e.target.value) })}/>

      {/* §12 Speed is secondary configuration, not a permanent readout. */}
      <div className="playback-settings" ref={settingsRef}>
        <button className="playback-more" aria-expanded={settingsOpen}
          aria-label="Playback settings" onClick={() => setSettings(v => !v)}>
          <MoreHorizontal size={15}/>
        </button>
        {settingsOpen && <div className="playback-menu" role="group" aria-label="Playback speed">
          <p>Playback speed</p>
          {SPEEDS.map(s => <button key={s} className={s === frame.speed ? 'active' : ''}
            aria-pressed={s === frame.speed}
            onClick={() => { dispatchFrame({ type: 'speed', speed: s }); setSettings(false); }}>{s}×</button>)}
        </div>}
      </div>
    </div>

    {caption && <p className="playback-caption">{caption}</p>}
  </div>;
}
