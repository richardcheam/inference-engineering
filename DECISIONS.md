# Decisions

## 2026-09-15 · Teach across models and hardware

**Context:** prior GH200 access was at work; this Mac has no assumed serving setup. The objective is independent inference-engineering judgment across leading open-weight models.

**Decision:** use GH200 as one important hardware case study; compare architectures across GLM, DeepSeek, Qwen, Mistral, and other families when evidence makes them relevant. Use the existing workspace.

**Alternative:** center all work on one DeepSeek deployment. Rejected because it narrows transfer and depends on unavailable hardware.

**Revisit when:** a real deployment or employer project supplies a more urgent, specific engineering question.

## 2026-09-15 · Begin with analytical evidence

**Decision:** inspect pinned metadata, calculate budgets, read source, and design experiments locally. Validate runtime/performance predictions when hardware becomes available. Keep analytical and measured results explicitly separate.

**Alternative:** install a simulator and treat its estimates as frontier-model benchmarks. Rejected: support and calibration have not been established for our selected combinations.

**Revisit when:** a suitable simulator/model/hardware profile or remote endpoint becomes available.

## 2026-09-15 · Four initial checkpoints, with a broader radar

**Decision:** GLM-5.3 for large MoE/DSA; Qwen3.6-35B-A3B for a manageable hybrid-cache example; Mistral Medium 3.5 for a dense contrast; DeepSeek V4.1 for compressed/shared KV and conditional memory. This is a teaching set, not a quality leaderboard or an exhaustive latest-model list.

**Alternative:** constantly replace every case study with the newest release. Rejected because it prevents completing and checking a resource model. Qwen3.8 and GLM-5.3-Flash remain immediate radar items.

**Revisit when:** a new architecture changes the lesson, a source is corrected, or a deployment target is chosen.

## 2026-09-15 · vLLM primary, SGLang comparator

**Decision:** develop deep source-navigation competence in vLLM and compare matched SGLang features. TensorRT-LLM, ROCm/AITER, and other runtimes enter when a hardware or workload question requires them. Engine choice is not a performance claim.

**Revisit when:** a required model/backend is unsupported, or matched measurements favor another engine.

## 2026-09-15 · Standard benchmark tools before a custom harness

**Decision:** use vLLM's benchmark tools for quick engine work and NVIDIA AIPerf as the preferred independent harness where its workload/API support fits. Neither is installed or run here. Build custom tooling only for a demonstrated gap.

**Reason:** preserve time for experimental design and interpretation. See the [methodology](benchmarking/methodology.md) and [tool evidence](hardware/reference.md).

**Revisit when:** the selected workload, timestamp definitions, or deployment constraints cannot be represented correctly.

## 2026-09-15 · Teach cycle 2 with a traffic bound, not a roofline

**Context:** the natural centrepiece for a hardware chapter is a roofline chart, which needs peak compute per device. Our pinned reference records advertised capacity and memory bandwidth, and no compute figures.

**Decision:** teach the hardware chapter through the memory-traffic term alone: weights read once per step plus the live cache read once per sequence, divided by an assumed achieved fraction of advertised bandwidth. The achieved fraction is a control the reader sets, and is labelled an assumption rather than a specification.

**Reason:** every input is then either already pinned in this workspace or visibly declared. It also happens to be the term that governs decode, so the simpler model teaches the real mechanism. Introducing vendor peak-FLOP numbers would have added a class of claim we have not verified.

**Alternative:** pin peak compute for all six reference platforms and draw a full roofline with a ridge point. Rejected for now because it means asserting six unverified vendor figures to draw one chart.

**Revisit when:** peak compute per device is verified and pinned, a prefill chapter needs the compute term, or a measurement shows the traffic bound misleading for a case we teach.

## 2026-09-15 · Model expert reuse as uniform and independent routing

**Context:** cycle 3 needed a way to show what batching does to a sparse checkpoint. The exact behaviour depends on the router, which we cannot observe without running the model.

**Decision:** model a step as touching `E × (1 − (1 − k/E)^n)` distinct experts, with E and k read from each pinned config. Expert parameters come from the config exactly (`3 × hidden × moe_intermediate` per expert, SwiGLU); bytes come from a stated precision per checkpoint. Present the result as a reuse model, not a routing prediction.

**Reason:** it reproduces the expert-reuse figures already pinned in this workspace, and its whole-expert footprint cross-checks against the pinned checkpoint sizes: GLM at FP8 gives 724.8 GB against 755.6 GB stored (96%), Qwen at BF16 gives 90%. Those two are close enough to confirm the parameter arithmetic.

**Limits:** real routing is neither uniform nor independent. Load balancing, a shared expert on every token, and similar prompts all move the number, usually downward. DeepSeek V4.1 Flash is stored mixed FP4/FP8 and we have not established which tensors carry which precision, so its expert bytes stay a labelled assumption and are excluded from the cross-check.

**Revisit when:** real routing counters from a served model are available, or a checkpoint's per-tensor precision is established.

## 2026-09-15 · Complete all ten chapters analytically, and say so

**Context:** cycles 4 through 10 cover engine internals, measurement, debugging, parallelism, quantization, speculation and a production design. Several of these are normally taught from benchmark results, and no hardware is available here.

**Decision:** build all ten as taught chapters from what can be established without running a model (pinned configs, pinned engine source, and arithmetic) and make the boundary explicit rather than implied. Each chapter's interactive example carries what it assumes; chapter 10 collects what every chapter leaves open into one checklist.

**What each rests on:** chapter 4 on the pinned vLLM cache manager at commit `836bb38`, including the `num_tokens - 1` lookup limit and the block-alignment assertion. Chapter 5 on the metric definitions already pinned in the cheatsheet. Chapter 7 on the pinned device capacities and stored KV head counts. Chapter 8 on the distinction between stored and executed precision already recorded in the hardware reference. Chapters 6, 9 and 10 are reasoning frameworks rather than calculations over pinned data, and are labelled as such.

**Limits:** chapter 6's differential ranks by explanatory coverage, which is not a probability, and its candidate list is deliberately incomplete. Chapter 9 treats acceptance as one constant rate, which it is not. Chapter 7 counts weights and cache only, so a placement that just fits there does not fit in reality. None of the ten chapters contains a measured result.

**Revisit when:** hardware access exists. Every open item in the chapter 10 checklist becomes a specific experiment with a prediction already written down.

## 2026-09-15 · Direct teaching in a local website

**Decision:** teach through explanations and fully worked examples with optional interactive controls. Remove quizzes, hidden answers, compulsory predictions, and assessment gates. Keep source Markdown editable and expose the material through a portable static localhost website.

**Reason:** explicit user preference for comfortable web reading and later portfolio migration. No hosted Sites project or GitHub publication is part of this change.

**Revisit when:** the user requests a different learning format or publication.

## 2026-09-16 · An entry point before the taxonomy

**Context:** the site had no landing page. The default route resolved to
`feasibility`, so opening the workspace dropped a reader into chapter one's
first paragraph with the full chapter rail already expanded, and with no
statement anywhere of what the material is or how far its evidence goes.

**Decision:** add a `home` route as the default, rendered without the chapter
rail. It carries four things and nothing else: a statement of what the guide
claims, one real technical artifact (the decode walkthrough, the loop every
chapter makes claims about), the ten chapters as an editorial index of
number/question/path/duration rather than a card grid, and the evidence stance
stated plainly before a reader meets any number.

**Why:** `06_portfolio_information_architecture` §2 asks for identity before
taxonomy and §4 rules out a three-up card grid;
`05_engineering_visual_language` §2 asks the hero to be a real artifact rather
than decoration, and §14 forbids implying evidence the work does not have. The
decode walkthrough also appears in chapter one, where the arithmetic starts.
That repetition is deliberate: the homepage shows the mechanism, the chapter
measures it.

**Revisit when:** a reader arrives for a specific chapter often enough that the
entry page becomes an obstacle, or when real measurements exist and the evidence
stance on the homepage stops being accurate.

## 2026-09-16 · Index surfaces are editorial rows, never cards

**Context:** the library page used a three-up grid of icon cards. Four separate
parts of the design skill rule that pattern out by name, and it had survived
every earlier pass only because the design work had been aimed at the chapters.

**Decision:** both index surfaces of the site, the homepage chapter index and
the library archive, use one editorial row language: a rule, a title, a short
gloss, a duration, an arrow, and no card shell. Categories become rules with
counts. Grouping disappears when a filter is active.

**Why:** a card grid makes every item look equally weighted and spends most of
its pixels on the container. Rows let the titles carry the page, which is what
an archive of questions should do.

**Revisit when:** an index needs a visual preview per row, which `08` describes
as a hover preview in a reserved area rather than a return to cards.

## 2026-09-17 · One scroll scene, driven by the tested simulation

**Context:** the motion skill `inference_atlas_scroll_motion_v1` asks for a
single level-3 explanatory scroll scene rather than a broadly animated site, and
for a pilot done well before any rollout.

**Decision:** chapter four §01, "The engine is a scheduler", gets the scene. Its
six states are derived from `engineSim` by condition rather than by frame index,
so the scene renders frames the simulation actually produced. The section had
prose and a callout but no figure; the operable explorer stays in §04, where it
serves a different purpose.

**Why:** the section's claim is about causality across time, which a static
figure cannot carry: who was admitted, who was preempted, and what that cost.
Deriving the states from the simulation means the narrative cannot drift from
the instrument further down the same chapter, which is the failure mode that
makes teaching animations untrustworthy.

**Technology:** IntersectionObserver over caption blocks plus CSS `position:
sticky`. No new dependency. GSAP and Motion were considered and rejected: the
scene has six discrete states rather than a scrubbed timeline, so a pinning
library would add weight without adding behaviour.

**Revisit when:** a second lesson needs a scene. `ScrollScene.jsx` is the
reusable half; the scheduler stage is the lesson-specific half.

## 2026-09-17 · Three scroll scenes, seven chapters left static

**Context:** the pilot scene was well received and the rollout restriction was
lifted. Module 12's limits still apply: one explanatory scene per lesson at most,
and motion only where it teaches something a static figure cannot.

**Decision:** scenes in chapters 3, 4 and 7: prefill versus decode, the
scheduler, and the device ladder. The other seven chapters stay static, each for
a stated reason: arithmetic rather than sequence (1, 2), a reasoning structure
rather than a mechanism (6), a comparison better shown side by side (8), an
existing instrument that already does the job (5, 9), and a checklist (10).

**Why:** all three built scenes are named in module 12's candidate list, have a
tested model behind them so the scene reports rather than illustrates, and sit in
a section that had no figure already competing for the same attention. Spending
the budget in the remaining seven would have been the mechanical rollout §4 warns
against.

**Revisit when:** a chapter gains a mechanism that unfolds over time, or an
existing explorer turns out to be teaching the mental model badly enough that a
narration should precede it.

## 2026-09-17 · One canvas, four meanings

**Decision:** one warm canvas (`#f2f0e9`) for masthead, sidebar, article and
table of contents; surfaces reserved for things that are operated; four semantic
colours with fixed meanings (identity, flow, efficient, warning) used as ink and
highlighter, never as card fills.

**Why:** the site communicated hierarchy by changing background colour and
drawing rectangles, which reads as documentation software. Structure now comes
from typography, space and single rules. Colour was diluted by using the
identity green for every large number; spending it only on meaning is what makes
a bottleneck legible before the caption is read.

**Revisit when:** a region genuinely needs to be distinguished as a different
mode rather than a different part of the same page.

## 2026-09-17 · Living examples autoplay; the concept is the controller

**Context:** `Transport.jsx` carried a deliberate rule in its header, *"Never
autoplays: an animation that starts moving before you have read the setup is
harder to follow."* Module 13 §4 asks for the opposite: examples begin when they
meaningfully enter the viewport.

**Decision:** reversed, with the conditions the module attaches. Playback starts
only when a third of the example is showing and only when it is the most
prominent example on the page; it suspends when scrolled away and resumes when
scrolled back; a pause by the learner is persistent and survives that round
trip; and under `prefers-reduced-motion` nothing ever starts itself, though Play
remains available.

**Why the original concern is met:** the earlier rule protected the reader from
motion arriving before context. The viewport threshold does that better, because the
setup is read on the way in, and the persistent `USER_PAUSED` state means the
page never argues with someone who has stopped it.

**Also:** previous, next and reset are gone. The conceptual stages are the
navigation, replay appears only at the end, and speed moved behind a secondary
control. One player serves all three living examples.

**Revisit when:** a page gains two living examples close enough together that
prominence alone does not choose well between them.

## 2026-09-17 · Relationships are composed, not punctuated

**Context:** ten chapters ended on a row of labels joined by arrows, and the
homepage repeated the pattern in miniature as ten one-line glosses. The arrow
carried the whole relationship and the gaps between labels held nothing.

**Decision:** every chapter now closes on a numbered sequence naming what each
step answers and what it is made of, laid out on one continuous rule.
Chapter seven additionally states its claim with the objects themselves: a bay
overflowing at 779 GB against a 141 GB device, eight bays holding 97 GB each,
and the seven synchronisations per step that buys.

**Why:** an arrow between two labels asserts a relationship without showing it,
and is indistinguishable from a relationship that does not hold. A stop that
says what it answers can be checked. Where real numbers exist, the object is a
better argument than a diagram of one, and every figure in the trade-off comes
from `placeMemory`, so it cannot drift from the explorer beside it.

**Kept:** arrows where direction is the information: `text → tokens`, the two
chart axis labels, the reuse change from three to forty-seven per cent, and
every link and fold control.

**Revisit when:** a relationship appears that is genuinely a branch, a loop or
a feedback cycle. The sequence grammar suits ordered investigations and is the
wrong shape for those.
