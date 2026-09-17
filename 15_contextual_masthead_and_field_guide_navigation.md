# 15 --- Contextual Masthead and Field Guide Navigation

## Purpose

This note defines the navigation redesign for **Inference Atlas**.

The current header follows a conventional application pattern:

``` text
inference engineering    Study    Library    Saved                    Search    Theme
```

The important existing behavior must be preserved:

> **Study opens the left Field Guide sidebar, where the learner selects
> chapters and lessons.**

Do not remove that chapter-navigation model. Instead, redesign the
masthead as a **publication masthead with contextual navigation**,
rather than an application toolbar.

## 1. Navigation model

There are three distinct navigation levels.

### Masthead

Identifies the publication and communicates the reader's current
context.

### Field Guide

Navigates the learning structure:

``` text
Field Guide → chapter → lesson
```

### Index

Navigates the wider product:

``` text
Index → Study / Library / Field Notes / About
```

Do not collapse these levels into one generic menu.

> **The masthead identifies the world. The Field Guide reveals the
> curriculum. The Index reveals the product.**

## 2. Remove the old horizontal nav

Do not retain:

``` text
[brand]    Study    Library    Saved                         [Search]    ◐
```

Do not try to fix it with more spacing, pills, icons, animated
underlines, glass effects, floating islands, or larger typography. The
problem is structural rather than decorative.

## 3. Study is an environment

Treat **Study** as the primary reading environment. The existing Field
Guide sidebar is its navigation system:

``` text
STUDY
  ↓
FIELD GUIDE
  ↓
CHAPTER
  ↓
LESSON
```

Once the reader is studying, use the current chapter/lesson as masthead
context instead of displaying a permanent `Study` link.

## 4. Preferred masthead

While studying, target:

``` text
inference engineering       01 / MODEL FEASIBILITY               Search    Index
A FIELD GUIDE               Will the model fit?
                              ↑
                       opens Field Guide
```

The exact grid, widths, typography, and alignment must be tuned against
the real page.

The key change is that **the middle of the masthead becomes contextual
information rather than generic navigation links**.

## 5. The concept is the controller

Reuse the established Inference Atlas principle:

> **The concept is the controller.**

Avoid a generic control such as:

``` text
Study ▼
```

Instead, make the contextual chapter identity itself interactive:

``` text
01 / MODEL FEASIBILITY
Will the model fit?
```

Clicking this region opens the Field Guide.

Avoid unnecessary dropdown chrome. On hover/focus, a restrained
annotation such as `Open field guide` or a subtle rule/typographic
response may reveal interactivity.

## 6. Preserve the Field Guide

The Field Guide remains the chapter and lesson navigator.

Conceptually:

``` text
FIELD GUIDE

LEARN THE FOUNDATIONS

●  Model feasibility
   Hardware speed limits
   Prefill, decode & reuse
   Memory & equations

UNDERSTAND THE SYSTEM

   Engine internals
   Measurement
   Finding the bottleneck

MAKE IT PRODUCTION

   Quantization
   Speculation
   Deployment
```

Use the real information architecture from the application. Do not
invent chapters merely to match this example.

## 7. One-canvas sidebar treatment

When opened, the Field Guide must not resemble a Microsoft Teams, VS
Code, or generic SaaS drawer.

Maintain the one-canvas direction:

-   same warm paper material;
-   no heavy sidebar background;
-   no large shadow;
-   no floating card;
-   no glass panel;
-   no excessive rounded container;
-   no hard application-like vertical wall.

Create separation through typography, alignment, spacing, subtle rules,
numbering, and restrained motion.

The sidebar should feel like **a table of contents being revealed**.

## 8. Contextual masthead states

### Home

``` text
inference engineering                                      Search    Index
A FIELD GUIDE FOR ENGINEERS
```

### Study

``` text
inference engineering       01 / MODEL FEASIBILITY          Search    Index
A FIELD GUIDE               Will the model fit?
```

The contextual middle region opens the Field Guide.

### Library

``` text
inference engineering       LIBRARY                         Search    Index
A FIELD GUIDE               Benchmarks
```

### Personal / Saved

``` text
inference engineering       FIELD NOTES                     Search    Index
A FIELD GUIDE               Saved
```

These are conceptual examples. Use actual route/context names where
appropriate.

## 9. Current context replaces static navigation

The old masthead spends valuable space repeating:

``` text
Study    Library    Saved
```

The new masthead should instead answer:

> **Where am I?**

For example:

``` text
01 / MODEL FEASIBILITY
Will the model fit?
```

or:

``` text
03 / ENGINE INTERNALS
One prompt, start to finish
```

This makes the masthead useful while reading.

## 10. Avoid generic chevrons

Avoid:

``` text
01 / MODEL FEASIBILITY ▼
```

if the chevron merely means "clickable."

Make the contextual block interactive. Use subtle hover/focus treatment
while preserving semantic accessibility.

## 11. Index has a different responsibility

The **Index must not duplicate the Field Guide**.

Field Guide:

``` text
learning structure
→ chapters
→ lessons
```

Index:

``` text
whole product
→ Study
→ Library
→ Field Notes
→ About
```

This distinction is essential.

## 12. Proposed Index structure

Conceptually:

``` text
INDEX

01
STUDY
The Field Guide

02
LIBRARY
Concepts
Figures
Benchmarks
Sources

03
FIELD NOTES
Learning path
Saved
Ecosystem radar

04
ABOUT
About the atlas
Method / sources
```

Use only destinations that actually exist.

If an Index layer is implemented, make it an editorial composition using
numbered sections, mono annotations, strong typography, fine rules, one
shared canvas, and restrained semantic color---not a small dropdown.

## 13. Saved is secondary

Do not give these identical visual importance:

``` text
Study    Library    Saved
```

They are not equivalent conceptual levels.

Prefer:

``` text
PRIMARY WORLDS
Study
Library

PERSONAL / UTILITY
Saved
```

Saved may live under Field Notes, Index, or another suitable personal
layer.

## 14. Search

Search should remain immediately accessible.

Avoid a permanently input-like resting state:

``` text
╭──────────────────────────────╮
│ Search anything        ⌘ K  │
╰──────────────────────────────╯
```

Prefer something quieter:

``` text
Search     ⌘ K
```

or:

``` text
⌕ Search
```

Interaction can reveal the richer search surface.

## 15. Appearance/theme

The theme toggle does not need equal masthead prominence.

Either move Appearance into Index or retain a very quiet immediate
toggle if reading ergonomics justify it.

## 16. Brand

Keep the identity quiet and publication-like:

``` text
inference engineering
A FIELD GUIDE
```

Do not turn it into a conventional product-logo container.

## 17. Deliberate grid

Do not implement the masthead as a simplistic
`display:flex; justify-content:space-between` row.

Use a deliberate grid:

``` text
BRAND                  CONTEXT                         UTILITIES
```

Conceptually:

``` text
[brand region]         [chapter / section region]      [search / index]
```

Align this grid with the Field Guide, article shell, technical-wide
content, and right TOC.

## 18. Large screens

Do not allow the masthead to become a huge empty strip on wide monitors.
Context and utilities should remain compositionally related to the
content shell.

Negative space is welcome; unowned space is not.

## 19. Mobile

Do not preserve the full desktop masthead by shrinking it.

Prioritize something like:

``` text
brand                           Index
current chapter / lesson
```

Keep the Field Guide easily reachable through the contextual chapter
control. Avoid cramped rows of tiny links.

## 20. Motion

Opening the Field Guide should feel like revealing publication
structure.

Prefer restrained translation, subtle opacity, and content reflow where
appropriate.

Avoid springy drawers, excessive blur, dramatic scaling, bounce, or
elastic easing.

Motion should communicate **revealing navigation structure**.

## 21. Accessibility

The contextual chapter region must remain a semantic interactive
control.

Requirements:

-   keyboard accessible;
-   visible focus state;
-   clear accessible name such as `Open Field Guide`;
-   correct expanded/collapsed state;
-   sensible focus management;
-   Escape behavior where appropriate;
-   reduced-motion support.

Do not sacrifice usability to remove visual chrome.

## 22. Implementation order

1.  **Masthead pilot** --- replace `Study / Library / Saved` with
    context + Search + Index while preserving routing.
2.  **Context control** --- current chapter/lesson opens the existing
    Field Guide.
3.  **Field Guide integration** --- visually integrate the sidebar with
    the one-canvas system.
4.  **Search** --- reduce permanent input chrome.
5.  **Index** --- only then design the global Index layer.

Validate each stage before expanding.

## 23. Required code audit

Before implementation inspect:

-   top-level routes;
-   current Study trigger;
-   sidebar state;
-   chapter-selection state;
-   current lesson metadata;
-   Library route;
-   Saved route;
-   search implementation;
-   theme control;
-   mobile header behavior;
-   keyboard shortcuts;
-   focus behavior.

Reuse stable routing/state logic. This is primarily an
information-architecture and presentation redesign, not a reason to
rewrite working navigation infrastructure.

## 24. Before / target

### Before

``` text
┌──────────────────────────────────────────────────────────────────────┐
│ inference engineering   Study   Library   Saved      Search      ◐ │
└──────────────────────────────────────────────────────────────────────┘
```

This reads as application navigation.

### Target

``` text
┌──────────────────────────────────────────────────────────────────────┐
│ inference engineering    01 / MODEL FEASIBILITY      Search   Index│
│ A FIELD GUIDE            Will the model fit?                       │
└──────────────────────────────────────────────────────────────────────┘
```

This reads as publication identity + reading context + utilities.

## 25. Anti-patterns

Do not solve the masthead with:

-   navigation pills;
-   floating capsule nav;
-   glassmorphism;
-   large rounded containers;
-   generic hamburger + generic drawer;
-   animated underline tabs as the primary redesign;
-   icons beside every destination;
-   equal treatment of Study, Library, and Saved;
-   oversized search input;
-   generic dropdown chevrons beside every context label;
-   app-dashboard styling.

## 26. Quality gate

Before accepting the redesign, verify:

-   Study is understood as the reading environment.
-   Field Guide remains the chapter/lesson navigator.
-   Index does not duplicate Field Guide.
-   Saved is appropriately secondary.
-   The learner can always understand current location.
-   The masthead feels deliberately composed.
-   Context replaces generic navigation.
-   The masthead aligns with the page grid.
-   The one-canvas philosophy remains intact.
-   Search remains easy to reach.
-   Field Guide discoverability is sufficient.
-   Keyboard and mobile behavior remain clear.

## 27. Final principle

The masthead should not primarily answer:

> **What buttons can I click?**

It should answer:

> **What publication am I in, where am I within it, and how do I reveal
> its structure?**

The target system is:

``` text
MASTHEAD
publication + current context

FIELD GUIDE
curriculum + chapters + lessons

INDEX
whole product

SEARCH
direct retrieval
```

> **The masthead identifies the world. The Field Guide reveals the
> curriculum. The Index reveals the product.**
