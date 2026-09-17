import assert from 'node:assert/strict';
import test from 'node:test';
import { stageControlPoints, nearestControl } from './stage-controls.js';
test('all arc modes expose the appropriate selectable controls', () => {
  const from={x:0,y:0};
  assert.deepEqual(stageControlPoints([from,{x:2,y:0,curveMode:'line'}],1),[]);
  assert.deepEqual(stageControlPoints([from,{x:2,y:0,curveMode:'pointArc',arcDepth:.5}],1),[['pointArc',{x:1,y:.5}]]);
  assert.deepEqual(stageControlPoints([from,{x:2,y:0,curveMode:'smooth',cx:1,cy:1}],1),[['smooth',{x:1,y:1}]]);
  assert.equal(stageControlPoints([from,{x:2,y:0,curveMode:'bezier'}],1).length,5);
  assert.deepEqual(stageControlPoints([from],null),[]);
});
test('handle hit testing works in screen pixels and selects the nearest handle', () => {
  const controls=[['midpoint',{x:1,y:1}],['endIn',{x:1.1,y:1}]];
  const screen=point=>({x:point.x*100+25,y:point.y*100+40});
  assert.equal(nearestControl(controls,{x:134,y:140},screen),'endIn');
  assert.equal(nearestControl(controls,{x:126,y:140},screen),'midpoint');
  assert.equal(nearestControl(controls,{x:160,y:140},screen),undefined);
});
