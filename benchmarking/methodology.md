# Benchmark methodology

Last researched: 2026-09-15

## What this page is for

A benchmark here has one job: to find out which configuration serves a defined workload correctly, fast enough, and within the memory and operating limits we have. This page is the protocol for doing that, written before any measurement so that the measurements cannot shape it.

No benchmark has been run in this workspace yet. Every GPU-dependent step is waiting on hardware access. The protocol itself is ready.

Two tools cover most of it. vLLM's own benchmark scripts are quick to iterate with while changing engine settings. NVIDIA's AIPerf measures from the outside, through the server's API, which makes it suitable for comparing engines on equal terms. AIPerf can control load, record streaming timings and collect the server's own metrics ([options](https://docs.nvidia.com/aiperf/reference/command-line-options), [metrics](https://docs.nvidia.com/aiperf/reference/ai-perf-metrics-reference), [server metrics](https://docs.nvidia.com/aiperf/server-metrics/server-metrics-collection)). None of this replaces a kernel profiler, which answers a different question. Check each tool's options against the installed version, because they change.

## Step 1: make sure the answers are right

A fast server that returns broken answers has not been measured; it has been timed. Before timing anything, confirm that the model's output is correct and complete. Check the tokenizer and chat template, whether a reasoning mode is on, where generation stops, that streamed output arrives whole, and that tool calls parse, if the workload uses them. Keep a small fixed set of tasks with known expected behaviour. Include one task that needs information from deep in a long context, and a few representative code and tool-use cases. When a change can affect quality, such as quantization or speculative decoding, record how the output changes as well as how the speed changes.

## Step 2: decide what load to send

Two kinds of workload answer different questions, so keep both.

The **controlled** track fixes the prompt lengths, the output length and, where the tool allows, when generation stops. Because nothing varies, a change in speed can be traced to the engine. The price is realism: real users do not send identical requests.

The **application** track uses natural prompts and lets generation stop where it would in real use. It is closer to what users experience, but the lengths vary, so report the actual input and output lengths and whether each task succeeded. Two models can also turn the same text into different numbers of tokens, and reason for different lengths, so equal text is not equal work.

The starting matrix below is a set of exercises chosen for teaching, not measured production demand. Pick the subset to run and freeze it before starting; running every combination blindly wastes hardware time.

| Workload | Prompt / output length (tokens) | First load levels to try | What it shows |
|---|---|---|---|
| Interactive | 2,048 / 256 | 1, 4, 8, 16, 32 requests in flight | where latency is still low, and where the server starts to saturate |
| Prompt-heavy | 32,768 / 128 | 1, 4, 8 | the cost of processing long prompts, and how it delays other requests |
| Generation-heavy | 512 / 2,048 | 1, 8, 32 | weight and cache traffic, batching, and speculative decoding |
| Long context | 131,072 / 256 | 1, then 4 only if memory allows | whether the context fits, and how cost grows with it |
| Prefix reuse | 16,384-token shared prefix plus 512 unique / 256 | matched cold and warm runs at 1 and 8 | how much prompt work a cache hit really saves |
| Agentic | repeated tool turns with growing prompts | a small fixed set of recorded traces | prefix reuse across turns, reasoning length, and whether tasks succeed end to end |

## Step 3: increase the load the right way

Start with a concurrency sweep: keep a fixed number of requests in flight, and send a new one each time one finishes. This is a closed-loop test. It is good for finding the knee, the load at which latency starts to climb steeply. But it hides overload, because when the server slows down, the client slows down with it.

So once the knee is found, switch to an open-loop test around it. Requests arrive at a set rate whether or not earlier ones have finished, the way users arrive in reality. A backlog can now build up and become visible. Record the arrival pattern, the rate offered, the rate actually achieved, and how many requests timed out or were dropped. Concurrency and requests per second are different quantities, and one should never be reported as the other.

## Step 4: define what is timed

State first whether the times are measured at the client, which includes network delay and time spent queueing, or inside the server.

Three latency measures matter for streaming responses. **Time to first token (TTFT)** is how long a user waits before anything appears. Measured at the client, it includes queueing and network time. **Time per output token (TPOT)** is the average gap between tokens once output has started. It is defined per request, and only for requests that produce more than one token. **Inter-token latency (ITL)** is the individual gap between successive tokens, which shows stalls that an average would hide. A streamed chunk can carry more than one token, so report exactly how the tool defines ITL and how it counts tokens.

For the interactive exercise, a request passes if **its TTFT is at most 2 seconds and its TPOT at most 50 ms**, and its output is complete and correct. These limits are chosen for teaching; they are not a universal standard, and a real application's limits must be confirmed before a deployment decision rests on them.

## Step 5: report the right numbers

Report the distribution, not just the average. For TTFT, TPOT, ITL and total request time, give the median (p50) and the slower tails: p95 and p99, the times that 95% and 99% of requests stay under. Give the number of requests behind each figure, and the number that failed. A p99 from a few dozen requests is not a reliable picture of the tail, so do not read it as one.

Then report **goodput**: the number of completed requests that met *both* limits, divided by the elapsed time. This is the figure that says how much useful service the server delivered. It cannot be reconstructed from the percentiles, because a request can be within the TTFT limit and outside the TPOT limit at the same time. Where TPOT is undefined (a one-token response), leave it out and say so; never count it as zero.

Alongside those, record what explains them: input, output and total token throughput separately, completed requests per second, error counts, the actual length distributions, queue depth, batch sizes, KV cache usage, GPU and CPU memory, memory-bandwidth evidence, clock speeds and power, and communication between GPUs where relevant. Keep two pairs apart: total throughput across all users versus the speed one user experiences, and memory the engine has reserved versus memory requests are actually occupying. Average GPU utilisation on its own cannot locate a bottleneck.

## Step 6: keep the comparison fair

Pin everything that could change the result: the model revision, the exact checkpoint and quantization, the tokenizer and chat template, the engine version and container image, the kernels, the driver stack, the hardware and how it is connected, CPU and memory placement, every server flag and environment variable, precision, context limit, scheduler settings, the workload's random seed and length distributions, output settings, and where the client runs and which version it is.

Keep three kinds of warm-up apart: starting the server, warming the GPU kernels, and filling the prefix cache. When testing a cold prefix cache, warm the kernels with different inputs, so that the cache stays cold. Write down how the cache is primed and how it is cleared. Restarting the server can reset both kernels and cache at once, so plan the controls around that.

Run at least three measured repetitions to start with, alternating baseline and change, so that slow drift does not favour one of them. Run long enough, or send enough requests, to cover the operating range that matters, record both, and extend the run if there are too few observations or the tail is still moving. Treat a small difference as unresolved until it is larger than the variation between repeated runs. Change one main factor per experiment.

## Step 7: go from numbers to causes

Work from the outside in: service metrics first, then system counters, then a timeline of what the GPU was doing, and only then a kernel profiler. A speedup is explained when it can be tied to one of four things: less work or traffic, more reuse, less waiting, or faster execution of the same work. Record what the speedup cost in quality and in operational complexity next to the speedup itself.

## Writing up a result

A reader should be able to understand what was tested, what happened and why it matters without knowing this project.

For each experiment, start with the question it answers. Then give the setup: the hardware, the model, the request sizes, the concurrency or arrival rate, the duration, and whether the workload stayed the same throughout or changed. Only then give the results, and say what they mean for a user. A sentence such as "the server kept completing requests, but the median wait for the first token was 9.2 minutes" (an illustration, not a measurement from this workspace) says more than the number alone: the server was healthy, and the experience was not acceptable.

Before each graph, say what was tested. After it, say what changed, what stayed the same, and what the pattern suggests. Explain any axis that could be misread; request completion order, for example, is not the number of simultaneous requests. A correlation does not prove a cause. Write "consistent with" or "suggests" when the evidence supports an interpretation but does not confirm the mechanism.

Count completed, failed and unfinished requests separately. Unfinished requests were still running or waiting when observation stopped, so their outcomes are unknown; they are neither successes nor failures. Keep measured facts, interpretations and proposed changes in separate places, and state each limitation once, next to the result it limits.

## Records

Each real experiment gets its own directory, containing:

- the question or hypothesis, and the prediction made before measuring
- the controls, and the exact server and benchmark commands
- a manifest of the environment
- the raw outputs, never edited or overwritten, with trial identifiers and timestamps
- the analysis, the confounders considered, and a decision: KEEP, REJECT or INVESTIGATE

The first [feasibility record](../experiments/001-feasibility/README.md) is an analytical exercise, not a measurement. It does not stand in for this protocol.
