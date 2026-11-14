import test from 'node:test'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {summariseLayoutChanges} from './layout-changes.js'
import {alignItems,distributeItems} from './layout-tools.js'
import {validateLayout} from './layout-validation.js'

const item=index=>({id:index,assetId:'chair',xMeters:1+(index%40)*2,yMeters:1+Math.floor(index/40)*2,widthMeters:.5,depthMeters:.5,rotation:0,shapes:[],collisionShapes:[{type:'rect',x:0,y:0,width:.5,height:.5}]})

test('large layout editing and comparison stay within an interactive budget',()=>{
  const items=Array.from({length:2000},(_,index)=>item(index)),changed=items.map((entry,index)=>index%10?entry:{...entry,xMeters:entry.xMeters+.1})
  const started=performance.now(),summary=summariseLayoutChanges({layoutEquipment:items},{layoutEquipment:changed}),aligned=alignItems(items.slice(0,1000),'top'),distributed=distributeItems(items.slice(0,1000),'horizontal'),elapsed=performance.now()-started
  assert.equal(summary.find(change=>change.code==='equipment-moved')?.count,200)
  assert.equal(aligned.length,1000);assert.equal(distributed.length,1000)
  assert.ok(elapsed<1000,`layout transforms and comparison took ${elapsed.toFixed(1)} ms`)
})

test('validation handles a dense 1200-item layout within the save-time budget',()=>{
  const items=Array.from({length:1200},(_,index)=>item(index)),stage={boundary:{nodes:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]},fixedEquipment:[],availableEquipment:[]}
  const started=performance.now(),issues=validateLayout({stage,items}),elapsed=performance.now()-started
  assert.deepEqual(issues,[])
  assert.ok(elapsed<500,`layout validation took ${elapsed.toFixed(1)} ms`)
})
