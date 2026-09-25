import test from 'node:test';
import assert from 'node:assert/strict';
import { finishDrawnVector, drawingEndpoint } from './vector-drawing.js';
import { vectorPath } from './vector-conversion.js';
const draft={id:1,type:'vector',x:2,y:3,fill:'none',nodes:[{x:0,y:0,curveMode:'line'},{x:-1,y:1,curveMode:'line'},{x:1,y:2,curveMode:'line'}]};
test('finishing a point-by-point vector preserves positions and normalizes dimensions', () => {
  const result=finishDrawnVector(draft);
  assert.equal(result.open,true);
  assert.equal(result.collision,false);
  assert.equal(result.width,2);
  assert.equal(result.height,2);
  result.nodes.forEach((node,index)=>{
    assert.equal(result.x+node.x,draft.x+draft.nodes[index].x);
    assert.equal(result.y+node.y,draft.y+draft.nodes[index].y);
  });
  assert.ok(!vectorPath(result).includes('Z'));
});
test('closing needs three points and generates a filled vector without enabling collision', () => {
  const closed=finishDrawnVector(draft,true);
  assert.equal(closed.open,false);
  assert.equal(closed.collision,false);
  assert.equal(closed.fill,'#e9f5bc');
  assert.ok(vectorPath(closed).endsWith('Z'));
  const single=finishDrawnVector({...draft,nodes:[draft.nodes[0]]},true);
  assert.equal(single.open,true);
  assert.ok(vectorPath(single).startsWith('M '));
  assert.equal(vectorPath({nodes:[]}), '');
});
test('clicking the first endpoint closes and the newest endpoint finishes an open path', () => {
  const screen=p=>({x:p.x*100,y:p.y*100});
  assert.equal(drawingEndpoint(draft,{x:200,y:300},screen),'closed');
  assert.equal(drawingEndpoint(draft,{x:300,y:500},screen),'open');
  assert.equal(drawingEndpoint(draft,{x:400,y:400},screen),null);
  assert.equal(drawingEndpoint({...draft,nodes:draft.nodes.slice(0,2)},{x:200,y:300},screen),'open');
});
