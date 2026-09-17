# Design system — Inference Atlas

Added 2026-09-16 in `site/src/design-system.css`, after the audit in
`2026-09-16-design-audit.md`. Governed by `.claude/learning-ui-skill.md`.

**Rule: components never use raw values.** Before adding a token, check whether an existing one
already expresses the semantic role.

## Type scale

Base is 17px prose on desktop, 16px below 640px. Nothing under 13px carries learning content.

| Token | Size | Role |
|---|---:|---|
| `--text-meta` | 12px | counts and timestamps only |
| `--text-xs` | 13px | captions, axis labels, eyebrows |
| `--text-sm` | 14px | secondary UI, table of contents, legends, table cells |
| `--text-base` | 16px | body on small screens, card bodies, key ideas |
| `--text-body` | 17px | body prose |
| `--text-md` | 19px | lead paragraph, large data readouts |
| `--text-lg` | 22px | h3 |
| `--text-xl` | 26px | h2, section headings |
| `--text-2xl` | 32px | h1, headline figures |

Line height: `--leading-tight` 1.25 (headings), `--leading-snug` 1.45 (dense UI),
`--leading-prose` 1.65 (body — inside the required 1.55–1.75).

The h1-to-body ratio is **1.88**, down from 4.5. There is no hero typography.

## Spacing

Four-pixel base, eight steps: `--space-1` 4px through `--space-8` 64px. Replaces the 45 margin,
34 padding and 28 gap values found in the audit.

## Content widths

| Token | Value | Role |
|---|---|---|
| `--measure` | 62ch | prose — lands at 72–79 real characters |
| `--measure-wide` | 90ch | tables, charts, interactive panels |
| `--rail-width` | 15rem | section rail, sized so 14px labels do not wrap |
| `--sidebar-width` | 15.5rem | primary navigation |
| `--topbar-height` | 78px | fixed masthead |

Measure is expressed in `ch` so it tracks the font rather than a magic pixel count.

## Colour

Semantic names only; 22 tokens per theme replacing 153 literals.

`--bg`, `--surface`, `--surface-sunk`, `--sidebar`, `--ink`, `--text`, `--muted`, `--line`,
`--line-strong`, `--accent`, `--accent-soft`, `--accent-ink`, `--warn`, `--warn-soft`,
`--warn-ink`, `--data-1..3`, `--shadow`.

Both themes define the full set, so no component needs a theme-specific override.

## Borders and radius

`--border` (1px `--line`), `--border-strong`, `--border-accent` (2px `--accent`).
Radius is three values: `--radius-sm` 3px, `--radius-md` 6px, `--radius-pill`. Replaces 12.

## Motion

`--motion-fast` 120ms, `--motion-base` 180ms, `--motion-slow` 260ms, `--ease`.
The existing global `prefers-reduced-motion` rule disables all of it; no animation autoplays.

## Learning-content categories

The skill forbids giving every category its own card. Current treatment:

| Category | Treatment |
|---|---|
| Concept / prose | body type at measure |
| Key idea, intuition | left accent rule, no card, no fill |
| Warning | left rule in `--warn`, no fill |
| Formal definition, equation | sunk surface, legend joined directly beneath in one bordered unit |
| Worked example, interactive | single bordered panel |
| Implementation detail | source-quote block with a file header |
| Key takeaway | tinted panel, once per chapter |

## Adoption

Scoped to `.ds` on the workspace element. It began on chapter 02 alone, was verified at all five
viewports, then propagated to every page. The scope is retained so a future variant can be piloted
the same way.

Two changes are global rather than `.ds`-scoped, because they are app chrome:
the sidebar becomes a drawer up to 1024px, and the brand area lays out as a row in that range.

## Adaptive responsiveness — Phase 7 validation and Phase 8 quality gate

Source of requirements: the adaptive-layout and quality-gate briefs. Those are
development material and are not part of this repository; what they decided is
recorded here.
Implementation lives in `site/src/adaptive.css`, loaded last.

### Phase 7 — measured, 11 viewports × 17 routes (187 combinations)

Metrics taken on `#hardware`; overflow checked on every route at every viewport.

| Viewport | Overflow | Prose | Track | Rail | Gap | Outer |
|---|---|---|---|---|---|---|
| 375×812 | none | 303px (34ch) | 303 | drawer | — | 36 |
| 430×932 | none | 358px (40ch) | 358 | drawer | — | 36 |
| 768×1024 | none | 544px (60ch) | 678 | drawer | — | 45 |
| 1024×768 | none | 544px (60ch) | 691 | drawer | — | 167 |
| 1280×800 | none | 544px (60ch) | 709 | 192 | 38 | 67 |
| 1440×900 | none | 547px (61ch) | 847 | 192 | 43 | 75 |
| 1512×982 | none | 575px (64ch) | 901 | 197 | 45 | 79 |
| 1728×1117 | none | 640px (71ch) | 1030 | 225 | 52 | 90 |
| 1920×1080 | none | 640px (71ch) | 1144 | 250 | 58 | 100 |
| 2560×1440 | none | 640px (71ch) | 1184 | 256 | 72 | 388 |
| 3440×1440 | none | 640px (71ch) | 1184 | 256 | 72 | 828 |

Prose stays between 34 and 71 characters. The article/TOC gap stays between 38px
and 72px at every desktop width — the original defect was a 1288px gap at 2560px.
Surplus width past 2560px goes to the outer gutter as intentional negative space,
which is the behaviour the task asks for.

Screenshots: `phase7/{mobile,laptop13,desktop,monitor27}-{sources,hardware}.png`
in the session scratchpad.

### Phase 8 gate

| Check | Result |
|---|---|
| No horizontal overflow | Pass — 187/187 combinations clean |
| No 500–1000px void between article and TOC | Pass — 38–72px |
| Prose not excessively wide | Pass — ≤71ch |
| TOC related to the article | Pass — adjacent track, sticky at `top: 120px`, below the 78px masthead |
| Tables benefit from large screens | Pass — 343px → 1182px |
| Diagrams benefit from large screens | Pass — artifacts take the full wide track |
| Left rail not comically large | Pass — `clamp(13rem, 14vw, 17rem)`, 256px at 3440 |
| Typography bounded | Pass — every size is a bounded `clamp()` |
| Mobile usable | Pass after fixes below |
| Sticky elements do not collide | Pass — masthead 0–78, sidebar 78+, rail 120+ |
| Reduced motion unaffected | Pass — `adaptive.css` contains no motion; the five `prefers-reduced-motion` blocks in `motion.css`/`styles.css` are untouched |
| No 2560px-specific hack | Pass — the only occurrence of "2560" in CSS is a comment |
| No device-name logic | Pass — no `iphone`/`ipad`/`macbook`/`android`/`retina` in any stylesheet |

### Defects found by the gate and fixed

1. **`.chart-title` label forced the document wider than the phone.** Its
   right-hand caption carried `white-space: nowrap`, so "PINNED FIGURES ·
   HARDWARE REFERENCE" set a 334px floor inside a 243px card and pushed the
   whole page sideways at 375px. It now wraps; on a wide track it still sits on
   one line, so nothing changes there.
2. **Hero lede was narrower than the body it introduces.** The §7 two-column
   hero split 1.45fr/0.55fr, leaving 20px display type at 26 characters. Now
   1.2fr/0.8fr with a 20rem floor — 36–42 characters.
3. **Range inputs had a 4px touch target.** They drive every explorer. Padding
   grows the box to 44px without replacing the native control, so `accent-color`
   still paints the filled portion.
4. **Transport buttons were 29px.** Enlarged to 44px under
   `(pointer: coarse), (max-width: 47.9375rem)` — a capability query, not a
   device name.
5. **Fold chevron was orphaned mid-track.** Headings cap at 26ch, so on a wide
   track the control floated in open space. It now sits at the track edge,
   aligned with the section rule above it.

## Landing page

`site/src/Home.jsx` + `site/src/home.css`, route `home`, now the default.

Composition, following `06_portfolio_information_architecture` §2–§4:

1. **Hero.** Kicker, a two-sentence statement set as two independently balanced
   blocks (the second in `--muted`, so the pair reads as claim and consequence),
   a lede at prose measure, and one text link into chapter one.
2. **Hero artifact.** The decode walkthrough, framed by a heading that states
   what it is for. No decoration: §2 of `05_engineering_visual_language` asks the
   hero to be real material.
3. **Editorial index.** Ten rows of number / question / path / duration. §4
   explicitly rules out a card grid. Hover bleeds a surface panel out to the page
   gutter rather than lifting a card.
4. **Evidence stance.** What the workspace has not done, before any number.

The chapter rail is hidden on this route (`.workspace.at-home`), along with the
mobile menu button that would otherwise open nothing, so the entry page is a
statement rather than a directory.

Validated at all 11 Phase 7 viewports: no horizontal overflow on any of the 18
routes, hero and index track the shell from 303px to 1072px.

## Typography: no em dashes

Every em dash was removed from the site and from the bundled markdown (94
occurrences across 30 files), replaced per sentence rather than mechanically:
comma for an appositive, colon where an explanation follows a claim, semicolon or
full stop between independent clauses, parentheses for a paired aside. Structural
separators became `·` (tab titles, `DECISIONS.md` headings). Dashes standing in
for missing data became words: the unpinned Grace LPDDR figure reads `n/a`, and
so does a null latency in `StreamExplorer`. The discarded-token marker in the
speculation animation became `·`, since `×` already means rejected there.

Verified by rendering every route and scanning `innerText`: zero occurrences.

## Style modes (SKILL.md workflow step 4)

This was applied but never declared. Recorded now, per `02_style_modes.md`:

| Surface | Primary mode | Secondary |
|---|---|---|
| Homepage | Quiet Luxury | — |
| Chapters | Scandinavian Editorial | Product Cinema |
| Library / registry | Scandinavian Editorial | — |

`02` names Scandinavian Editorial + Product Cinema as "the best educational
explainer combination", which is what the chapters are. The homepage follows
`02`'s default recommendation for an index surface: silence, large scale, an
archive-like list, one dominant artifact. No page carries Conceptual Campaign.

## The third typographic voice

`00_identity_profile` names three voices: editorial display, reading sans, and a
technical mono that is "an engineering annotation layer". Two existed. The mono
was a system fallback stack referenced three times in the whole stylesheet, so
the annotation layer was effectively missing, and on a machine without SF Mono it
would have fallen back to Courier.

Meanwhile Newsreader was shipping 108 KB of webfont that no rule could reach:
`editorial.css` remaps `--serif` to the grotesk and loads after
`design-system.css`, so the serif had been dead since the editorial pass.

The serif payload is now JetBrains Mono (`main.jsx`), and `editorial.css` §23
applies it where `00` asks: figure labels and micro-labels (`.eyebrow`,
`.kicker`, `.walk-label`, `.section-label`, chart axis labels) and measured
values (ledger bytes, ladder and weight rows, precision rows, lane counts,
transport step, chapter durations). Prose and display type are untouched.

Net font payload: 624 KB → 604 KB.

## The archive listing

The library and the saved-resources page rendered a three-up grid of cards, each
an icon tile in a rounded square, a category label, a title, a description, a
read time and an arrow. That is the pattern `06` §4 rules out by name ("Do not
use 3-up cards"), the one `08` lists first under "Components to Avoid by
Default", the one Law 3 of SKILL.md names ("Do not default to metric cards,
four-column feature grids, rounded SaaS cards"), and the one the Mandatory
Workflow closes on ("Do not start by generating cards"). It survived every
earlier pass because the design work had been aimed at the chapters.

It is now an editorial archive built from the same row language as the homepage
index, so both index surfaces read as one system:

- category rules carrying a mono label and a count
- rows of title, description, duration, arrow, with no card shell
- the saved marker inline with the title, because it is state, not decoration
- grouping drops as soon as a filter or query is active, since the category is
  then already known and the headings would only repeat it

Removed with it: 28 now-dead CSS rules across `styles.css`, `design-system.css`,
`editorial.css` and `motion.css` (`.resource-card`, `.resource-grid`,
`.resource-icon`, including their hover lift and three responsive overrides).
Stylesheet 160.10 KB → 159.94 KB.

Verified: grouped 5 groups / 23 rows, filtered 0 groups / 9 rows, empty state
intact, no horizontal overflow on 18 routes × 11 viewports.

## Modules 01 and 07

`01_reference_library.md` is a set of source sites and what to borrow from each,
not a checklist. The item that transfers is ARKET's editorial archive, which is
what the library page has now become.

`07_case_study_design.md` describes a flagship project case study: cover, the
constraint, the system, the bottleneck, the intervention, evidence, failure and
uncertainty. This workspace has no intervention to report and no benchmark to
show, so the structure does not apply. Its two transferable principles, §7
uncertainty treated as serious editorial content rather than a red error card,
and §8 concrete rather than generic lessons, are already how each chapter ends
and how the homepage evidence note is written.

## The figure system

`05_engineering_visual_language` §3 asks every serious visual to carry a figure
number, a title, the artifact, an interpretation, and provenance. `08` calls this
the "central identity component". An audit of all twelve interactive figures found
four of the five parts already present: each carries a title in its heading,
provenance in its `.assumptions` block, and an interpretation, either as prose,
a chart title that states the claim, or a `MetricStrip` of live readouts
(`08`'s "flat row with rules", which is what `.bound-headline` already is).

Only the identifier was missing. Each figure component now accepts a `figure`
prop and renders it opposite its title in the heading, which was already a
space-between flex row, so no new structure was needed. `.figure-id` uses the
mono annotation layer.

Numbering runs across the whole guide rather than restarting per chapter, so a
number is a citable handle rather than a per-page ordinal:

| Fig. | Figure | Chapter |
|---|---|---|
| 01 | Decode walkthrough | Homepage and ch. 1 |
| 02 | Memory budget explorer | 1 |
| 03 | Decode step explorer | 2 |
| 04 | Expert reuse explorer | 3 |
| 05 | Prefix cache explorer | 4 |
| 06 | Engine step loop | 4 |
| 07 | Token stream explorer | 5 |
| 08 | Bottleneck differential | 6 |
| 09 | Placement explorer | 7 |
| 10 | Precision explorer | 8 |
| 11 | Speculation break-even | 9 |
| 12 | A speculation round | 9 |

Fig. 01 carries the same number on the homepage and in chapter one because it is
the same artifact. The deployment checklist takes no number: its heading already
carries live progress, and it is a tool rather than a figure.

Verified: correct identifiers on all ten chapters, no heading wrap and no
horizontal overflow at any of the 11 viewports.

## Gate 10 — remove 20% of decorative UI

`09_critique_and_quality_gate.md` Gate 10 asks for the deletion to be made and
kept only if the page improves. Run on the chapter template, which carried 35
icons.

Removed, 63 icons across 23 files: the callout icon (24), the takeaway icon
(10), the assumptions icon (13), the memory-part icon (3), and the figure
heading icon (13). Each sat beside text that already named the thing. The
callout in particular now matches `08`'s `Finding` component, which says "no
icon required": a coloured rule, an uppercase label, and the sentence. The
figure headings lost theirs because the figure number now carries the
information the glyph was standing in for.

Kept: every icon that is a control or an affordance (fold toggles, save, TOC
controls, arrows on links), and the `decision-flow` arrows, which are connectors
rather than labels.

35 → 26 icons on a chapter page, a 26% reduction. Stylesheet 159.94 → 159.51 KB.

This also surfaced a latent bug: `.memory-part` at ≤480px was a
`grid-template-columns: 26px 1fr` reserving a column for the icon, which after
the deletion would have left an empty 26px gutter on every phone. It is a plain
block now. Nine now-unused `Icon` properties were dropped from the memory-part
data, and 60 lucide imports across 23 files were pruned.

## Module 03 audit

Checked against concrete values rather than by eye:

| `03` requirement | Site | |
|---|---|---|
| §2 prose 45–75 characters | 34–71 | pass |
| §3 WIDE 1000–1200px | 1184px max | pass |
| §5 display line-height 0.88–0.98 | 0.98 | pass |
| §5 display tracking −0.03 to −0.055em | −0.03em | pass |
| §5 body line-height 1.55–1.75 | 1.6 | pass |
| §7 labels 11–13px | 12px | pass |
| §7 label tracking 0.04–0.1em | **0.14em / 0.12em** | **fixed → 0.08em** |
| §10 radius 0–6px | 2–4px | pass |
| §10 no shadow on content | only the FAB, sheet and modal | pass |
| §11 pills only for filters and toggles | `--radius-pill` only on meters | pass |
| §12 small top-level nav | three items | pass |

One deviation, now fixed: micro-label tracking was set before those labels moved
to mono, which already carries wide sidebearings, so 0.14em read as strained and
exceeded §7's ceiling.

## The quality gate is now a suite

`npm run test:browser` ran `playwright test` against no config and no specs, so
it had been failing since it was written. It now runs 21 tests in
`tests/browser/quality-gate.spec.mjs`, which encode the Phase 8 gate rather than
leaving it as something to re-measure by hand:

- no horizontal overflow, 18 routes × 11 viewports, one test per viewport
- prose stays between 45 and 80 characters wherever there is room to choose
- the article-to-rail gap is positive and under 200px at every desktop width,
  which is the defect that started the refactor
- tables clear 1000px on a large screen
- the rail collapses to a drawer when there is no room for it
- no em dash reaches the reader on any route
- micro-label tracking stays inside `03` §7's 0.1em ceiling
- every chapter shows a figure identifier, and no number repeats
- no control under 32px on a phone
- the chapter title keeps its presence on a phone
- under `prefers-reduced-motion`, nothing is left transparent by an entrance

Config uses the installed Chrome via `channel: 'chrome'`, so the suite runs
without a 150 MB browser download, and reuses a running preview server.

The suite was checked against a deliberate regression: restoring micro-label
tracking to 0.14em fails the tracking test with `.kicker tracks at 0.140em`.
That attempt also showed why the gate is worth having, since the first edit
changed a rule that a later one overrides and had no effect on the page at all.

## Correction: the reading column was the real defect

The earlier refactor fixed the shell but left the reading column at a fixed cap,
so the page still read as a narrow documentation site inside a large canvas.

**The rule, located before changing it.** On `#engine` at 1920, ordinary prose
computed to `max-inline-size: 640px` inside a 1144px article track, leaving
**504px of usable space directly beside every paragraph**, and wrapping at 12.2
words per line. The binding declaration was `adaptive.css`
`.ds .section-body > p { max-inline-size: var(--prose) }` with
`--prose: clamp(34rem, 38vw, 40rem)`, whose 40rem ceiling was the cap. Two older
tokens held fixed values behind it: `--measure: 41rem` bounded callouts at 656px
and `--measure-wide: 60rem` bounded takeaways at 960px, both independent of
viewport.

**Derived from the type, not from convention.** Body text is Inter Variable at
18px / 1.6. Measured on real lesson prose with canvas metrics, its average
advance is **8.47px (0.471em)**, not the 0.5em I had been assuming, so earlier
character counts were overstated by about 6%. The generous 1.6 leading is what
lets the long end of the range stay readable.

    --reading:   min(100%, clamp(34rem, 13.3vw + 35rem, 60rem));
    --technical: clamp(46rem, 60vw, 74rem);
    --visual:    min(100%, 96rem);

`--measure` and `--measure-wide` now resolve to `--reading` and `--technical`,
which retires both fixed values without touching the eleven rules that consume
them. Callouts and takeaways moved to READING, where they belong.

### Measured on #engine

| Viewport | Reading | Chars | Words/line | Technical | Unused beside prose |
|---|---|---|---|---|---|
| 1280 | 709 | 84 | 12.2 | 709 | 0 |
| 1440 | 752 | 89 | 15.3 | 847 | 96 |
| 1512 | 761 | 90 | 15.3 | 901 | 140 |
| 1728 | 790 | 93 | 15.3 | 1030 | 240 |
| 1920 | 815 | 96 | 15.3 | 1144 | 329 (was 504) |
| 2560 | 900 | 106 | 15.3 | 1184 | 284 |
| 3440 | 960 | 113 | 15.3 | 1184 | 224 |

Every value lands in the target bands. Technical content is wider than reading
at every width above 1280, where the track itself is the constraint.

### Hero to body

Below the two-column threshold the title now takes exactly the reading measure,
so hero and body share one column edge: at 1280/1440/1512 the h1 and the first
paragraph are the same width to the pixel. Above it the hero splits and the
title is deliberately tighter than the body, because the track cannot hold a
900px title column and a readable lede at the same time.

### §9, two-column lesson sections

Not implemented. §9 says sections *may* use `explanation | diagram` when the
content justifies it, and forbids inventing secondary content to fill space. No
lesson section currently has a companion artifact that is meant to be read
beside its prose rather than after it. Revisit if one is written.

### Gate updated

The suite asserted prose ≤ 80 characters, which the new model correctly fails.
Replaced with four assertions that describe the refined model: reading width
monotonically grows with workspace and stays within 115 characters and inside
its track, never under 700px from 1280 up; technical artifacts are never
narrower than the prose; callouts share the reading measure exactly; hero and
body share a column edge below the split. 24 browser tests pass.

### Second correction: prose aligns to the artifact, not to a reading cap

The bounded reading measure still left lesson prose stopping short of the figure
directly beneath it: 96px short at 1440, 329px at 1920. Rule, paragraph, callout
and figure were four different right edges in one section.

Inside `.article`, reading content now takes the content track, so every edge in
a section lines up. `--reading` still governs surfaces with no artifact to align
to, such as the homepage lede. The chapter title lost its `18ch` cap for the
same reason: at 1440 it was resolving to 790px against a 847px body.

| Viewport | Prose | Chars | Words/line | Shortfall to figure |
|---|---|---|---|---|
| 1280 | 709 | 85 | 12.2 | 0 |
| 1440 | 847 | 102 | 15.3 | 0 |
| 1512 | 901 | 108 | 15.3 | 0 |
| 1728 | 1030 | 124 | 20.3 | 0 |
| 1920 | 1144 | 138 | 20.3 | 0 |
| 2560 | 1184 | 142 | 20.3 | 0 |
| 3440 | 1184 | 142 | 20.3 | 0 |

**Open question for the author.** This runs 124–142 characters above 1728px,
against the 850–960px band the width brief named as a target. The brief also
said the site is a technical learning platform rather than a newspaper and that
line length should not follow a blog convention, and the explicit instruction
was to align the paragraph with the figure. Both were followed, and the
character count is the cost. If it reads too long on a 27-inch screen, the dial
is the `--technical` ceiling: dropping it from 74rem to 66rem brings the widest
case to 1056px / 125 characters and narrows tables by the same amount.

The gate's character ceiling moved from 115 to 145, and a new test asserts the
alignment directly: prose, section rule and callout all end exactly where the
figure ends, at all seven desktop widths.

## Scroll scene pilot

Per the scroll-storytelling brief, which is development material and not part
of this repository.

**Phase 1 inspection.** No animation dependency existed: React 19 and CSS only.
Motion infrastructure already present was `motion.css` (spring `linear()` curves,
View Transitions, `animation-timeline: view()` reveals behind `@supports`),
`Transport.jsx`/`useTimeline` (a reducer over precomputed frames), and three
transport-driven animations. Scroll logic was a single IntersectionObserver for
TOC highlighting. SVG was used in only two explorers; the block and lane visuals
are DOM and CSS. Reduced motion had five blocks across two files. The decisive
finding was `engineSim.mjs`: it already produces the scheduler states the skill
storyboards, and 110 tests cover it.

**Pilot.** Chapter four §01. Six states, each found by what is true in the frame
rather than by index: `arrival` (something has left `unborn`), `contention`
(`freeBlocks === 0`), `selection` (first preemption), `advance` (someone waits
and nobody is preempted this step), `pressure` (second preemption, which costs
generated tokens), `takeaway` (`allDone`). Nine new unit tests assert each state
is true of its frame, that the two preemptions are distinct, and that the
scenario without contention fails loudly rather than rendering a gap.

**Technology.** IntersectionObserver plus `position: sticky`. No dependency
added. Six discrete states are not a scrubbed timeline, so GSAP would have added
weight without behaviour.

**Fallback.** Below 1100px wide, under 620px tall, or under
`prefers-reduced-motion`, the scene renders as a stacked storyboard: one stage
per state with its caption, nothing sticky, nothing moving. Captions are
ordinary flow content in both modes, so no text is trapped behind scroll.

**Three defects found while validating:**

1. `.ds .pool-block` outranked the single-class `.owner-N` selectors, so every
   claimed block rendered in the neutral surface colour. The stage's whole job,
   showing which request holds which block, was invisible. Fixed at a
   specificity that wins and mapped onto the editorial data palette.
2. The page-wide `view()` reveal applies a transform to every direct child of a
   section body. A transformed ancestor breaks `position: sticky`, and the scene
   should not fly in on top of its own motion. Excluded explicitly.
3. `html { scroll-behavior: smooth }` was set globally, which module 12 §22
   rules out for a reading platform. It animated every anchor jump, so following
   a TOC link glided through the scene rather than arriving. Removed;
   `scroll-padding-top` stays, since that is about where an anchor lands under
   the masthead. This was pre-existing and unrelated to the scene, but it is
   what made scroll measurement lag.

**Validation.** Five browser tests: the stage holds at exactly 104px for the
whole scene and releases with the grid; forward scroll yields states 0–5 and
reverse yields 5–0 exactly; claimed blocks carry more than one colour and
progress bars are painted; a 375px viewport gets six stacked stages with every
caption intact; reduced motion gets the storyboard with zero transition
durations and nothing dimmed. The existing 11-viewport overflow sweep covers the
scene at every width and stays clean.

**Not animated, deliberately.** Everything else stays level 0. No paragraph
reveals beyond the existing ambient one, no motion on the other nine chapters,
no scene in §04 where the explorer already lets the reader drive, and no
VISUAL-FULL breakout: the TOC sits immediately right of the article, so a
breakout would either collide with it or reopen the void the adaptive refactor
closed.

### Scene robustness (Phase 8, remaining items)

| Check | Result |
|---|---|
| Forward scrolling | states 0→5 in order |
| Reverse scrolling | 5→0, an exact mirror |
| Rapid direction changes | 8 out-of-order jumps, 8 correct landings |
| Resize across the fallback threshold | 1440 → 700 → 1440 keeps state 3 and re-pins at 104px |
| Direct anchor navigation | `#engine~engine-is-a-scheduler` renders the scene at state 0 |
| Sticky release | holds at 104px, releases with the grid |
| No scroll trapping | native scrolling throughout; no focusable controls in the scene |
| Keyboard | see below |
| Reduced motion | stacked storyboard, zero transition durations |
| No horizontal overflow | covered by the 11-viewport sweep |
| Performance | median frame 16.7ms, p95 17.9ms, 2 of 121 frames over 32ms, zero long tasks |

**One defect found and fixed here.** Activation was an IntersectionObserver with
a thin band across the middle of the viewport. A PageDown moves about 790px and
a caption is 558px tall, so a keyboard reader cleared the band entirely between
samples: the stage jumped from the first state to the last and showed none of
the mechanism. The observer now reports only *that* something changed, and the
active state is computed from geometry — whichever caption's midpoint is nearest
the viewport centre — with thresholds rather than a band so any change in
visibility wakes it. Paging now surfaces five of the six states instead of one.

The sixth is still skipped when paging fast, because six 558px captions do not
divide evenly into 790px jumps. That costs nothing in information: the captions
are ordinary flow content, so every word is read in order regardless of what the
stage is showing, and the stage is `aria-hidden`. Continuous scrolling shows all
six.

## Scroll scenes: where the language applies, and where it does not

Rolled out past the pilot on request. Module 12's own limits still governed the
choice: §4 allows at most one explanatory scene per lesson, §1 says motion that
teaches nothing stays static, and §2 names the mechanisms that are level-3
candidates. Each chapter was checked against that list rather than fitted with a
scene for consistency's sake.

**Built (3 of 10 chapters).** Each is named in module 12, has a tested model
behind it so the scene reports rather than illustrates, and lands in a section
that had no figure competing with it.

| Chapter | Section | Module 12 | Data | Fig. |
|---|---|---|---|---|
| 3 · Prefill, decode, reuse | §02 Prefill and decode are different machines | §8 Prefill vs Decode | `phaseStates` over the pinned checkpoint payload | 04 |
| 4 · Engine internals | §01 The engine is a scheduler | §7 Scheduler | `engineSim`, by condition | 06 |
| 7 · Parallelism | §02 Each strategy divides something different | §14 Topology | `placeMemory` up a device ladder | 11 |

**Left static, with reasons.**

- **1 · Feasibility** — a memory budget is arithmetic, not a sequence. The decode
  walkthrough already carries the one temporal idea in the chapter.
- **2 · Hardware** — a bound is computed, not enacted. The batching curve is a
  comparison and reads better as a chart.
- **5 · Measurement** — genuinely temporal, and a candidate, but the stream
  explorer already lets the reader move the stall themselves. §4 warns against
  spending the budget mechanically; an instrument beats a narration here.
- **6 · Bottleneck** — a differential is a reasoning structure, not a mechanism
  over time. Nothing moves.
- **8 · Quantization** — §16 exists, but the story is a comparison of three
  encodings, which the explorer shows side by side better than a sequence would.
- **9 · Speculation** — §13 exists, and the chapter already has a transport-driven
  animation of a draft round. A second telling would repeat it.
- **10 · Deployment** — a checklist. Zero animations is the correct number.

**Two defects the generic gate caught**, both of the kind that makes a scene read
as fixed frames rather than a mechanism:

1. In the pilot, `arrival` and `contention` resolved to the *same* simulation
   frame, because the three requests arrive and fill the pool in one step. The
   scene stopped twice on one picture. Both states now name which half of the
   stage they are about, and the other half dims.
2. In the placement scene, `head-limit` and `charge` share the 16-device rung and
   differed only by which readout was emphasised — but the emphasis class did
   not say *which*, so the rendered stage was byte-identical. The focus classes
   now carry the key.

**Contract.** `tests/browser/quality-gate.spec.mjs` holds all three scenes to one
table-driven contract: forward and reverse traversal, no two consecutive states
rendering an identical stage, a stacked storyboard on a phone with every caption
intact, and a figure identifier plus a provenance note. A fourth scene is a row
in that table, not a new block of tests.

Figures were renumbered in reading order, 01–15, since the three scenes inserted
into the sequence would otherwise have needed letter suffixes.

## One canvas: the material pass

### Audit

Five materials were in use where the brief calls for one. Four existed only to
say "this is a different region of the application".

| Surface | Was | Verdict |
|---|---|---|
| `:root` | `#fafbf8`, a *cool* near-white | REPLACE — the warm canvas |
| `.topbar` | `#f3f1eb` + bottom border | REPLACE WITH CANVAS |
| `.sidebar` | `#f0eee7` + hard right border | REMOVE both |
| `.explorer` | `#ebe9e2` + four borders + radius | REMOVE the shell; keep controls |
| `--surface-sunk` | `#e6e3da` | KEEP, but only for control tracks |
| `.nav-group a.active` | filled rounded rectangle | REPLACE WITH TYPOGRAPHY + marker |
| `.article-meta` actions | outlined buttons | REPLACE WITH TYPOGRAPHY |
| `.foot-note` | bordered chip | REPLACE WITH TYPOGRAPHY |
| `.key-idea`, `.takeaway`, `.assumptions` | already a single left rule | KEEP |
| `.bound-row` metrics | already editorial, not tiles | KEEP |
| `.explorer-heading`, `.math-legend`, `.tab-strip` | already single rules | KEEP |
| Tables | already thin-ruled | KEEP, vertical borders removed |

The callout and metric work was already done by earlier passes; the remaining
problem was almost entirely the shell and the explorer shells.

### Tokens

`site/src/canvas.css`, loaded last, owns material. Legacy tokens are remapped to
the new ones rather than chased through six stylesheets.

    --canvas       #f2f0e9    one material for every region
    --canvas-deep  #edeae1    control tracks and wells only, never regions
    --ink / --graphite / --muted / --rule / --rule-strong

    --identity   #3c5440   the guide, selected navigation, primary emphasis
    --flow       #2e6b6b   active process, movement, propagation
    --efficient  #6b7a45   reuse, caching, a healthy steady state
    --warning    #b4552f   bottleneck, anomaly, cost

    --radius-xs 3  --radius-sm 7  --radius-md 10  --radius-lg 14

Radius is spent only on things that are operated. Editorial content has no
container, so it has no radius.

### Colour density

Every large readout used to be forest green, so the one number a section was
about sat among four others wearing the same colour. Neutral values are now ink
and semantic colour is spent only where it means something: on the measurement
page, 220 and 66 are ink and 640 is `--warning`. Measured on the visible
article, excluding data marks, semantic colour reaches 20% of elements at most,
asserted by a gate test.

### Defects found while validating

1. **`:root` outranks `html`.** The first attempt set the canvas on `html`
   (0,0,1) while `styles.css` sets it on `:root` (0,1,0), so the cool white
   survived regardless of load order.
2. **Dark mode broke.** Remapping tokens on bare `:root` overrode the dark
   theme's own values, leaving a light canvas in dark mode. The dark half of the
   palette is now defined under `[data-theme='dark']`, and every rule in the file
   is written against tokens so the one-canvas logic holds in both.
3. **A 7px overflow at 375px.** Removing `.weight-comparison`'s padding exposed
   a value column pinned to 31px holding 90px of content. The column sizes to
   content now.
4. **`.ds .article-meta .save-button` (0,3,0)** in editorial.css outranked the
   §13 rule, so the hero's two actions kept their outlines and the hero kept
   reading as a toolbar.

### Contrast

| | light | dark |
|---|---|---|
| body on canvas | 10.0 | 11.8 |
| muted label | 4.76 | 6.05 |
| active navigation | 7.27 | 8.50 |
| warning readout | 4.30 (large type, AA needs 3.0) | 6.68 |

### Gate

Four tests hold the material rule: the shell regions paint no background of
their own and the sidebar has no right border, in *both* themes; the canvas is
actually dark in dark mode; the active navigation item carries no fill but still
differs from its neighbours in colour and weight and keeps a marker; semantic
colour stays under 20% of visible non-data elements.

## Editorial playback (module 13)

### Audit

One interaction language already existed: `timeline.mjs` (tested reducer) and
`Transport.jsx`, consumed by exactly three components. The player rendered
play/pause, SkipBack, SkipForward, reset, a native `<select>` for speed, a
`step N of M` counter and a range scrub — §2's description almost exactly.
Missing entirely: autoplay in any form, viewport observation, and any
distinction between the system suspending playback and the learner pausing it.

### Architecture (§29)

Four concerns, four places:

| Concern | Where |
|---|---|
| Playback state | `playback.mjs` — a pure machine, 21 tests |
| Technical state | the frame list each example already computed |
| Viewport observation and the clock | `useEditorialPlayback` |
| Rendering and controls | `EditorialPlayback.jsx` |

Modes: `idle`, `playing`, `system_suspended`, `user_paused`, `scrubbing`,
`completed`. A test walks the machine to depth four and asserts no undeclared
mode is reachable.

### What the learner sees

Stage name and `06 / 15`, a rail of conceptual stages that are themselves the
navigation, one primary control whose verb follows the state, a scrub as fine
adjustment, and `•••` for speed. Stage sets are derived per example, not
invented: the decode walkthrough uses its own phases, speculation uses
draft/verify/commit, and the engine loop uses pool occupancy — because arrival,
prefill and the first decode all happen in one simulation step there, so a
four-phase rail would have been a fiction. Scenarios differ in which beats
occur, and that difference is itself the lesson.

### Three defects found while validating

1. **The settings menu never dismissed**, so it sat over the stage rail and
   swallowed clicks meant for it. It now closes on outside pointer, on Escape,
   and on choosing a speed.
2. **Seeking to the end offered "Play"**, which restarted and completed in the
   same instant, stranding the learner. `primaryAction` now takes `atEnd`: a
   learner who clicked the last stage is as finished as one who watched it.
3. **The first stage derivation was false.** It assumed arrival, prefill and
   decode were separate frames; the simulation does all three in one step.

### Gate

Nine browser tests, table-driven over the three living examples: each starts
only on meaningful entry, carries navigable stages, shows no legacy transport
and no permanent speed readout; a user pause survives a scroll round trip while
a system suspension does not; clicking a stage jumps and yields; replay restarts
from the first frame; the menu dismisses; every control is a real labelled
button of sufficient size; and under reduced motion nothing starts itself while
Play stays reachable.

### The token stream, given a timeline (§26, §27)

The explorer showed a finished stream and its finished metrics, which is the
answer without the thing that makes it surprising. It now arrives.

`streamPlayback.mjs` builds one frame per arrival plus an opening frame where
the request has been sent and nothing has come back, which is what TTFT actually
measures. Each frame's metrics come from `requestMetrics` over the tokens that
have arrived by then, and a test asserts the final frame matches the static
readout exactly, so the animation cannot tell a different story from the number
printed beneath it.

Watched at 1440px, the lesson is now something the reader sees happen:

| Stage | Tokens | TPOT | Worst gap | Colour |
|---|---|---|---|---|
| Steady | 3 / 25 | 40 ms | 40 ms | neutral |
| Stall | 14 / 25 | **90 ms** | **640 ms** | warning |
| After | 15 / 25 | 86 ms | 640 ms | warning |

The average jumps the instant the stall lands and never returns to 40. Eleven
unit tests hold the behaviour, including that a stream with no stall marks no
frame as one and loses the stall stage rather than faking it.

Validated at 375, 768, 1440, 1920 and 2560: autoplay on entry at every width,
the stage rail turning from a row of columns into a stacked list below 40rem, no
horizontal overflow, and no control under 28px.

## Relationships and concept diagrams

### Audit

Classified every arrow rather than deleting them wholesale. Eight rows of
`A → B → C` at the end of chapters, plus ten one-line glosses on the homepage
index. Kept: `text → tokens`, two chart axis labels, a three-to-forty-seven per
cent change, and the link and fold icons, where direction or navigation is real.

The first pass converted two rows and recorded the work as finished. There were
eight: the audit's output had been truncated and the visible part taken for the
whole. The sweep in the gate now checks all ten chapters rather than sampling,
which is the check that would have caught it.

### Grammars built

**`Sequence`** — a numbered editorial sequence on one continuous rule. Each stop
carries a number, a name, the question it answers, and what it is made of.
Direction comes from position. Used by all ten chapters: the screen, the
investigation, checking the model, the experiment, the measurement, the
differential, choosing a placement, before you quantize, deciding on
speculation, the loop.

**`Tradeoff`** — cause, transformation, consequence, carried by the objects
rather than by labels. One device overflowing, eight holding the same
checkpoint, and the synchronisations that buys. Colour appears once, on the
consequence, because it is the only stage that is news. Every figure is
`placeMemory`, the same function the explorer and the scroll scene in that
chapter run.

Both transform rather than shrink below 52rem: the rule turns from a line across
the top into one down the side, and no stop is dropped.

### A contract that needed updating

Setting the chapter conclusion apart — narrower, stepped in from the left —
broke an assertion that callouts match the prose measure. That contract was
right before and is not now, so the test records the exception and why. Third
time in this work that the gate caught a deliberate change and the right answer
was to update the contract rather than revert the design.

### Known and deliberately not fixed

About 2 KB of dead CSS remains, roughly one per cent of the stylesheet: rules
for `transport-*`, `scenario-picker` and `phase-rail`, whose components were
replaced. An attempt to remove them with a regex over the stylesheets damaged a
comment boundary and broke the navigation's active state; it was reverted. The
rules are inert, and a second attempt with the same tool would risk the design
again for a cosmetic gain. Removing them safely needs a real CSS parser.
