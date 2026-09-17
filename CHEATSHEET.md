# Inference engineering cheatsheet

## Symbols

One meaning per letter across this workspace. Subscripts name the pool or the path; they never change what the letter is.

| Symbol | Means | Unit |
|---|---|---|
| $M_x$ | bytes held in pool $x$: $M_\text{weights}$, $M_\text{state}$, $M_\text{execution}$, $M_\text{usable}$, $M_\text{KV}$, $M_{\text{cache},i}$ | bytes |
| $W$ | total resident weight bytes, the same quantity as $M_\text{weights}$ | bytes |
| $P_\text{total}$ | total parameters in the checkpoint | count |
| $L$ | attention layers that keep a KV cache | count |
| $H_\text{kv}$ | stored KV heads per layer, after grouped-query sharing | count |
| $D_\text{head}$ | dimensions per head | count |
| $b$ | bytes per stored element: 2 for BF16, 1 for FP8 | bytes |
| $T_i$ | live tokens in sequence $i$ | count |
| $N$ | sequences in flight; in decode each emits one token per step | count |
| $t_\text{step}$ | time for one decode step | seconds |
| $Q_x$ | bytes moved across path $x$: $Q_\text{HBM}$, $Q_\text{link}$ | bytes |
| $N_\text{ops}$ | arithmetic operations performed | count |
| $C_\text{eff}$ | operations per second actually sustained | ops/s |
| $B_x$ | bytes per second sustained on path $x$: $B_\text{HBM}$, $B_\text{link}$; $B_\text{peak}$ is the advertised figure | bytes/s |
| $\eta$ | fraction of $B_\text{peak}$ actually achieved, between 0 and 1 | none |
| $R_\text{total}$ | output tokens per second across all sequences | tokens/s |
| $E$, $k$ | experts in a layer, and experts selected per token | count |

$B$ is always a bandwidth here and $N$ is always a count of sequences. Note $b$ (bytes per element) and $B$ (bytes per second) are different quantities distinguished only by case.

## Units and memory

- GB = 10^9 bytes; GiB = 2^30 bytes. TB/s and GB/s are bytes per second; Gb/s is bits per second. Keep vendor labels separate from measured usable bytes.
- Uniform weight approximation: $$W \approx P_\text{total} \times \frac{\text{bits}}{8}$$
  Active parameters estimate some per-token work, not total weight residency.
- Actual stored tensors: sum encoded data bytes, including scales and mixed-precision tensors. A checkpoint index is evidence of storage, not peak runtime allocation.
- Per device, everything resident must fit:
  $$M_\text{weights} + M_\text{state} + M_\text{execution} \leq M_\text{usable}$$
- Quantized weights do not imply quantized KV. Packed 4-bit storage does not prove native 4-bit computation.

## Cache

Conventional full-attention GQA, equal K/V head dimensions:

$$M_\text{KV} = 2\, L\, H_\text{kv}\, D_\text{head}\, b \sum_i T_i$$

The leading 2 is one key and one value per position. It does not belong in architectures that store a single latent vector instead.

Use actual stored heads per rank; TP can replicate KV heads. Account for shared prefixes once per physical cache copy, plus page rounding.

- Hybrid: sum full-attention KV, sliding windows, recurrent states, and engine checkpoints separately.
- Compressed latent attention: count stored latent/positional dimensions and indexer state, not expanded query-head dimensions.
- Sparse attention can reduce how much history is read without removing the stored history.

## Performance bounds

$$I = \frac{N_\text{ops}}{Q}$$

$$t_\text{step} \geq \max\!\left(\frac{N_\text{ops}}{C_\text{eff}},\; \frac{Q_\text{HBM}}{B_\text{HBM}},\; \frac{Q_\text{link}}{B_\text{link}}\right)$$

This maximum is an optimistic bound; serial stages, launch overhead, and incomplete overlap add time. Match compute precision and dense/sparse conventions before using hardware peaks.

For a dense decode step reading weights once for N sequences in flight:

$$\text{weight bytes per emitted token} \approx \frac{W}{N}$$

With E equally likely experts, k distinct experts per token, and independent routing across the N tokens of one decode step:

$$\mathbb{E}[\text{distinct experts}] = E\left[1 - \left(1 - \tfrac{k}{E}\right)^{N}\right]$$

This models reuse, not load balance, communication, or actual routing statistics.

## Serving metrics

- TTFT: request-send to first output token, at a declared measurement boundary.
- Per-request TPOT for $N > 1$: $$t_\text{TPOT} = \frac{\tau_N - \tau_1}{N - 1}$$
- ITL: individual token gaps; network chunks containing several tokens limit observability.
- Output throughput: generated output tokens / elapsed measurement time. Label input and total throughput separately.
- Little's law, in a stable system at matching boundaries: $$\bar{L} = \lambda \, \bar{W}$$ mean in-flight requests equals completion rate times mean latency.
- Request goodput: successful requests satisfying **all** specified per-request limits / elapsed time. Separate this from population percentile SLOs.
- Speculation helps when, at comparable load: $$k\, t_\text{draft} + t_\text{verify} < \mathbb{E}[a + 1] \cdot t_\text{step}$$ Measure both the work and the acceptance rate.

## Before an optimization

Which workload? Which constrained resource? Which observation supports that? What else explains it? Which metric should change? What experiment would disprove the hypothesis? What quality or operational cost accompanies it?
