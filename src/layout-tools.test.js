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

test('distribution preserves outer items and creates equal edge gaps',()=>{
  const result=distributeItems([item(1,0,0,1),item(2,8,0,2),item(3,2,0,3),item(4,10,0,1)],'horizontal').sort((a,b)=>a.xMeters-b.xMeters)
  const gaps=result.slice(1).map((entry,index)=>(entry.xMeters-entry.widthMeters/2)-(result[index].xMeters+result[index].widthMeters/2))
  assert.deepEqual(gaps.map(gap=>Number(gap.toFixed(3))),[1.333,1.333,1.333])
})

test('alignment and distribution keep equipment groups rigid',()=>{
  const grouped=[{...item(1,1,1),equipmentGroup:{id:'pair'}},{...item(2,2,1),equipmentGroup:{id:'pair'}}],items=[...grouped,item(3,5,4),item(4,9,7)]
  const aligned=alignItems(items,'top')
  assert.equal(aligned[1].xMeters-aligned[0].xMeters,1)
  assert.equal(aligned[1].yMeters-aligned[0].yMeters,0)
  const distributed=distributeItems(items,'vertical')
  assert.equal(distributed[1].xMeters-distributed[0].xMeters,1)
  assert.equal(distributed[1].yMeters-distributed[0].yMeters,0)
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
