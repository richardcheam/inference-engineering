import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, ArrowUpRight, BookOpen, Bookmark, Box, ChartNoAxesCombined, Check, ChevronDown, ChevronLeft, Clock3, Command, Compass, Cpu, FileText, FunctionSquare, Info, Layers3, List, Map, Menu, Moon, NotebookPen, Radar, Search, Sun, Workflow, X } from 'lucide-react';
import { allPages } from './content';
import Lesson, { lessonToc, MemoryArt } from './Lesson';
import HardwareLesson, { hardwareToc, RateArt } from './HardwareLesson';
import ReuseLesson, { reuseToc, ReuseArt } from './ReuseLesson';
import EngineLesson, { engineToc, BlockArt } from './EngineLesson';
import MeasureLesson, { measureToc, StreamArt } from './MeasureLesson';
import ProfileLesson, { profileToc, ScopeArt } from './ProfileLesson';
import ParallelLesson, { parallelToc, GridArt } from './ParallelLesson';
import QuantizeLesson, { quantizeToc, PrecisionArt } from './QuantizeLesson';
import SpeculateLesson, { speculateToc, SpeculateArt } from './SpeculateLesson';
import ProductionLesson, { productionToc, CapstoneArt } from './ProductionLesson';
import Home from './Home';
import Markdown from './Markdown';
import { SectionControls, SectionProvider, useSections } from './LessonSection';

const chapters = {
  feasibility: { Body: Lesson, Art: MemoryArt, toc: lessonToc },
  hardware: { Body: HardwareLesson, Art: RateArt, toc: hardwareToc },
  reuse: { Body: ReuseLesson, Art: ReuseArt, toc: reuseToc },
  engine: { Body: EngineLesson, Art: BlockArt, toc: engineToc },
  measure: { Body: MeasureLesson, Art: StreamArt, toc: measureToc },
  profile: { Body: ProfileLesson, Art: ScopeArt, toc: profileToc },
  parallel: { Body: ParallelLesson, Art: GridArt, toc: parallelToc },
  quantize: { Body: QuantizeLesson, Art: PrecisionArt, toc: quantizeToc },
  speculate: { Body: SpeculateLesson, Art: SpeculateArt, toc: speculateToc },
  production: { Body: ProductionLesson, Art: CapstoneArt, toc: productionToc },
};

const icons = { box: Box, layers: Layers3, cpu: Cpu, function: FunctionSquare, workflow: Workflow, chart: ChartNoAxesCombined, map: Map, radar: Radar, book: BookOpen, notebook: NotebookPen, list: List, file: FileText, info: Info, compass: Compass };
function Icon({ name, ...props }) { const Component = icons[name] || BookOpen; return <Component {...props}/>; }
function readPreference(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writePreference(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function readRoute() { const [id, section] = window.location.hash.slice(1).split('~'); return { id: id || 'home', section }; }

function SearchDialog({ open, close, opener }) {
  const ref = useRef(null); const input = useRef(null); const [query, setQuery] = useState('');
  useEffect(() => {
    if (open) { setQuery(''); ref.current.showModal(); input.current.focus(); }
    else if (ref.current.open) { ref.current.close(); opener.current?.focus(); }
  }, [open, opener]);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = allPages.filter(p => terms.every(t => `${p.title} ${p.description} ${p.text}`.toLowerCase().includes(t))).slice(0,9);
  return <dialog ref={ref} className="search-dialog" onCancel={close} onClick={e => { if (e.target === ref.current) close(); }} aria-label="Search the atlas">
    <div className="search-input-row"><Search size={20}/><input ref={input} aria-label="Search lessons and notes" placeholder="Search a concept, model, or question…" value={query} onChange={e => setQuery(e.target.value)}/><button className="kbd-button" onClick={close}>esc</button></div>
    <div className="search-results"><div className="search-label">{query ? `${results.length} matching resources` : 'EXPLORE THE GUIDE'}</div>{results.length ? results.map(p => <a key={p.id} href={`#${p.id}`} onClick={close}><span className="result-icon"><Icon name={p.icon} size={18}/></span><div><b>{p.title}</b><p>{p.description}</p></div><ArrowUpRight size={16}/></a>) : <div className="empty-search"><Search size={26}/><h3>No matches yet</h3><p>Try “KV cache”, “GH200”, “GLM”, or “throughput”.</p></div>}</div>
    <div className="search-footer"><span>Search across all lessons and reference notes</span><span><kbd>tab</kbd> to navigate <kbd>↵</kbd> to open</span></div>
  </dialog>;
}

function Sidebar({ id, open, close, collapsed, toggleCollapsed }) {
  const groups = [
    { title: 'LEARN THE FOUNDATIONS', ids: ['feasibility','hardware','reuse','equations'] },
    { title: 'UNDERSTAND THE SYSTEM', ids: ['engine','measure','profile','parallel'] },
    { title: 'MAKE IT PRODUCTION', ids: ['quantize','speculate','production'] },
    { title: 'YOUR FIELD NOTES', ids: ['roadmap','radar','sources'] },
  ];
  return <><div className={`sidebar-backdrop ${open ? 'visible' : ''}`} onClick={close}/><aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Topic navigation"><div className="sidebar-caption"><span>THE FIELD GUIDE</span><button className="nav-collapse" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-controls="sidebar-nav" title={collapsed ? 'Expand navigation' : 'Collapse navigation'}><ChevronLeft size={14}/></button></div><div className="sidebar-scroll" id="sidebar-nav"><nav>{groups.map(group => <div className="nav-group" key={group.title}><h2>{group.title}</h2>{group.ids.map(pageId => { const p = allPages.find(p => p.id === pageId); return <a key={p.id} href={`#${p.id}`} className={id === p.id ? 'active' : ''} aria-current={id === p.id ? 'page' : undefined} onClick={close} title={collapsed ? p.short : undefined}><Icon name={p.icon} size={17}/><span>{p.short}</span>{id === p.id && <span className="active-dot"/>}</a>; })}</div>)}</nav></div><div className="sidebar-bottom"><a href="#library" className="sidebar-link" onClick={close} title={collapsed ? 'All resources' : undefined}><BookOpen size={16}/><span>All resources</span><em>{allPages.length}</em></a></div></aside></>;
}

function useActiveSection(toc, id) {
  const [active, setActive] = useState('');
  useEffect(() => {
    setActive(toc[0]?.id || '');
    const observer = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); }, { rootMargin: '-100px 0px -65% 0px' });
    toc.forEach(t => { const node = document.getElementById(t.id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [toc, id]);
  return active;
}

/** The section list, shared by the rail and the drawer. Folds from here too, when the page has folding sections. */
function TocList({ id, toc, active, onNavigate }) {
  const sections = useSections();
  const foldable = sections && sections.ids.length > 0;
  return <nav aria-label="On this page">{toc.map((t, i) => {
    const folded = foldable && sections.folded[t.id];
    return <span className={`toc-row ${active === t.id ? 'active' : ''} ${folded ? 'folded' : ''}`} key={t.id}>
      <a href={`#${id}~${t.id}`} onClick={onNavigate}><span>{String(i+1).padStart(2,'0')}</span>{t.label}</a>
      {foldable && <button className="toc-fold" onClick={() => sections.toggle(t.id)} aria-expanded={!folded} aria-label={`${folded ? 'Open' : 'Fold'} ${t.label}`} title={folded ? 'Open this section' : 'Fold this section'}><ChevronDown size={12}/></button>}
    </span>;
  })}</nav>;
}

function TableOfContents({ id, toc }) {
  const active = useActiveSection(toc, id);
  if (!toc.length) return <aside className="page-rail"/>;
  return <aside className="page-rail"><div className="toc"><span className="eyebrow">ON THIS PAGE</span><TocList id={id} toc={toc} active={active}/></div><a className="rail-source" href="#sources"><FileText size={14}/>Source registry <ArrowUpRight size={12}/></a></aside>;
}

/** Below the rail's breakpoint the page has no section navigation at all, so it becomes a sheet. */
function TocDrawer({ id, toc }) {
  const [open, setOpen] = useState(false);
  const active = useActiveSection(toc, id);
  useEffect(() => { setOpen(false); }, [id]);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!toc.length) return null;
  return <div className="toc-drawer">
    <button className="toc-fab" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="toc-sheet">
      {open ? <X size={15}/> : <List size={15}/>}<span>{open ? 'Close' : 'On this page'}</span>
    </button>
    {open && <div className="toc-backdrop" onClick={() => setOpen(false)}/>}
    <div className="toc-sheet" id="toc-sheet" hidden={!open}>
      {open && <>
        <div className="toc-sheet-head"><span className="eyebrow">ON THIS PAGE</span><SectionControls/></div>
        <TocList id={id} toc={toc} active={active} onNavigate={() => setOpen(false)}/>
      </>}
    </div>
  </div>;
}

/**
 * The archive listing. `06` §4 and `08` both rule out a card grid here: this is
 * an index of work, so it reads as editorial rows under category rules. Grouping
 * is dropped once a filter or query is active, because then the category is
 * already known and the headings would only repeat it.
 */
const CATEGORY_ORDER = ['Foundations', 'Models', 'Systems', 'Notebook', 'Reference'];

function ArchiveRow({ page, saved }) {
  return <li>
    <a href={`#${page.id}`}>
      <span className="archive-text">
        <b>{page.title}{saved && <Bookmark size={13} fill="currentColor" aria-label="Saved"/>}</b>
        <small>{page.description}</small>
      </span>
      <span className="archive-time">{page.time}</span>
      <ArrowUpRight size={16} className="archive-arrow"/>
    </a>
  </li>;
}

function Archive({ pages, bookmarks, grouped }) {
  if (!grouped) return <ol className="archive">
    {pages.map(p => <ArchiveRow key={p.id} page={p} saved={bookmarks.includes(p.id)}/>)}
  </ol>;
  const groups = CATEGORY_ORDER
    .map(category => [category, pages.filter(p => p.category === category)])
    .filter(([, items]) => items.length);
  return <>{groups.map(([category, items]) => <section className="archive-group" key={category}>
    <h2>{category}<span>{items.length}</span></h2>
    <ol className="archive">
      {items.map(p => <ArchiveRow key={p.id} page={p} saved={bookmarks.includes(p.id)}/>)}
    </ol>
  </section>)}</>;
}

function Library({ bookmarksOnly, bookmarks }) {
  const [filter, setFilter] = useState('All'); const [query, setQuery] = useState('');
  useEffect(() => { setFilter('All'); setQuery(''); }, [bookmarksOnly]);
  const pages = allPages.filter(p => (!bookmarksOnly || bookmarks.includes(p.id)) && (filter==='All' || p.category===filter) && `${p.title} ${p.text}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="library-page"><span className="kicker">YOUR INFERENCE FIELD GUIDE</span><h1>{bookmarksOnly ? 'Keep the useful things close.' : 'A place for every question.'}</h1><p className="page-description">{bookmarksOnly ? 'Your saved lessons and references, stored in this browser.' : 'Explore the concepts, systems, and evidence behind modern LLM inference.'}</p><div className="library-tools"><div className="filter-tabs" aria-label="Resource category">{['All','Foundations','Models','Systems','Notebook','Reference'].map(c => <button key={c} className={filter===c?'active':''} onClick={()=>setFilter(c)} aria-pressed={filter===c}>{c}</button>)}</div><label className="library-search"><Search size={16}/><input aria-label="Filter resources" placeholder="Find a resource…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="resource-count">{pages.length} {pages.length === 1 ? 'resource' : 'resources'}</div><Archive pages={pages} bookmarks={bookmarks} grouped={filter==='All'&&!query}/>{!pages.length&&<div className="library-empty"><Bookmark size={32}/><h2>{bookmarksOnly ? 'Your reading shelf is ready.' : 'No matching resources.'}</h2><p>{bookmarksOnly ? 'Use “Save” on any lesson to keep it here.' : 'Try another category or search term.'}</p><a className="inline-link" href="#feasibility">Read the first lesson <ArrowRight size={15}/></a></div>}</div>;
}

export default function App() {
  const [route,setRoute] = useState(readRoute);
  const [menu,setMenu] = useState(false);
  const [search,setSearch] = useState(false);
  const [theme,setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const [bookmarks,setBookmarks] = useState(() => { const value = readPreference('atlas-bookmarks',[]); return Array.isArray(value) ? value.filter(id => allPages.some(p => p.id === id)) : []; });
  const [docToc,setDocToc] = useState([]);
  const [navCollapsed,setNavCollapsed] = useState(() => readPreference('atlas-nav-collapsed', false) === true);
  const searchButton=useRef(null); const closeSearch=useCallback(()=>setSearch(false),[]);
  const onToc=useCallback(toc=>setDocToc(toc),[]);
  const page=allPages.find(p=>p.id===route.id);
  const isLibrary=route.id==='library'||route.id==='bookmarks';
  const isHome=route.id==='home';
  const chapter=chapters[route.id];
  const toc=chapter?chapter.toc:docToc;
  // Route changes go through a view transition so chapters cross-fade instead of
  // snapping. Falls back to a plain state update where unsupported or unwanted.
  useEffect(()=> {
    const apply=()=>setRoute(readRoute());
    const listener=()=>{
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!document.startViewTransition||reduced){apply();return;}
      document.startViewTransition(()=>flushSync(apply));
    };
    window.addEventListener('hashchange',listener);
    return()=>window.removeEventListener('hashchange',listener);
  },[]);
  useEffect(()=> { const listener=e=>{ if ((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k') {e.preventDefault();setSearch(v=>!v);} if(e.key==='Escape')setMenu(false); };window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  useEffect(()=> { document.documentElement.dataset.nav = navCollapsed ? 'collapsed' : 'open'; writePreference('atlas-nav-collapsed', navCollapsed); },[navCollapsed]);
  // The masthead shares the canvas, so it needs no boundary until something
  // passes underneath it. Passive listener; no layout read per frame.
  useEffect(()=> {
    const bar=document.querySelector('.topbar');
    if(!bar) return;
    const onScroll=()=>bar.classList.toggle('is-scrolled', window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return ()=>window.removeEventListener('scroll', onScroll);
  },[]);
  useEffect(()=> { document.documentElement.dataset.theme=theme; try {localStorage.setItem('atlas-theme',theme);}catch{} },[theme]);
  useEffect(()=>{ document.title=route.id==='home'?'Inference Engineering · A field guide':`${page?.title || (route.id==='bookmarks'?'Saved resources':'The library')} · Inference Engineering`; setMenu(false); if(!route.section)window.scrollTo({top:0,behavior:'instant'}); },[route.id]);
  useEffect(()=>{ if(route.section) { const timer=setTimeout(()=>document.getElementById(route.section)?.scrollIntoView({behavior:'instant',block:'start'}),80);return()=>clearTimeout(timer);} },[route,docToc]);
  const toggleBookmark=()=>setBookmarks(current=>{const next=current.includes(route.id)?current.filter(id=>id!==route.id):[...current,route.id];writePreference('atlas-bookmarks',next);return next;});
  return <><a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>Skip to content</a><header className="topbar"><div className="brand-area">{!isHome&&<button className="icon-button mobile-menu" aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>{menu?<X size={21}/>:<Menu size={21}/>}</button>}<a className="brand" href="#home"><span className="brand-mark"><span/><span/><span/></span><span>inference<span className="brand-light">engineering</span><small>A FIELD GUIDE</small></span></a></div><nav className="topnav" aria-label="Main navigation"><a href="#feasibility" className={!isLibrary&&!isHome?'active':''}>Study</a><a href="#library" className={route.id==='library'?'active':''}>Library</a><a href="#bookmarks" className={route.id==='bookmarks'?'active':''}>Saved{bookmarks.length>0&&<span>{bookmarks.length}</span>}</a></nav><div className="top-actions"><button ref={searchButton} className="search-trigger" aria-label="Search the atlas" onClick={()=>setSearch(true)}><Search size={16}/><span>Search anything</span><kbd><Command size={10}/> K</kbd></button><button className="icon-button theme-toggle" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button></div></header>
    {!isHome&&<Sidebar id={route.id} open={menu} close={()=>setMenu(false)} collapsed={navCollapsed} toggleCollapsed={()=>setNavCollapsed(v=>!v)}/>}
    <main id="main-content" tabIndex="-1" className={`workspace ds ${isLibrary?'wide':''} ${isHome?'at-home':''}`}>
      {route.id==='home'?<Home/>:isLibrary?<Library bookmarksOnly={route.id==='bookmarks'} bookmarks={bookmarks}/>:page?<SectionProvider pageId={page.id} ids={chapter?chapter.toc.map(t=>t.id):[]} focus={route.section}><div className="reading-layout"><article className="article"><div className={`article-header ${chapter?'lesson-header':''}`}><div className="article-heading"><span className="kicker">{page.kicker||page.category.toUpperCase()+' · FIELD NOTES'}</span><h1>{page.title}</h1><p className="page-description">{page.description}</p><div className="article-meta"><span><Clock3 size={13}/>{page.time} read</span><button className={`save-button ${bookmarks.includes(page.id)?'saved':''}`} onClick={toggleBookmark} aria-pressed={bookmarks.includes(page.id)}>{bookmarks.includes(page.id)?<Check size={14}/>:<Bookmark size={14}/>} {bookmarks.includes(page.id)?'Saved':'Save'}</button>{chapter&&<SectionControls/>}</div></div>{chapter&&<chapter.Art/>}</div>{chapter?<><chapter.Body/></>:<Markdown doc={page} onToc={onToc}/>}</article><TableOfContents id={route.id} toc={toc}/></div><TocDrawer id={route.id} toc={toc}/></SectionProvider>:<div className="not-found"><h1>This page isn’t in the atlas.</h1><p>The link may have changed. All current material is in the library.</p><a href="#library" className="inline-link">Explore the library <ArrowRight size={16}/></a></div>}
    </main><SearchDialog open={search} close={closeSearch} opener={searchButton}/></>;
}
