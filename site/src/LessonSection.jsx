import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ChevronDown, FoldVertical, UnfoldVertical } from 'lucide-react';

const SectionContext = createContext(null);
const read = key => { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };

/**
 * Owns which sections are folded, per page, remembered in this browser.
 * Sections start open: this is a reading page, and folding is something you choose.
 */
export function SectionProvider({ pageId, ids, focus, children }) {
  const storageKey = `atlas-sections-${pageId}`;
  const [folded, setFolded] = useState(() => read(storageKey));
  useEffect(() => { setFolded(read(storageKey)); }, [storageKey]);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(folded)); } catch {} }, [folded, storageKey]);
  // A link into a folded section has to open it, or it scrolls to nothing.
  useEffect(() => { if (focus) setFolded(current => (current[focus] ? { ...current, [focus]: false } : current)); }, [focus]);

  const value = useMemo(() => ({
    ids, folded,
    toggle: id => setFolded(current => ({ ...current, [id]: !current[id] })),
    setAll: value => setFolded(Object.fromEntries(ids.map(id => [id, value]))),
    foldedCount: ids.filter(id => folded[id]).length,
  }), [ids, folded]);
  return <SectionContext.Provider value={value}>{children}</SectionContext.Provider>;
}

export function useSections() { return useContext(SectionContext); }

/** Fold-all / unfold-all, for the bar above a chapter. */
export function SectionControls() {
  const sections = useSections();
  if (!sections || sections.ids.length === 0) return null;
  const allFolded = sections.foldedCount === sections.ids.length;
  const Icon = allFolded ? UnfoldVertical : FoldVertical;
  return <button className="section-control" onClick={() => sections.setAll(!allFolded)}>
    <Icon size={13}/>{allFolded ? 'Open every section' : 'Fold every section'}
  </button>;
}

/**
 * One numbered chapter section. Folded, it keeps its heading and shows `summary`,
 * the few lines worth carrying away, so the page still reads as an outline.
 */
export default function LessonSection({ id, number, label, title, summary = [], children }) {
  const sections = useSections();
  const folded = !!sections?.folded[id];
  const headingId = `${id}-heading`;
  return <section id={id} className={`lesson-section ${folded ? 'folded' : ''}`}>
    <div className="section-label"><span>{number}</span> {label}</div>
    <div className="section-heading">
      <h2 id={headingId}>{title}</h2>
      {sections && <button
        className="section-toggle"
        onClick={() => sections.toggle(id)}
        aria-expanded={!folded}
        aria-controls={`${id}-body`}
        aria-labelledby={headingId}
        title={folded ? 'Open this section' : 'Fold this section'}
      ><ChevronDown size={16}/></button>}
    </div>
    {folded && summary.length > 0 && <ul className="section-summary">
      {summary.map(point => <li key={point}>{point}</li>)}
    </ul>}
    <div className="section-body" id={`${id}-body`} hidden={folded}>{children}</div>
  </section>;
}
