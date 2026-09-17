# LLM Inference Engineering Lab

Build the ability to take an unfamiliar open-weight model from architecture to a justified serving design, then validate that design with measurements.

## Current state

- **Environment:** this Mac is our research and development workspace. No inference runtime, remote endpoint, or GPU access is assumed.
- **Experience:** prior hands-on work includes vLLM, large MoE models, quantization, offload, and dual GH200 systems at work. Skill levels remain unassessed until demonstrated here.
- **Scope:** leading open-weight model families and contrasting hardware platforms. GLM and DeepSeek are important examples; model selection follows engineering questions and current evidence.
- **First workload:** provisionally interactive coding/agentic serving, with batch and long-context variants. This is an exercise choice, not an established production requirement.
- **Completed groundwork:** pinned metadata for four checkpoints, a comparative memory study, hardware reference, engine-support review, benchmark protocol, and flexible ten-week roadmap.
- **Measurement status:** no models served, no GPU benchmarks, no performance improvements claimed.

## Read it in the browser

The material is also a local study site, `Inference Engineering`, built from these same Markdown files.

```
npm install          # once
npm run dev          # http://127.0.0.1:4173
npm test             # calculation tests behind the interactive examples
npm run build        # static output in dist/, relative asset paths
```

`npm run build` produces a portable `dist/` that also serves correctly from a subdirectory, so it can move to a portfolio later without changes. Nothing is published from here.

All ten chapters are taught directly, each with an interactive worked example:

| | Chapter | Question it settles |
|---|---|---|
| 01 | Model feasibility | Will the weights, state and execution memory fit? |
| 02 | Hardware speed limits | How fast can a decode step possibly be? |
| 03 | Prefill, decode & reuse | How many tokens share each weight read? |
| 04 | Engine internals | What does a prefix cache hit actually save? |
| 05 | Measurement | TTFT, TPOT, ITL and goodput, at a declared boundary |
| 06 | Finding the bottleneck | Which mechanism explains the symptom? |
| 07 | Parallelism & placement | What does sharding buy, and charge? |
| 08 | Quantization | Stored precision versus executed precision |
| 09 | Speculation | When does guessing ahead pay? |
| 10 | The deployment | All nine, as one reviewable design |

Every other note is rendered as a reference page. Nothing in the chapters is a benchmark result: the figures come from pinned configurations, tensor indices, inspected engine source, and arithmetic over those.

## Start here

1. [First session: from checkpoint to feasibility](experiments/001-feasibility/README.md): worked evidence and worked examples.
2. [Model comparison](models/feasibility-study.md): what changes between dense, MoE, hybrid, and compressed-cache architectures.
3. [Hardware reasoning](hardware/reference.md): capacity, bandwidth, compute, topology, and precision.
4. [Roadmap](ROADMAP.md): practical deliverables and hardware-independent work.

## Working references

| File | Purpose |
|---|---|
| [CHEATSHEET.md](CHEATSHEET.md) | Equations, units, and diagnostic questions |
| [SKILL_MATRIX.md](SKILL_MATRIX.md) | Evidence required to demonstrate competence |
| [DECISIONS.md](DECISIONS.md) | Choices and conditions for revisiting them |
| [Experiment queue](experiments/QUEUE.md) | Next questions and access dependencies |
| [Benchmark methodology](benchmarking/methodology.md) | Correctness, workloads, SLOs, and reproducibility |
| [vLLM and engine support](engines/vllm/current-state.md) | Support evidence and first source-code investigation |
| [Ecosystem radar](radar/latest.md) | A small set of changes worth attention |
| [Source manifest](research/sources/2026-09-15/README.md) | Pinned inputs, provenance, and verification limits |

## Evidence rules

Use **VERIFIED FACT** for directly checked documentation/configuration, **SOURCE-CODE OBSERVATION** for inspected implementation, **MAINTAINER CLAIM** for reported behavior, **CALCULATED ESTIMATE** for our arithmetic, **SIMULATION** for simulator output, and **BENCHMARK RESULT** only for measured runs. A published benchmark must name its author and workload; it is not our measurement.

Every changing technical note has a research date and primary-source links. Preserve raw results and revision identifiers. Do not infer runtime allocation from checkpoint size, output quality from storage precision, or throughput from peak hardware specifications.

Start each session by reading the roadmap, skill matrix, queue, decisions, and radar. Advance one engineering question at a time; update only useful persistent state. GPU access is a dependency for measurement, not for beginning the learning cycle.

The three original mentor/bootstrap/addendum documents remain background instructions. Their dated current-scope sections override the older DeepSeek-only and personally owned GH200 assumptions.
