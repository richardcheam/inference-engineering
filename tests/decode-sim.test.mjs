import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/decodeSim.mjs', import.meta.url);
let runDecode, EXAMPLE;
try { ({ runDecode, EXAMPLE } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const run = (o = {}) => {
  assert.equal(typeof runDecode, 'function', 'The decode walkthrough must be implemented');
  return runDecode({ ...EXAMPLE, blockSize: 4, ...o });
};

test('the example is real text a reader can check against their own intuition', () => {
  assert.ok(EXAMPLE, 'An example must be exported');
  assert.ok(EXAMPLE.prompt.length > 0 && EXAMPLE.promptTokens.length >= 4);
  assert.equal(EXAMPLE.promptTokens.join(''), EXAMPLE.prompt, 'tokens must reconstruct the prompt exactly');
  assert.equal(EXAMPLE.outputTokens.join(''), EXAMPLE.output, 'tokens must reconstruct the output exactly');
});

test('the walkthrough starts before anything has happened', () => {
  const f = run();
  assert.equal(f[0].phase, 'input');
  assert.equal(f[0].cache.length, 0);
  assert.equal(f[0].outputText, '');
});

test('tokenizing splits the prompt without yet computing anything', () => {
  const tokenize = run().find(f => f.phase === 'tokenize');
  assert.ok(tokenize, 'there must be a tokenize step');
  assert.equal(tokenize.tokens.length, EXAMPLE.promptTokens.length);
  assert.equal(tokenize.cache.length, 0, 'tokenizing fills no cache');
});

test('prefill puts every prompt token into the cache in a single step', () => {
  const frames = run();
  const prefill = frames.find(f => f.phase === 'prefill');
  assert.ok(prefill, 'there must be a prefill step');
  assert.equal(prefill.cache.length, EXAMPLE.promptTokens.length, 'all prompt tokens cached at once');
  assert.equal(prefill.writes, EXAMPLE.promptTokens.length);
  assert.equal(prefill.outputText, '', 'prefill produces no output text yet');
});

test('each decode step writes exactly one token and reads the whole cache', () => {
  const decodes = run().filter(f => f.phase === 'decode');
  assert.equal(decodes.length, EXAMPLE.outputTokens.length);
  decodes.forEach((f, i) => {
    assert.equal(f.writes, 1, `step ${i} must write one token`);
    assert.equal(f.reads, EXAMPLE.promptTokens.length + i, `step ${i} reads everything cached before it`);
  });
});

test('the output text grows one token at a time and ends up correct', () => {
  const frames = run();
  const decodes = frames.filter(f => f.phase === 'decode');
  let previous = '';
  for (const f of decodes) {
    assert.ok(f.outputText.startsWith(previous), 'output only ever grows');
    assert.ok(f.outputText.length > previous.length);
    previous = f.outputText;
  }
  assert.equal(previous, EXAMPLE.output, 'the finished text matches the example');
  assert.equal(frames[frames.length - 1].phase, 'done');
});

test('the cache holds prompt then output, in order, with no gaps', () => {
  const last = run().at(-1);
  const expected = [...EXAMPLE.promptTokens, ...EXAMPLE.outputTokens];
  assert.deepEqual(last.cache.map(c => c.text), expected);
  last.cache.forEach((c, i) => {
    assert.equal(c.position, i, 'cache positions are contiguous');
    assert.equal(c.kind, i < EXAMPLE.promptTokens.length ? 'prompt' : 'output');
  });
});

test('a block fills completely before the next one opens', () => {
  for (const blockSize of [2, 4, 8]) {
    const last = run({ blockSize });
    const total = last.at(-1).cache.length;
    assert.equal(last.at(-1).blocks.length, Math.ceil(total / blockSize), `block count at size ${blockSize}`);
    last.at(-1).blocks.slice(0, -1).forEach((b, i) => {
      assert.equal(b.tokens.length, blockSize, `block ${i} must be full before the next opens`);
    });
  }
});

test('invalid configuration never produces a walkthrough', () => {
  for (const o of [{ blockSize: 0 }, { blockSize: -2 }, { promptTokens: [] }, { outputTokens: [] }]) {
    assert.throws(() => run(o), /invalid/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});
