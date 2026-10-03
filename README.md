# LLM Inference Engineering Lab

This is a study workspace for learning inference engineering: taking an unfamiliar open-weight model, working out from its architecture how it should be served, and then checking that design with measurements. It is published as a website, [Inference Engineering](https://richardcheam.github.io/inference-engineering/), built from the same files you are reading.

## Where things stand

Nothing here has been run on a GPU yet. The work so far is analytical: every number comes from published model configurations, inspected engine source code, or arithmetic over those, and each one says which. No model has been served, no benchmark has been run, and no performance improvement is claimed.

The workspace is a Mac used for research and writing. It has no inference runtime, no remote endpoint and no GPU access. Prior hands-on experience, gained at work, includes vLLM, large mixture-of-experts models, quantization, offloading, and dual-GH200 systems. How much of that skill carries over has not been tested here.

The models studied are leading open-weight families, compared across contrasting hardware. GLM and DeepSeek are important examples, but the choice of model follows the engineering question being asked and the current evidence, not loyalty to one family. The first workload in mind is interactive coding and agentic use, with batch and long-context variants. That is a choice made for the exercise, not a measured production requirement.

So far the workspace has pinned the metadata of four model checkpoints (a fifth, MiMo V2.6 Flash, was added later for the vLLM serving notes), compared how much memory the four need, written a hardware reference, reviewed which engines support which models, written a benchmark protocol, and laid out a flexible ten-week roadmap.

## Reading it

The [website](https://richardcheam.github.io/inference-engineering/) is the easiest way in. It is published automatically from the `main` branch: every push runs the calculation tests, builds the site and runs the browser tests, and the site is updated only if all three pass.

To run it locally:

```
npm install          # once
npm run dev          # http://127.0.0.1:4173
npm test             # the tests behind every calculated figure
npm run build        # a static copy in dist/, with relative paths
```

The built copy in `dist/` uses relative paths, so it works when served from a subdirectory as well as from the root.

## The ten chapters

Each chapter teaches one question directly, with an interactive worked example.

| | Chapter | The question it settles |
|---|---|---|
| 01 | Model feasibility | Will the weights, the cache and the working memory fit? |
| 02 | Hardware speed limits | How fast can one generation step possibly be? |
| 03 | Prefill, decode and reuse | How many tokens share each read of the weights? |
| 04 | Engine internals | What does a prefix-cache hit actually save? |
| 05 | Measurement | What do TTFT, TPOT, ITL and goodput mean, measured where? |
| 06 | Finding the bottleneck | Which mechanism explains the symptom? |
| 07 | Parallelism and placement | What does splitting a model across GPUs buy, and what does it cost? |
| 08 | Quantization | How does the precision a weight is stored in differ from the precision it is computed in? |
| 09 | Speculation | When does guessing tokens ahead pay off? |
| 10 | The deployment | How do the nine answers fit into one design someone else can review? |

None of the chapters reports a benchmark result. Their figures come from pinned configurations, tensor indices, inspected engine source, and arithmetic over those. Every other note in the workspace appears on the site as a reference page.

## Where to start

1. [First session: from checkpoint to feasibility](experiments/001-feasibility/README.md), a complete memory calculation worked through.
2. [Model comparison](models/feasibility-study.md): how dense, mixture-of-experts, hybrid and compressed-cache designs change what a model needs.
3. [Hardware reasoning](hardware/reference.md): capacity, bandwidth, compute, how devices are connected, and number formats.
4. [Roadmap](ROADMAP.md): what will be built, and what can be done without hardware.

## Working references

| File | What it holds |
|---|---|
| [CHEATSHEET.md](CHEATSHEET.md) | equations, units and diagnostic questions |
| [SKILL_MATRIX.md](SKILL_MATRIX.md) | the evidence needed to show each skill |
| [DECISIONS.md](DECISIONS.md) | choices made, and what would change them |
| [Experiment queue](experiments/QUEUE.md) | the next questions, and what access each one needs |
| [Benchmark methodology](benchmarking/methodology.md) | correctness, workloads, latency limits and reproducibility |
| [vLLM and engine support](engines/vllm/current-state.md) | support evidence and the first source-code investigation |
| [When the cache is full](engines/vllm/kv-pressure.md) | what vLLM does when the KV cache runs out |
| [Serving two new MoE models in vLLM](engines/vllm/serving-moe.md) | the kernels, parallelism and speculation vLLM chooses for DeepSeek V4.1 Flash and MiMo V2.6 Flash |
| [Ecosystem radar](radar/latest.md) | a small set of changes worth attention |
| [Source manifest](research/sources/2026-09-15/README.md) | pinned inputs, where they came from, and what could not be verified |

## How claims are labelled

Every claim says what kind of evidence it rests on, because the kinds are not equally strong.

A **verified fact** was checked directly in documentation or configuration. A **source-code observation** comes from reading an engine's implementation. A **maintainer claim** is what a project reports about its own software. A **calculated estimate** is our arithmetic. A **simulation** is the output of a simulator. A **benchmark result** is reserved for runs we measured ourselves. A benchmark someone else published is quoted with its author and workload, and is never presented as ours.

Some shortcuts are ruled out because they mislead: runtime memory use cannot be read off a checkpoint's file size, output quality cannot be read off its storage precision, and throughput cannot be read off a GPU's peak specifications. Every note that can go out of date carries a research date and links to its primary sources. Raw results and revision identifiers are kept.

## How the work proceeds

Each session starts by reading the roadmap, the skill matrix, the experiment queue, the decision log and the radar, then advances one engineering question at a time. Only state that will be useful later is updated. GPU access is needed to measure, but not to start learning, so the analytical work goes ahead without it.

The three original mentor, bootstrap and addendum documents still apply as background. Where they assume a DeepSeek-only scope or a personally owned GH200, the dated scope above replaces them.
