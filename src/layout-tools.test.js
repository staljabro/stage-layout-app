import test from 'node:test'
import assert from 'node:assert/strict'
import { alignItems, distributeItems, availablePlacement } from './layout-tools.js'
import { isItemInsideSpace, itemsCollide, rectangleBoundary } from './geometry.js'

const item=(id,x,y,width=1,height=1)=>({id,xMeters:x,yMeters:y,widthMeters:width,depthMeters:height,rotation:0})

test('alignment uses visible rotated bounds',()=>{
  const result=alignItems([item(1,2,1,2),item(2,5,3,1)],'left')
  assert.equal(result[0].xMeters-result[0].widthMeters/2,result[1].xMeters-result[1].widthMeters/2)
  assert.deepEqual(alignItems([item(1,1,2),item(2,3,5)],'vcentre').map(entry=>entry.yMeters),[3.5,3.5])
})

test('distribution preserves outer items and spaces centres evenly',()=>{
  const result=distributeItems([item(1,0,0),item(2,8,0),item(3,2,0),item(4,10,0)],'horizontal').sort((a,b)=>a.xMeters-b.xMeters)
  assert.deepEqual(result.map(entry=>Number(entry.xMeters.toFixed(3))),[0,3.333,6.667,10])
})

test('new equipment finds a clear position near house equipment and respects a full stage',()=>{
  const space={width:6,depth:4},house=item(1,3,2,2,2),requested=item(2,3,2)
  const valid=candidate=>isItemInsideSpace(candidate,rectangleBoundary(6,4))&&!itemsCollide(candidate,house)
  const placed=availablePlacement(requested,space,valid)
  assert.ok(placed)
  assert.equal(valid(placed),true)
  assert.equal(requested.xMeters,3)
  assert.equal(availablePlacement(requested,space,()=>true),requested)
  assert.equal(availablePlacement(requested,space,()=>false),null)
})
