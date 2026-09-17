# Inference Atlas — local study resource

## Authorized outcome

The user requested a localhost website for the existing inference-engineering materials, with interactive worked examples and a later path to their GitHub portfolio. They explicitly removed exercises and prediction requirements. Build and verify locally; do not create a hosted Sites project or publish anything.

## Design

Use a static React/Vite application with bundled Markdown content, hash-based navigation, relative build assets, and browser-local reading preferences. No database, account, server API, or external AI calls. A clean editorial layout combines a persistent topic sidebar, a focused reading column, and a small section navigation rail. Ivory/white surfaces, ink typography, and a muted green accent distinguish teaching content from evidence/assumptions.

The default page teaches model feasibility directly: short conceptual sections, readable equations, an interactive memory budget with model/context/concurrency/device controls, an explicitly labeled capacity verdict, and model storage comparisons. All existing substantive notes are reachable through a searchable library and rendered with tables, code, citations, and diagrams. Search indexes titles and full content. The roadmap is a learning path, not a grading system.

## Data and boundaries

Original Markdown remains authoritative and is bundled via Vite raw imports. Pinned calculations supply model byte counts and cache components. A pure calculation module handles per-sequence state, overhead, capacity, and estimate scope. Incomplete cache models remain visibly labeled; capacity candidates must never be presented as runtime or latency guarantees.

Render Markdown through Marked and DOMPurify; render math with KaTeX and replace the known GH200 diagram with an accessible native diagram. Rewrite workspace document links to client routes; offer supported local evidence files through bundled assets. External sources remain normal links. Preserve source snapshots unchanged.

## Interaction and accessibility

Topic links, search dialog with keyboard support, theme toggle, optional bookmarks, adjustable worked examples, copyable code, mobile navigation, and in-page section links. Native form controls, visible focus rings, skip link, readable contrast, semantic headings, reduced-motion support. No quizzes, hidden answers, progress gates, or required user responses.

## Validation

Test calculation behavior against the saved Mistral/Qwen examples, batch/context scaling, partial-cache labels, and invalid inputs. Build and serve the actual static output; verify local navigation, search, example controls, bookmarks/theme persistence, evidence links, responsive layout, and a simulated GitHub subdirectory. Capture desktop/mobile screenshots. Current browser connector lacks its JS control tool, so use standalone browser testing if unavailable after discovery.

## Environment

The repository has an unborn branch and pre-existing untracked research. Keep the implementation under `site/` plus root package/config/test files, preserving that content. No worktree baseline exists without first committing the user's entire untracked workspace. The Sites connector exposes hosting operations but no local Sites skill or orchestrator skill reader is callable; use a portable local implementation and disclose that limitation.
