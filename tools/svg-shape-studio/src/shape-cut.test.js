import test from 'node:test';
import assert from 'node:assert/strict';
import { subtractLayers, vectorFromCutRing } from './shape-cut.js';
import { sampleStageBoundary } from '../../../src/stage-geometry.js';

test('a rectangle cuts a circle into an editable half-circle vector',()=>{
  const circle={id:1,type:'circle',name:'Circle',x:0,y:0,width:2,height:2,rotation:0,fill:'#fff',collision:false};
  const cutter={id:2,type:'rect',x:1,y:0,width:2,height:2,rotation:0};
  const rings=subtractLayers(circle,cutter);
  assert.equal(rings.length,1);
  const result=vectorFromCutRing(circle,rings[0],circle.id);
  assert.equal(result.type,'vector');assert.equal(result.id,circle.id);assert.ok(result.width<=1.001);assert.equal(result.collision,false);
  assert.ok(result.nodes.some(node=>node.curveMode==='bezier'),'the circular cut edge should remain curved');
  assert.ok(result.nodes.some(node=>node.curveMode==='line'),'the cutter edge should remain straight');
});

test('straight-sided cut results remain straight vector segments',()=>{
  const bottom={id:1,type:'rect',x:0,y:0,width:2,height:2};
  const cutter={id:2,type:'rect',x:1,y:0,width:2,height:1};
  const result=vectorFromCutRing(bottom,subtractLayers(bottom,cutter)[0],bottom.id);
  assert.ok(result.nodes.length>=4);
  assert.ok(result.nodes.every(node=>node.curveMode==='line'));
});

test('cut results retain collision-only layer behaviour',()=>{
  const bottom={id:1,type:'vector',collisionOnly:true,collision:true,name:'Collision shape',x:0,y:0,width:2,height:2,nodes:[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}]};
  const cutter={id:2,type:'rect',x:1,y:0,width:2,height:1};
  const result=vectorFromCutRing(bottom,subtractLayers(bottom,cutter)[0],bottom.id);
  assert.equal(result.collisionOnly,true);
  assert.equal(result.collision,true);
});

test('circle-on-circle cuts always produce a renderable closed vector',()=>{
  const bottom={id:1,type:'circle',x:0,y:0,width:2,height:2};
  for(const cutterX of [.2,1,3]){
    const cutter={id:2,type:'circle',x:cutterX,y:0,width:2,height:2};
    const result=vectorFromCutRing(bottom,subtractLayers(bottom,cutter)[0],bottom.id);
    assert.ok(result.nodes.length>=3,`cut at x=${cutterX} needs at least three closed-path nodes`);
    assert.ok(result.nodes.some(node=>node.curveMode==='bezier'));
  }
});

test('circle-on-circle cuts retain the source circles curvature',()=>{
  const bottom={id:1,type:'circle',x:0,y:0,width:2,height:2};
  const cutter={id:2,type:'circle',x:0,y:.4,width:2,height:2};
  const result=vectorFromCutRing(bottom,subtractLayers(bottom,cutter)[0],bottom.id);
  const maximumRadialError=Math.max(...sampleStageBoundary(result.nodes,100).map(point=>Math.min(
    Math.abs(Math.hypot(point.x-1,point.y-1)-1),
    Math.abs(Math.hypot(point.x-1,point.y-1.4)-1),
  )));
  assert.ok(maximumRadialError<.004,`expected less than 4 mm radial error, received ${maximumRadialError} m`);
});

test('cuts that create unsupported holes are rejected',()=>{
  const bottom={type:'rect',x:0,y:0,width:4,height:4};
  const cutter={type:'circle',x:1,y:1,width:2,height:2};
  assert.throws(()=>subtractLayers(bottom,cutter),/create a hole/);
});
