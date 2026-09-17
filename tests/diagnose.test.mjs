import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/diagnose.mjs', import.meta.url);
let rank, hypotheses, symptoms;
try { ({ rank, hypotheses, symptoms } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

test('every hypothesis carries a discriminating test and a counter-hypothesis', () => {
  assert.ok(hypotheses, 'Hypotheses must be exported');
  assert.ok(hypotheses.length >= 6, 'a differential needs enough candidates to be worth running');
  for (const h of hypotheses) {
    assert.ok(h.id && h.label, `${h.id}: needs an identity`);
    assert.ok(h.discriminator && h.discriminator.length > 20, `${h.id}: needs a falsifying test`);
    assert.ok(h.counter && h.counter.length > 20, `${h.id}: needs a counter-hypothesis`);
    assert.ok(Array.isArray(h.raisedBy) && h.raisedBy.length > 0, `${h.id}: needs symptoms that raise it`);
    for (const s of h.raisedBy) assert.ok(symptoms.some(x => x.id === s), `${h.id}: unknown symptom ${s}`);
  }
});

test('no symptom is a dead end', () => {
  for (const s of symptoms) {
    assert.ok(hypotheses.some(h => h.raisedBy.includes(s.id)), `${s.id} raises nothing`);
  }
});

test('with no observations nothing is ranked above anything else', () => {
  assert.equal(typeof rank, 'function', 'The ranking must be implemented');
  const r = rank([]);
  assert.equal(r.length, hypotheses.length);
  assert.ok(r.every(h => h.score === 0), 'an empty differential must not pretend to have a leader');
});

test('observations rank the hypotheses they support', () => {
  const r = rank(['ttft-high', 'throughput-flat']);
  assert.ok(r[0].score > 0);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score, 'must be sorted by support');
  const queueing = r.find(h => h.id === 'queueing');
  assert.ok(queueing.score >= 1, 'queueing is raised by a high TTFT');
});

test('a memory-pressure observation raises the memory candidates specifically', () => {
  const r = rank(['memory-near-cap']);
  const top = r.filter(h => h.score > 0).map(h => h.id);
  assert.ok(top.includes('cache-thrash'), 'cache pressure should be on the list');
  assert.ok(!top.includes('link-bound') || r.find(h => h.id === 'link-bound').score === 0,
    'an unrelated candidate must not be raised by memory pressure alone');
});

test('unknown observations are ignored rather than silently scoring', () => {
  assert.deepEqual(rank(['not-a-symptom']).map(h => h.score), rank([]).map(h => h.score));
});
