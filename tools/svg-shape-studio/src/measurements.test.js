import test from 'node:test';
import assert from 'node:assert/strict';
import { toCentimetres, fromCentimetres } from './measurements.js';
test('Studio centimetres map to Stageplot metres without changing the physical scale', () => {
  for (const [metres, cm] of [[.6,60],[10,1000],[5,500],[-.2,-20],[.01,1]]) {
    assert.equal(toCentimetres(metres),cm);
    assert.equal(fromCentimetres(cm),metres);
  }
});
test('measurement fields round to whole centimetres and two decimal metre values', () => {
  assert.equal(toCentimetres(.693),69);
  assert.equal(fromCentimetres('69.3'),.69);
  assert.equal(fromCentimetres('69.7'),.70);
});
