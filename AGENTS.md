# Working in this repository

This repo is a study workspace for LLM inference engineering, and the source of
the site published at
<https://richardcheam.github.io/inference-engineering/>.

**The design phase is closed.** Work from here is content: the accuracy, clarity
and evidence of the material. This file says where content lives, what the rules
are, and what not to touch.

---

## 1. The one rule that matters

> **Every number on this site must come from a pinned source or a tested
> function, and must say which kind of claim it is.**

The site distinguishes, visibly and in words:

| Kind | How it must be presented |
|---|---|
| **Measured** | with the workload, the boundary and the conditions |
| **Bounded** | with `≥` or `≤`, described as a bound, never as a measurement |
| **Derived** | from a named function or formula the reader can check |
| **Assumed** | with the assumption stated in the figure's assumptions block |
| **Conceptual** | labelled as a teaching model, not a claim about any real engine |

Nothing here has been run on a GPU. The site says so on the home page, and that
must stay true. If you add a claim that needs hardware, label it as a question,
not a result.

---

## 2. Where content lives

### Markdown: edit freely

These files are the site's document routes. They are bundled with `?raw`, so
**editing the file changes the published page**:

| File | Route |
|---|---|
| `README.md` | `#about`, and **also this repo's readme** |
| `CHEATSHEET.md` | `#equations` |
| `ROADMAP.md` | `#roadmap` |
| `DECISIONS.md` | `#decisions` |
| `SKILL_MATRIX.md` | `#skills` |
| `models/feasibility-study.md` | `#models` |
| `hardware/reference.md` | `#hardware-reference` |
| `engines/vllm/current-state.md` | `#engines` |
| `benchmarking/methodology.md` | `#benchmarking` |
| `radar/latest.md` | `#radar` |
| `research/sources/2026-09-15/README.md` | `#sources` |
| `experiments/QUEUE.md` | `#queue` |
| `experiments/001-feasibility/README.md` | `#example` |

Registered in `site/src/content.js`. Add a document by adding the import and one
entry there.

### Lesson prose: edit the strings, not the structure

The ten chapters are React components, `site/src/*Lesson.jsx`. They mix content
and composition. **Edit the text; leave the structure.**

Safe to change: paragraph text, `title`, `label`, `summary` bullets, `question`
and `detail` strings, takeaway wording, `MathFormula` legend descriptions,
evidence link labels.

Ask first before changing: which components a section uses, section order, the
`toc` arrays (they drive the right-hand rail), `figure="NN"` numbers (they must
stay unique across the site, and a test enforces it).

### Calculations: the source of truth

`site/src/*.mjs` (`memory.mjs`, `bandwidth.mjs`, `parallel.mjs`, `specSim.mjs`,
and the rest) with tests in `tests/`. Figures read from these, so a figure can
never drift from the model.

**If a number on a page is wrong, fix the function and its test, not the
figure.** `experiments/001-feasibility/calculations.json` holds the pinned
inputs.

---

## 3. What not to touch

The design system is settled. Do not restyle, re-theme or re-lay-out:

- `site/src/*.css`: the twelve stylesheets, their load order in `main.jsx`, and
  the semantic colour tokens (forest / teal / olive / terracotta each mean one
  thing everywhere)
- the masthead, Field Guide, right-hand rail, search overlay, index panel
- `DivisionField.jsx` and the chapter-07 figure composition
- `tests/browser/quality-gate.spec.mjs`: this is the contract, not scaffolding

If content genuinely cannot be expressed without a layout change, say so and
ask, rather than adding a style.

---

## 4. Running it

```
npm install
npm run dev          # http://127.0.0.1:4173
npm run build
npm test             # 172 unit tests: the calculations
npm run test:browser # 96 browser tests: the design and accessibility contract
```

Both suites must pass. CI runs them on every push to `main` and only deploys if
they do, so a red test means the site does not ship.

### What the browser tests protect

They are not cosmetic. Among other things they assert: no horizontal overflow at
nine viewport widths; every figure carries a unique `FIG. NN`; semantic colours
are not replaced by arbitrary ones; explanations carry no card; contrast clears
AA in both themes; reduced motion is honoured; the keyboard path works; and, in
chapter 07, that no visual dimension silently starts encoding a quantity the
model does not contain.

If a content change breaks one, the test is usually right. Read the failure
message; they are written to explain the rule.

---

## 5. House conventions for writing

- **Sentence case** for headings. No title case.
- **No em dashes.** Use a comma, a colon, or a full stop.
- British spelling in prose (`synchronisation`, `behaviour`).
- Numbers keep their units, in the same precision the calculation produces: two
  decimals below 10, one above (`2.94 GB`, `97.4 GB`).
- A lesson closes with three things in order: a takeaway, an evidence list, and
  a hand-off to the next chapter. Keep that shape.
- Say what a figure leaves out. The assumptions blocks exist to be honest about
  the model's limits; do not delete them to make a claim look stronger.

---

## 6. Design state at handover

The site passes its own gate. These are known, deliberate deferrals. They are
not bugs to fix, and they are not content work:

1. **Chapter 07 is the only art-directed chapter.** Its hero figure (the
   division field) shipped; the rest of that chapter's planned treatment did
   not. Chapters 01 to 06 and 08 to 10 use the shared grammar.
2. **Two device-count controls sit in chapter 07 §03**: the division field's
   device scale and the older placement explorer's slider. They are independent.
   A known rough edge from shipping the hero figure alone.
3. **The thirteen markdown routes inherit typography but no art direction.** A
   reader following an evidence link lands in a plainer publication.
4. **Explorer controls, segmented tabs, the library filter row and the collapsed
   icon rail remain conventional UI.**
5. **Three stylesheet layers coexist** (`design-system.css`, `editorial.css`,
   `adaptive.css`); each defines a full scale and the last one loaded wins. Some
   rules in the earliest layer are unreachable. Documented, deliberately left.
6. **`Memory & equations` is a markdown document sitting in the Field Guide's
   curriculum rail**, so the rail lists eleven entries for ten chapters.

---

## 7. Publishing

`main` deploys automatically. Commits are authored by the repository owner; do
not add co-author trailers.

The repository owner keeps design material outside this repo: art-direction
packs, skill modules, audits and their screenshots. `.gitignore` excludes
`harness/`, `design-audit/`, `inference_atlas_art_direction_ii_pack/` and
`.claude/`. Do not commit them or reintroduce them under new names.
