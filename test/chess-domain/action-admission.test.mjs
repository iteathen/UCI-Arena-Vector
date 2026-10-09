import assert from 'node:assert/strict';
import test from 'node:test';
import { actionToUci } from '../../components/chess-domain/admission.mjs';

test('UCI action decoding rejects values outside the integer action representation', () => {
  for (const action of [NaN, Infinity, -32768, -1, 1.5, '1', null, undefined, 0x8000]) {
    assert.throws(() => actionToUci(action), /invalid action encoding/);
  }
  assert.equal(actionToUci(12 | (28 << 6)), 'e2e4');
  assert.equal(actionToUci(48 | (56 << 6) | (4 << 12)), 'a7a8q');
});
