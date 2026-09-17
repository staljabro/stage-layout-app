import assert from 'node:assert/strict';
import test from 'node:test';
import { pointOnArc, stagePath, sampleStageBoundary } from './stage-geometry.js';

test('a centered arc keeps the curved stage front from the editor', () => {
  const nodes = [
    { x: 0, y: 0, curveMode: 'line' },
    { x: 10, y: 0, curveMode: 'line' },
    { x: 10, y: 2.5, curveMode: 'line' },
    { x: 0, y: 2.5, curveMode: 'pointArc', arcDepth: -2.5 },
  ];
  assert.deepEqual(pointOnArc(nodes[2], nodes[3]), { x: 5, y: 5 });
  assert.ok(stagePath(nodes).includes('Q 5 7.5 0 2.5'));
  assert.ok(sampleStageBoundary(nodes).some(point => point.x === 5 && point.y === 5));
});

test('an audience band retains both curves beyond the stage canvas', () => {
  const nodes = [
    { x: 0, y: 2.51, curveMode: 'line' },
    { x: 10, y: 2.51, curveMode: 'pointArc', arcDepth: 2.49 },
    { x: 10, y: 3.11, curveMode: 'line' },
    { x: 0, y: 3.11, curveMode: 'pointArc', arcDepth: -2.49 },
  ];
  assert.deepEqual(pointOnArc(nodes[0], nodes[1]), { x: 5, y: 5 });
  assert.ok(Math.abs(pointOnArc(nodes[2], nodes[3]).y - 5.6) < 1e-10);
  assert.equal((stagePath(nodes).match(/Q /g) || []).length, 2);
  assert.ok(sampleStageBoundary(nodes).some(point => point.y > 5));
});

test('legacy arc coordinates project onto the same perpendicular constraint', () => {
  assert.deepEqual(pointOnArc({ x: 0, y: 0 }, { x: 10, y: 0, arcX: 8, arcY: 2 }), { x: 5, y: 2 });
  assert.deepEqual(pointOnArc({ x: 1, y: 1 }, { x: 1, y: 1, arcDepth: 2 }), { x: 1, y: 1 });
  assert.equal(stagePath(undefined), '');
});
