import comparison from '../../models/feasibility-study.md?raw';
import hardware from '../../hardware/reference.md?raw';
import equations from '../../CHEATSHEET.md?raw';
import engine from '../../engines/vllm/current-state.md?raw';
import benchmarking from '../../benchmarking/methodology.md?raw';
import roadmap from '../../ROADMAP.md?raw';
import radar from '../../radar/latest.md?raw';
import decisions from '../../DECISIONS.md?raw';
import queue from '../../experiments/QUEUE.md?raw';
import example from '../../experiments/001-feasibility/README.md?raw';
import sources from '../../research/sources/2026-09-15/README.md?raw';
import introduction from '../../README.md?raw';
import skills from '../../SKILL_MATRIX.md?raw';

export const documents = [
  { id: 'models', title: 'Four models, four memory stories', short: 'Model comparison', category: 'Models', path: 'models/feasibility-study.md', text: comparison, description: 'Read architecture through its consequences: weight residency, attention state, and the hardware it needs.', icon: 'layers', time: '14 min' },
  { id: 'hardware-reference', title: 'The device reference', short: 'Device reference', category: 'Reference', path: 'hardware/reference.md', text: hardware, description: 'Pinned capacities, bandwidths, topology notes, and what each available tool can and cannot establish.', icon: 'cpu', time: '8 min' },
  { id: 'equations', title: 'The inference essentials', short: 'Memory & equations', category: 'Foundations', path: 'CHEATSHEET.md', text: equations, description: 'A compact reference for memory budgets, cache geometry, performance bounds, and serving metrics.', icon: 'function', time: '5 min' },
  { id: 'engines', title: 'Follow the engine', short: 'Engine internals', category: 'Systems', path: 'engines/vllm/current-state.md', text: engine, description: 'Trace prefix reuse through vLLM and separate documented support from a validated deployment.', icon: 'workflow', time: '7 min' },
  { id: 'benchmarking', title: 'Measure what matters', short: 'Benchmarking', category: 'Systems', path: 'benchmarking/methodology.md', text: benchmarking, description: 'From a clean baseline to useful goodput. Give every number a workload and a measurement boundary.', icon: 'chart', time: '9 min' },
  { id: 'roadmap', title: 'Your learning path', short: 'Learning path', category: 'Notebook', path: 'ROADMAP.md', text: roadmap, description: 'Ten flexible chapters connecting durable concepts to real inference-engineering decisions.', icon: 'map', time: '6 min' },
  { id: 'radar', title: 'On the inference radar', short: 'Ecosystem radar', category: 'Notebook', path: 'radar/latest.md', text: radar, description: 'The model and engine changes worth your attention, with a reason to learn, investigate, or wait.', icon: 'radar', time: '5 min' },
  { id: 'example', title: 'A memory budget, worked through', short: 'Worked example', category: 'Foundations', path: 'experiments/001-feasibility/README.md', text: example, description: 'Follow a complete 160 GiB capacity calculation, with every assumption visible.', icon: 'book', time: '6 min' },
  { id: 'decisions', title: 'Why we chose this approach', short: 'Decision notes', category: 'Notebook', path: 'DECISIONS.md', text: decisions, description: 'The choices behind this learning workspace and the evidence that would change them.', icon: 'notebook', time: '5 min' },
  { id: 'queue', title: 'Questions worth investigating', short: 'Investigation queue', category: 'Notebook', path: 'experiments/QUEUE.md', text: queue, description: 'A small, ordered set of engineering questions, including what needs real hardware.', icon: 'list', time: '4 min' },
  { id: 'sources', title: 'Follow the evidence', short: 'Source registry', category: 'Reference', path: 'research/sources/2026-09-15/README.md', text: sources, description: 'Pinned model configurations, tensor indices, and engine source references behind the notes.', icon: 'file', time: '5 min' },
  { id: 'about', title: 'A field guide to inference engineering', short: 'About this workspace', category: 'Reference', path: 'README.md', text: introduction, description: 'The purpose, scope, and evidence rules for this personal learning resource.', icon: 'info', time: '3 min' },
  { id: 'skills', title: 'Engineering capabilities', short: 'Capability reference', category: 'Reference', path: 'SKILL_MATRIX.md', text: skills, description: 'A planning reference for the capabilities involved in independent inference engineering.', icon: 'compass', time: '4 min' },
];

export const lessons = [
  { id: 'feasibility', chapter: '01', kicker: 'CHAPTER 01 · MODEL FEASIBILITY', title: 'Will the model fit?', short: 'Model feasibility', category: 'Foundations', description: 'Learn to turn a model architecture into a memory budget, and understand what that budget can tell you.', intent: 'Turn an architecture into a memory budget, and find out what that budget can and cannot tell you.', text: 'Model feasibility weights KV cache hardware capacity GLM Qwen Mistral DeepSeek interactive memory budget context concurrency working examples', icon: 'box', time: '10 min' },
  { id: 'hardware', chapter: '02', kicker: 'CHAPTER 02 · HARDWARE SPEED LIMITS', title: 'How fast can it possibly go?', short: 'Hardware speed limits', category: 'Foundations', description: 'A model that fits still has a speed limit. Learn to read a device as rates and put a floor under the decode step.', intent: 'Read a device as rates, then put a floor under the time one decode step can take.', text: 'Hardware bandwidth roofline decode step memory bound HBM NVLink C2C Grace LPDDR topology GH200 H100 H200 B200 MI300X RTX 5090 batching amortization throughput latency tokens per second arithmetic intensity interactive', icon: 'cpu', time: '12 min' },
  { id: 'reuse', chapter: '03', kicker: 'CHAPTER 03 · PREFILL, DECODE AND REUSE', title: 'Who shares the weights?', short: 'Prefill, decode & reuse', category: 'Foundations', description: 'Prefill and decode are the same model behaving like two different machines. Learn to read arithmetic intensity, and what batching really does to a sparse checkpoint.', intent: 'Reuse is what makes a weight read worth paying for, and it is why a sparse model stops being sparse.', text: 'prefill decode arithmetic intensity batching expert reuse MoE routing top-k sparse GLM DeepSeek Qwen active parameters total parameters saturation tokens per step interactive roofline compute bound memory bound', icon: 'workflow', time: '11 min' },
  { id: 'engine', chapter: '04', kicker: 'CHAPTER 04 · ENGINE INTERNALS', title: 'What does the engine actually do?', short: 'Engine internals', category: 'Systems', description: 'Serving is a scheduler and an allocator. Learn how block-based cache works, and why a reported cache hit is not a free prefill.', intent: 'The cache is handed out in blocks, and block boundaries are why a reported hit is not a free prefill.', text: 'engine internals vLLM scheduler KV cache manager block size allocation prefix caching cache hit rate TTFT recomputation alignment block boundary padding request lifecycle interactive source code', icon: 'workflow', time: '11 min' },
  { id: 'measure', chapter: '05', kicker: 'CHAPTER 05 · MEASUREMENT', title: 'What did you actually measure?', short: 'Measurement', category: 'Systems', description: 'Turn a stream of token timestamps into metrics you can defend: TTFT, TPOT, inter-token latency, and goodput.', intent: 'Turn a stream of timestamps into definitions, and a definition into a number you can defend.', text: 'benchmarking measurement TTFT TPOT ITL inter token latency goodput throughput percentile SLO boundary stall average AIPerf timestamps interactive', icon: 'chart', time: '10 min' },
  { id: 'profile', chapter: '06', kicker: 'CHAPTER 06 · FINDING THE BOTTLENECK', title: 'Why is it slow?', short: 'Finding the bottleneck', category: 'Systems', description: 'The same symptom has many mechanisms, and they need opposite fixes. Build a differential and run the test that separates them.', intent: 'One symptom has many mechanisms, so build the differential and run the test that can embarrass you.', text: 'profiling debugging bottleneck critical path queueing synchronization memory pressure hypothesis counter-hypothesis discriminating test timeline trace differential diagnosis interactive', icon: 'compass', time: '9 min' },
  { id: 'parallel', chapter: '07', kicker: 'CHAPTER 07 · PARALLELISM AND PLACEMENT', title: 'How many devices, and why?', short: 'Parallelism & placement', category: 'Systems', description: 'Tensor, data and expert parallelism divide different things and charge differently. Learn what sharding buys and what it costs on the critical path.', intent: 'Sharding solves the capacity problem by buying a communication problem.', text: 'parallelism tensor parallel data parallel expert parallel TP DP EP sharding replication KV heads collectives interconnect NVLink topology placement offload locality interactive', icon: 'cpu', time: '11 min' },
  { id: 'quantize', chapter: '08', kicker: 'CHAPTER 08 · QUANTIZATION', title: 'How small can the weights go?', short: 'Quantization', category: 'Systems', description: 'Stored precision, executed precision, and the scales in between. What quantization reliably buys, and what it only appears to.', intent: 'Stored bits are not executed bits, and the scales in between are the part people forget.', text: 'quantization FP8 FP4 INT8 INT4 BF16 storage format execution format scales group size effective bits per parameter kernel support dequantization accumulator KV cache dtype quality interactive', icon: 'function', time: '10 min' },
  { id: 'speculate', chapter: '09', kicker: 'CHAPTER 09 · SPECULATION', title: 'Should it guess ahead?', short: 'Speculation', category: 'Systems', description: 'Speculative decoding spends idle compute on guesses. Learn the break-even condition, and why the answer changes with load.', intent: 'Speculation spends spare compute on guesses, which is why the break-even moves with load.', text: 'speculative decoding draft verify acceptance rate break-even geometric chain draft length speedup concurrency batch load medusa eagle interactive', icon: 'radar', time: '10 min' },
  { id: 'production', chapter: '10', kicker: 'CHAPTER 10 · THE DEPLOYMENT', title: 'What would you actually deploy?', short: 'The deployment', category: 'Systems', description: 'Chain all nine questions into one reviewable design, with its assumptions and failure modes written down.', intent: 'Chain the nine answers into one design, and be honest about the joints between them.', text: 'production capstone deployment design admission control observability reproducibility rollout recovery failure domain uncertainty register overload goodput checklist', icon: 'notebook', time: '9 min' },
];
export const allPages = [...lessons, ...documents];
export const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const assetFiles = import.meta.glob([
  '../../research/sources/2026-09-15/*.json',
  '../../research/sources/2026-09-15/*.py',
  '../../experiments/001-feasibility/calculations.json',
], { eager: true, query: '?url', import: 'default' });

export function resolveDocumentLink(href, sourcePath) {
  if (/^(?:https?:|mailto:)/i.test(href)) return { href, external: true };
  const origin = new URL(sourcePath, 'https://atlas.local/');
  const target = new URL(href, origin);
  const path = decodeURIComponent(target.pathname.slice(1));
  const doc = documents.find(d => d.path === path);
  const section = target.hash ? `~${decodeURIComponent(target.hash.slice(1))}` : '';
  if (doc) return { href: `#${doc.id}${section}` };
  const asset = assetFiles[`../../${path}`];
  if (asset) return { href: asset, download: path.split('/').pop() };
  return { href: '#sources' };
}
