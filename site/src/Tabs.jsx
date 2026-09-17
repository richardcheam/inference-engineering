import React, { useId, useState } from 'react';

/**
 * A small tab strip. `tabs` is [{ id, label, Icon, render }].
 * Arrow keys move between tabs, as the pattern expects.
 */
export default function Tabs({ tabs, label, initial }) {
  const [active, setActive] = useState(initial || tabs[0].id);
  const base = useId();
  const index = tabs.findIndex(t => t.id === active);
  const current = tabs[index] || tabs[0];

  const onKeyDown = event => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`${base}-${next.id}`)?.focus();
  };

  return <div className="tabs">
    <div className="tab-strip" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map(tab => {
        const selected = tab.id === active;
        return <button
          key={tab.id}
          id={`${base}-${tab.id}`}
          role="tab"
          type="button"
          aria-selected={selected}
          aria-controls={`${base}-${tab.id}-panel`}
          tabIndex={selected ? 0 : -1}
          className={selected ? 'active' : ''}
          onClick={() => setActive(tab.id)}
        >{tab.Icon && <tab.Icon size={13}/>}{tab.label}</button>;
      })}
    </div>
    <div className="tab-panel" role="tabpanel" id={`${base}-${current.id}-panel`} aria-labelledby={`${base}-${current.id}`} tabIndex={0}>
      {current.render()}
    </div>
  </div>;
}
