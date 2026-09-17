import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionBox, enclosedItems } from './marquee.js';
import { rotatedBounds } from '../tools/svg-shape-studio/src/rotation.js';
const bounds=item=>rotatedBounds([item]);
test('marquee is direction independent and excludes partially intersecting objects', () => {
  const box=selectionBox({x:4,y:4},{x:0,y:0});
  assert.deepEqual(box,{x:0,y:0,right:4,bottom:4});
  const items=[{id:1,x:1,y:1,width:1,height:1},{id:2,x:3.5,y:3.5,width:1,height:1}];
  assert.deepEqual(enclosedItems(items,box,bounds),[1]);
});
test('all members of a group must fit and rotation affects containment', () => {
  const box={x:0,y:0,right:2,bottom:2};
  const grouped=[{id:1,editorGroupId:'a',x:.2,y:.2,width:.2,height:.2},{id:2,editorGroupId:'a',x:3,y:3,width:1,height:1}];
  assert.deepEqual(enclosedItems(grouped,box,bounds),[]);
  const square={id:3,x:0,y:0,width:2,height:2};
  assert.deepEqual(enclosedItems([square],box,bounds),[3]);
  assert.deepEqual(enclosedItems([{...square,rotation:45}],box,bounds),[]);
});
