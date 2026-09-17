# Experiment and investigation queue

Updated: 2026-09-15

READY means prerequisites exist, not that hardware has been provisioned. Analytical work and measured experiments are identified separately. Statuses: IDEA, READY, RUNNING, BLOCKED, DONE, REJECTED.

| ID / priority | Question or hypothesis | Expected value | Evidence | Complexity | Status |
|---|---|---|---|---|---|
| A001 / P0 | What do pinned checkpoint bytes and cache geometry imply? Analytical audit | Establish trustworthy inputs; no speedup claim | [Study](../models/feasibility-study.md), pinned configs/indices, calculated results | Low | DONE |
| L001 / P0 | Explain conditional fit and cache growth through worked examples | Build feasibility intuition through direct teaching | [First session](001-feasibility/README.md); worked examples available | Low | READY |
| A002 / P1 | Why can a shared prompt still require computation? Source investigation | Understand cache reuse and recomputation | Initial vLLM trace exists; illustrated walkthrough is next | Medium | READY |
| A003 / P1 | Does GLM-5.3-Flash change placement/KV conclusions relative to GLM-5.3? | Transfer the method to a newer architecture | Official model card identifies a different hybrid base | Medium | IDEA |
| A004 / P1 | Which model/format/backend/version is valid for the first real target? | Prevent a misleading deployment baseline | Engine notes contain unresolved support pins | Medium | BLOCKED: actual target hardware/access not selected |
| E001 / P0 after access | Does measured startup/cache allocation agree with our budget? | Calibrate analytical estimates | A001 plus real inventory required | Medium | BLOCKED: no GPU/endpoint access |
| E002 / P1 after E001 | Where does interactive goodput stop improving with load? | Identify workload-specific saturation | [Benchmark protocol](../benchmarking/methodology.md) | Medium | BLOCKED: E001 and access |
| E003 / P1 after E001 | Does prefix reuse reduce TTFT under identical load? | Attribute prefill savings | A002 source evidence and cold/warm controls | Medium | BLOCKED: E001 and access |
| E004 / P2 | Does speculation improve latency without reducing high-load goodput? | Find draft/verify break-even | Requires baseline and compatible drafter/backend | Medium | BLOCKED: baseline and access |
| E005 / P2 | Can offload preserve the target SLO? | Test capacity/traffic trade-off | Requires per-component placement and bandwidth evidence | High | BLOCKED: target and profiling evidence |
| K001 / P3 | Custom attention/MoE kernel optimization | Unknown until profiling | No evidence that a kernel is the limiting component | Very high | REJECTED: revisit only with profile evidence |

## Research questions to resolve

- What actual accelerator access will be available, if any, and for which workload? No purchase/rental assumed.
- Which runtime terms explain the gap between checkpoint bytes and measured loaded allocation?
- What additional state does each selected hybrid/compressed backend allocate per request and per cache block?
- Which current GLM vLLM version resolves the conflicting recipe requirements?
- How do batch-dependent expert reuse and interconnect topology change TP/EP/offload trade-offs?

These questions live here rather than in a duplicate research-questions file. Promote an idea when there is evidence, a discriminating test, and the necessary access. Preserve negative results.
