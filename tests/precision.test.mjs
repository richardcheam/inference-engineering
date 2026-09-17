import test from 'node:test';
import assert from 'node:assert/strict';

const path = new URL('../site/src/precision.mjs', import.meta.url);
let quantize, formats;
try { ({ quantize, formats } = await import(path)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const base = { parameters: 100e9, format: 'fp8', groupSize: 128, scaleBits: 16 };
const run = (o = {}) => {
  assert.equal(typeof quantize, 'function', 'The quantization model must be implemented');
  return quantize({ ...base, ...o });
};

test('every format states its stored bits and whether the maths runs there', () => {
  assert.ok(formats.length >= 4);
  for (const f of formats) {
    assert.ok(f.id && f.label, `${f.id} needs an identity`);
    assert.ok(f.bits > 0 && f.bits <= 32, `${f.id} needs stored bits`);
    assert.ok(typeof f.executesNatively === 'boolean', `${f.id} must say whether kernels compute in it`);
  }
});

test('payload bytes follow the stored bit width', () => {
  assert.equal(run({ format: 'bf16' }).payloadBytes, 100e9 * 2);
  assert.equal(run({ format: 'fp8' }).payloadBytes, 100e9 * 1);
  assert.equal(run({ format: 'fp4' }).payloadBytes, 100e9 * 0.5);
});

test('scales are counted, because a 4-bit checkpoint is not 4 bits per parameter', () => {
  const r = run({ format: 'fp4', groupSize: 128, scaleBits: 16 });
  assert.ok(r.scaleBytes > 0, 'quantized formats carry per-group scales');
  assert.ok(r.effectiveBitsPerParameter > 4, `expected more than the nominal 4, got ${r.effectiveBitsPerParameter}`);
  assert.ok(r.effectiveBitsPerParameter < 4.2, 'but only slightly more at group 128');
});

test('smaller groups mean better fidelity and more scale overhead', () => {
  const coarse = run({ format: 'fp4', groupSize: 128 });
  const fine = run({ format: 'fp4', groupSize: 32 });
  assert.ok(fine.scaleBytes > coarse.scaleBytes);
  assert.ok(fine.effectiveBitsPerParameter > coarse.effectiveBitsPerParameter);
});

test('an unquantized format carries no scale overhead at all', () => {
  const r = run({ format: 'bf16' });
  assert.equal(r.scaleBytes, 0);
  assert.equal(r.effectiveBitsPerParameter, 16);
});

test('storing small does not imply computing small', () => {
  const fp4 = run({ format: 'fp4' });
  assert.equal(fp4.executesNatively, false, 'FP4 storage is commonly upcast to compute');
  assert.ok(fp4.note.length > 20, 'and that has to be said out loud');
});

test('the saving is reported against the same model in BF16', () => {
  const r = run({ format: 'fp8' });
  const bf16 = run({ format: 'bf16' });
  assert.ok(Math.abs(r.savingVsBf16 - (1 - r.totalBytes / bf16.totalBytes)) < 1e-9);
  assert.ok(r.savingVsBf16 > 0.4 && r.savingVsBf16 < 0.5, 'FP8 roughly halves a BF16 checkpoint');
});

test('invalid inputs never produce a footprint', () => {
  for (const o of [{ parameters: 0 }, { parameters: -1 }, { format: 'int3' }, { groupSize: 0 }, { groupSize: -8 }, { scaleBits: 0 }]) {
    assert.throws(() => run(o), /invalid|unknown/i, `expected ${JSON.stringify(o)} to be rejected`);
  }
});
