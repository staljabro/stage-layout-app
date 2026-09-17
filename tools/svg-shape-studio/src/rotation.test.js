import assert from 'node:assert/strict';
import test from 'node:test';
import { objectPivot, rotateObjects, rotatedBounds } from './rotation.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} differs from ${b}`);

test('group rotation moves centers together and preserves each local shape', () => {
  const items = [
    { id: 1, type: 'rect', x: 0, y: 0, width: 2, height: 2, rotation: 30 },
    { id: 2, type: 'vector', x: 4, y: 0, width: 2, height: 2, rotation: -20, nodes: [{ x: .2, y: .3 }] },
  ];
  const result = rotateObjects(items, { x: 3, y: 1 }, 90);
  near(result[0].x, 2); near(result[0].y, -2);
  near(result[1].x, 2); near(result[1].y, 2);
  assert.equal(result[0].rotation, 120);
  assert.equal(result[1].rotation, 70);
  assert.deepEqual(result[1].nodes, items[1].nodes);
  const restored = rotateObjects(result, { x: 3, y: 1 }, -90);
  restored.forEach((item, i) => {
    near(item.x, items[i].x); near(item.y, items[i].y);
    assert.equal(item.rotation, items[i].rotation);
  });
  assert.equal(items[0].rotation, 30);
});

test('object rotation respects the tripod hub and rotated selection bounds', () => {
  const tripod = { type: 'tripod', x: 3, y: 4, width: Math.sqrt(3) * 2, height: 3, legRadius: 2, rotation: 170 };
  const pivot = objectPivot(tripod);
  const [rotated] = rotateObjects([tripod], { x: tripod.x + pivot.x, y: tripod.y + pivot.y }, 30);
  near(rotated.x, tripod.x); near(rotated.y, tripod.y);
  assert.equal(rotated.rotation, -160);
  const bounds = rotatedBounds([{ type: 'rect', x: 0, y: 0, width: 4, height: 2, rotation: 90 }]);
  near(bounds.x, 1); near(bounds.right, 3); near(bounds.y, -1); near(bounds.bottom, 3);
});
