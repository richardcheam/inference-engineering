# UI audit — Inference Atlas

Audited 2026-09-16 against `.claude/learning-ui-skill.md`. Measured from computed styles on
`#hardware` (chapter 02) and from `site/src/styles.css` directly. No code changed during the audit.

## Summary

The application works and the content is sound. The presentation layer, however, was built
component by component without a shared scale, and it now breaks the learning-UI rules in a way
that is measurable rather than a matter of taste. The central failure is that **body text is
12px where the skill asks for 16–18px**, and everything else was sized down to stay proportional
to that mistake.

## 1. Typography

| Element | Measured | Skill requires | Verdict |
|---|---:|---|---|
| Body prose | **12px** | 16–18px desktop | fails |
| Section heading (h2) | 33px | hierarchy without dominating | borderline |
| Lesson title (h1) | **54px** | "avoid giant H1 titles" | fails |
| Key idea body | 11px | ≥14px for learning content | fails |
| Card body | 10px | ≥14px for learning content | fails |
| Equation legend | 10px | ≥14px, near the equation | fails |
| Assumption blocks | 8px | ≥14px for learning content | fails |
| Table of contents | **8px** | "must not look like footnote text" | fails |
| Sidebar nav | 11.5px | comfortably readable | fails |
| Eyebrow labels | 6.6px | small text for metadata only | fails |
| Badges | 6.5px | — | fails |

- **45 distinct font sizes** in the stylesheet, including nine values between 5px and 7px
  (5, 5.3, 5.6, 6, 6.2, 6.4, 6.5, 6.6, 6.7). These differences are invisible and arbitrary.
- **Line-height 1.95** on prose, against a required 1.55–1.75. Combined with 12px text this
  produces a loose, grey, hard-to-track paragraph.
- **H1 is 4.5× body size.** The skill warns against "huge differences between adjacent text
  levels"; this is the largest such jump in the app.

## 2. Content width

- Article column is fixed at **780px**, prose at 12px → roughly **130 characters per line**.
- The skill asks for **65–80**. This is the single biggest readability defect, and it is
  independent of font size: the column was never constrained by measure.

## 3. Spacing

No scale exists. Distinct values found in the stylesheet:

- **45 margin values**, **34 padding values**, **28 gap values** — effectively every integer
  from 1 to 25px.
- Rhythm is therefore accidental. Sections, cards and controls each pick their own spacing.

## 4. Colour, borders, radius

- **153 distinct hex colours** behind only **11 CSS custom properties**. Most component colours
  are hard-coded literals, which is exactly what the skill's consistency rule forbids.
- **12 border-radius values** (1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 24). The 1px/1.5px/2px
  variants are indistinguishable.
- Radius is applied broadly, contributing to the "excessive rounded containers" the skill warns
  about.

## 5. Navigation hierarchy

- The left sidebar is **224–246px of every viewport**, including 768px where it consumes 29% of
  the screen while the article is squeezed.
- The right rail disappears entirely below 1020px but is *most* cramped between 1020 and 1200,
  where TOC labels wrap to two lines at 8px.
- Sidebar footer has a layout bug: `margin-left:auto` is applied to the label span rather than
  the count, so "Learning path" is pushed to the right edge, misaligned with every other row.
- "Learning path" appears twice — once in the nav group, once in the pinned footer.

## 6. Responsive

| Width | Problem |
|---|---|
| 390 | Acceptable, but all type is below the readable floor |
| 768 | Sidebar still open and eating 29% of width; article column ~430px; H1 wraps to 3 lines; brand subtitle wraps |
| 1024 | Three columns in 1024px: article ~290px of usable prose; TOC labels wrap |
| 1280 | Comfortable, but prose still ~130 chars |
| 1440 | Same; reclaimed space goes to margin rather than measure |

## 7. Equations and code

- KaTeX display blocks render correctly and do not clip, which is good.
- **Legend text is 10px** and the note beneath is 9px, so the variable definitions — the part
  the skill says must sit close to and be readable with the equation — are the least readable
  text on the page.
- Code in the source-quote block is 9.5px.

## 8. Visual noise

- Eight distinct surface treatments compete in the reading column: key-idea, memory-part cards,
  math block, explorer panel, takeaway, decision-flow, lesson-sources, next-lesson.
- The skill says explicitly: "Do not represent every category using another card."
- Badges (`INTERACTIVE EXAMPLE`, `ANIMATED EXAMPLE`, edition `01`) add chrome at 6.5px.

## 9. Accessibility

- Colour contrast **passes** (measured 4.57–8.9 against background in dark theme).
- **Font size is the accessibility failure**: 6.6px and 8px text is below any reasonable floor.
- **8 interactive elements are under 24px tall**, smallest 11px — below the WCAG 2.5.8 target
  size minimum. Breadcrumb links and inline source links are the worst.

## What is already good, and must be preserved

- Light/dark theming with correct token inheritance.
- Folding sections, tabbed explorers, the animation transport, and the error boundary.
- Every interactive example's assumption block. These are load-bearing for the workspace's
  evidence rules and must not be shrunk, hidden, or moved behind a toggle.
- All lesson content and every calculation module. This is a presentation refactor only.
