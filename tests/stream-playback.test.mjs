import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamFrames, streamStages } from '../site/src/streamPlayback.mjs';
import { requestMetrics } from '../site/src/metrics.mjs';

/** The explorer's own stream: 24 tokens, steady 40ms, one 600ms stall at 12. */
function stream({ ttft = 220, itl = 40, tokens = 24, stallAt = 12, stallMs = 600 } = {}) {
  const times = [];
  let t = ttft;
  for (let i = 0; i < tokens; i++) {
    if (i > 0) t += itl + (i === stallAt ? stallMs : 0);
    times.push(t);
  }
  return { sentAt: 0, tokenTimes: times };
}

test('there is one frame per arrival, plus the wait before the first', () => {
  const s = stream();
  const frames = streamFrames(s);
  assert.equal(frames.length, s.tokenTimes.length + 1);
  assert.equal(frames[0].arrived, 0);
  assert.equal(frames.at(-1).arrived, s.tokenTimes.length);
});

test('the opening frame has no metrics, because nothing has arrived', () => {
  const frames = streamFrames(stream());
  assert.equal(frames[0].metrics, null);
  assert.equal(frames[0].gap, null);
});

test('the final frame agrees exactly with the static readout', () => {
  // If these ever diverge, the animation is telling a different story from the
  // number printed beneath it.
  const s = stream();
  const frames = streamFrames(s);
  assert.deepEqual(frames.at(-1).metrics, requestMetrics(s));
});

test('TTFT is settled by the first token and never moves again', () => {
  const frames = streamFrames(stream()).filter(f => f.metrics);
  const ttfts = new Set(frames.map(f => f.metrics.ttft));
  assert.equal(ttfts.size, 1, 'TTFT changed while the stream was arriving');
  assert.equal([...ttfts][0], 220);
});

test('TPOT holds at the steady gap until the stall lands', () => {
  const frames = streamFrames(stream());
  const beforeStall = frames.filter(f => f.metrics?.tpot !== null && f.arrived > 1 && f.arrived <= 12);
  for (const f of beforeStall) {
    assert.equal(Math.round(f.metrics.tpot), 40, `TPOT drifted at token ${f.arrived}`);
  }
});

test('the stall is one frame, and the average never recovers from it', () => {
  const frames = streamFrames(stream());
  const stalls = frames.filter(f => f.isStall);
  assert.equal(stalls.length, 1, 'more than one gap was called the stall');
  assert.equal(stalls[0].gap, 640);

  const stallIndex = frames.indexOf(stalls[0]);
  const before = frames[stallIndex - 1].metrics.tpot;
  const at = frames[stallIndex].metrics.tpot;
  assert.ok(at > before, 'the average did not move when the stall landed');
  // This is the lesson: it stays polluted for the rest of the stream.
  for (const f of frames.slice(stallIndex)) {
    assert.ok(f.metrics.tpot > 40, `the average recovered at token ${f.arrived}`);
  }
});

test('a stream with no stall marks no frame as one', () => {
  const frames = streamFrames(stream({ stallMs: 0 }));
  assert.equal(frames.filter(f => f.isStall).length, 0);
});

test('the stages are found in the arrivals and stay in order', () => {
  const stages = streamStages(streamFrames(stream()));
  assert.deepEqual(stages.map(s => s.id), ['wait', 'first', 'steady', 'stall', 'after']);
  for (let i = 1; i < stages.length; i++) {
    assert.ok(stages[i].frame > stages[i - 1].frame, `${stages[i].id} does not advance`);
  }
});

test('a stream without a stall loses the stall stage rather than faking it', () => {
  const stages = streamStages(streamFrames(stream({ stallMs: 0 })));
  assert.equal(stages.some(s => s.id === 'stall'), false);
  assert.equal(stages.some(s => s.id === 'after'), false);
  assert.ok(stages.length >= 2);
});

test('a one-token stream still produces a usable scene', () => {
  const frames = streamFrames({ sentAt: 0, tokenTimes: [220] });
  assert.equal(frames.length, 2);
  assert.equal(frames[1].metrics.tpot, null, 'one token has no gaps, so no TPOT');
  assert.ok(streamStages(frames).length >= 1);
});

test('an empty stream is refused rather than rendering nothing', () => {
  assert.throws(() => streamFrames({ sentAt: 0, tokenTimes: [] }), /Invalid token times/);
});
