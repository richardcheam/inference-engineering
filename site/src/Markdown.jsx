import React, { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import { resolveDocumentLink, slugify } from './content';

export function prepareMarkdown(doc) {
  const parsed = new DOMParser().parseFromString(DOMPurify.sanitize(marked.parse(doc.text)), 'text/html');
  parsed.querySelector('h1')?.remove();
  for (const p of parsed.querySelectorAll('p')) {
    if (/^(Last researched|Started|Updated): \d{4}-/.test(p.textContent)) p.remove();
  }
  const toc = [];
  const used = new Map();
  for (const h of parsed.querySelectorAll('h2, h3')) {
    const raw = slugify(h.textContent); const count = used.get(raw) || 0; used.set(raw, count + 1);
    h.id = count ? `${raw}-${count}` : raw;
    if (h.tagName === 'H2') toc.push({ id: h.id, label: h.textContent.replace(/^\d+\.\s*/, '') });
  }
  for (const a of parsed.querySelectorAll('a[href]')) {
    const link = resolveDocumentLink(a.getAttribute('href'), doc.path);
    a.setAttribute('href', link.href);
    if (link.external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    if (link.download) { a.setAttribute('download', link.download); a.classList.add('download-link'); }
  }
  // Group each h2 and everything under it into a foldable section. Folded, it lists the
  // h3 headings inside, or falls back to its opening sentence.
  for (const heading of [...parsed.querySelectorAll('h2')]) {
    const section = parsed.createElement('section');
    section.className = 'doc-section';
    const body = parsed.createElement('div');
    body.className = 'doc-body';
    body.id = `${heading.id}-body`;
    heading.replaceWith(section);
    section.append(heading);
    let node = section.nextSibling;
    while (node && node.tagName !== 'H2' && !(node.classList && node.classList.contains('doc-section'))) {
      const next = node.nextSibling;
      body.append(node);
      node = next;
    }
    // Prefer the section's own subheadings; then a leading list, whose items are the
    // real subsections; otherwise the opening sentence.
    const lead = body.firstElementChild;
    const subheadings = [...body.querySelectorAll('h3')].map(h => h.textContent);
    const listItems = lead && /^(UL|OL)$/.test(lead.tagName)
      ? [...lead.children].slice(0, 4).map(li => li.textContent.split(/(?<=[.:])\s/)[0])
      : [];
    const opening = body.querySelector('p')?.textContent.split(/(?<=\.)\s/)[0];
    const preview = (subheadings.length ? subheadings : listItems.length ? listItems : [opening]).filter(Boolean);
    if (preview.length) {
      const list = parsed.createElement('ul');
      list.className = 'section-summary';
      for (const item of preview) {
        const li = parsed.createElement('li');
        li.textContent = item;
        list.append(li);
      }
      section.append(list);
    }
    const toggle = parsed.createElement('button');
    toggle.className = 'section-toggle doc-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', body.id);
    toggle.setAttribute('aria-label', `Fold ${heading.textContent}`);
    toggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    heading.append(toggle);
    section.append(body);
  }

  for (const table of parsed.querySelectorAll('table')) {
    const wrap = parsed.createElement('div'); wrap.className = 'table-scroll'; wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Scrollable reference table');
    table.replaceWith(wrap); wrap.append(table);
  }
  for (const code of parsed.querySelectorAll('pre > code.language-mermaid')) {
    const diagram = parsed.createElement('figure'); diagram.className = 'topology-diagram';
    diagram.innerHTML = '<div class="topology-pair"><div><b>Hopper 0</b><span>Local HBM</span></div><span class="topology-link">↔<small>NVLink-C2C</small></span><div><b>Grace 0</b><span>Local LPDDR</span></div></div><div class="topology-peer">↕ &nbsp; Peer paths depend on the actual topology &nbsp; ↕</div><div class="topology-pair"><div><b>Hopper 1</b><span>Local HBM</span></div><span class="topology-link">↔<small>NVLink-C2C</small></span><div><b>Grace 1</b><span>Local LPDDR</span></div></div><figcaption>Conceptual dual-GH200 memory paths. Local and remote memory have different access costs.</figcaption>';
    code.parentElement.replaceWith(diagram);
  }
  for (const pre of parsed.querySelectorAll('pre')) {
    const button = parsed.createElement('button'); button.className = 'copy-code'; button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code'); pre.append(button);
  }
  return { html: parsed.body.innerHTML, toc };
}

export default function Markdown({ doc, onToc }) {
  const ref = useRef(null);
  const prepared = useMemo(() => prepareMarkdown(doc), [doc]);
  useEffect(() => { onToc(prepared.toc); }, [prepared, onToc]);
  useEffect(() => {
    renderMathInElement(ref.current, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
    const el = ref.current;
    const listener = async (event) => {
      const toggle = event.target.closest('.doc-toggle');
      if (toggle) {
        const section = toggle.closest('.doc-section');
        const folded = section.classList.toggle('folded');
        section.querySelector('.doc-body').hidden = folded;
        toggle.setAttribute('aria-expanded', String(!folded));
        toggle.setAttribute('aria-label', `${folded ? 'Open' : 'Fold'} ${section.querySelector('h2').firstChild.textContent}`);
        return;
      }
      const button = event.target.closest('.copy-code'); if (!button) return;
      try { await navigator.clipboard.writeText(button.parentElement.querySelector('code').textContent); button.textContent = 'Copied'; }
      catch { button.textContent = 'Select to copy'; }
      setTimeout(() => { if (button.isConnected) button.textContent = 'Copy'; }, 1800);
    };
    el.addEventListener('click', listener); return () => el.removeEventListener('click', listener);
  }, [prepared]);
  return <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: prepared.html }} />;
}
