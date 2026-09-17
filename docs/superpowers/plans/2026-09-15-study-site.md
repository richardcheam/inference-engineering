# Inference Atlas Implementation Plan

**Goal:** Make the existing material comfortable to study locally through direct explanations and interactive examples.

**Architecture:** Static React/Vite site, bundled Markdown and source metadata, hash routes, no backend. Pure tested memory calculations remain separate from presentation. Build assets use relative paths for later portfolio hosting.

**Tech Stack:** React, Vite, Marked, DOMPurify, KaTeX, Lucide icons; Node test runner and Playwright browser checks.

**Spec:** `docs/superpowers/specs/2026-09-15-study-site-design.md`

## Work

- [x] Update persistent learning preferences and turn the initial exercise into an openly worked example. Preserve the documented calculation and raw evidence.
- [x] Add package/build configuration and calculation tests. Verify the tests fail without the implementation; implement from pinned JSON and pass the tests.
- [x] Build topic navigation, full-content search, readable Markdown, source links, math, diagram, and local preferences.
- [x] Create the curated feasibility lesson with adjustable memory/context/concurrency and visible assumptions, plus a useful overview/library.
- [x] Verify behavior in a browser, inspect desktop/mobile screenshots, run a production build and subdirectory check, and resolve findings.
- [x] Document startup/build commands and leave the local site running. No publication or portfolio edits.
- [x] Generalise the single hardcoded lesson into a chapter registry, and add chapter 02 (hardware speed limits) with its own tested calculation module and interactive decode-step example.
- [x] Give every displayed formula a symbol legend, fix the L-for-layers vs L-for-link and B-for-batch vs B-for-bandwidth collisions, and record one meaning per letter in the cheatsheet.
- [x] Add foldable sections across chapters and reference docs, each showing a summary of its contents when folded, plus tabbed views inside both interactive examples. Assumption blocks stay outside every toggle.
- [x] Rework navigation for space: the sidebar nav scrolls in its own region with a pinned footer, the rail's pull-quote and the sidebar slogan are gone, the section list folds sections from the rail, and below 1020px it becomes a bottom sheet — the first section navigation narrow screens have had.
- [x] Collapse the left sidebar to an icon rail on request, remembered per browser and ignored below 760px where it is already a drawer. Add an error boundary so a render failure cannot blank the page and its navigation.
- [x] Add chapter 03 (prefill, decode and reuse) with a tested routing module derived from the pinned MoE configs, and an interactive expert-reuse example.
- [x] Build the remaining chapters 04–10 (engine internals, measurement, bottleneck differential, parallelism, quantization, speculation, deployment capstone), each with a tested calculation or decision module and an interactive example.
- [ ] Replace the unimplemented `npm run test:browser` script with real Playwright specs, or remove it.

## Concrete acceptance checks

`npm test` must check the hypothetical 160 GiB case: Mistral + 12 GiB overhead + two 32K contexts is 158.430 GiB; one 128K context is 180.430 GiB. Qwen's full-attention component at 32K is 0.625 GiB and must retain its partial-state qualification. Invalid/negative inputs cannot produce a fit verdict.

`npm test` must also check the decode-step bound: every device in the explorer matches the pinned `hardware/reference.md` figures; batching divides the weight read but never the per-sequence cache read; the bound scales linearly with the assumed achieved bandwidth; and a batch that cannot be placed yields no rate at all.

`npm run build` produces `dist/`. Browser checks exercise topic routes, empty/full search, Escape dismissal, model/context changes, persistent theme/bookmark state, mobile menu, source downloads, absence of overflow, and serving under `/portfolio/inference/`.
