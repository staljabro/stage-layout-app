import test from 'node:test'
import assert from 'node:assert/strict'
import { alignItems, distributeItems } from './layout-tools.js'

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
