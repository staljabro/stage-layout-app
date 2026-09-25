import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryBounds, translateBoundaryNodes } from './stage-zone.js';

test('translating a zone moves nodes and every curved-segment control',()=>{
  const nodes=[{x:0,y:0},{x:2,y:0,curveMode:'bezier',mx:1,my:-1,startOutX:.3,startOutY:0,midInX:.7,midInY:-1,midOutX:1.3,midOutY:-1,endInX:1.7,endInY:0},{x:2,y:2},{x:0,y:2,cx:-.5,cy:1,arcX:-.2,arcY:1}];
  const moved=translateBoundaryNodes(nodes,4,7);
  assert.deepEqual([moved[0].x,moved[0].y],[4,7]);
  assert.deepEqual([moved[1].mx,moved[1].my,moved[1].startOutX,moved[1].midOutY],[5,6,4.3,6]);
  assert.deepEqual([moved[3].cx,moved[3].cy,moved[3].arcX,moved[3].arcY],[3.5,8,3.8,8]);
});

test('zone bounds expose top-left and bounds-centre anchors',()=>{
  const bounds=boundaryBounds([{x:1,y:2},{x:5,y:2},{x:5,y:6},{x:1,y:6}]);
  assert.deepEqual(bounds,{x:1,y:2,right:5,bottom:6,width:4,height:4,centreX:3,centreY:4});
});
