import test from 'node:test'
import assert from 'node:assert/strict'
import {layoutRevisionState,summariseLayoutChanges} from './layout-changes.js'

const item=(id,x,y,rotation=0)=>({id,xMeters:x,yMeters:y,rotation})

test('summarises equipment additions, removals and position changes',()=>{
  const changes=summariseLayoutChanges(
    {layoutEquipment:[item('moved',1,1),item('removed',2,2)]},
    {layoutEquipment:[item('moved',1.5,1),item('added',3,3)]},
  )
  assert.deepEqual(changes.map(change=>[change.code,change.count]),[
    ['equipment-added',1],['equipment-removed',1],['equipment-moved',1],
  ])
})

test('summarises installed asset, visibility and notes changes',()=>{
  const changes=summariseLayoutChanges(
    {layoutFixedControls:{fixed:{$placement:{xMeters:1,yMeters:2}}},stagePartVisibility:{roof:true,curtain:false},layoutNotes:'Old'},
    {layoutFixedControls:{fixed:{$placement:{xMeters:2,yMeters:2}},newFixed:{$placement:{xMeters:4,yMeters:1}}},stagePartVisibility:{roof:false,curtain:false},layoutNotes:'New'},
  )
  assert.deepEqual(changes.map(change=>[change.code,change.count]),[
    ['stage-assets-positioned',2],['visibility-changed',1],['notes-changed',1],
  ])
})

test('ignores unchanged defaults and non-placement installed asset controls',()=>{
  const changes=summariseLayoutChanges(
    {layoutEquipment:[item(1,1,1)],layoutFixedControls:{fixed:{arm:{rotation:20}}},stagePartVisibility:{part:true}},
    {layoutEquipment:[item(1,1,1)],layoutFixedControls:{fixed:{arm:{rotation:40}}},stagePartVisibility:{}},
  )
  assert.deepEqual(changes,[])
})

test('maps stored project revisions into comparable layout state',()=>{
  assert.deepEqual(layoutRevisionState({data:{items:[item(1,2,3)],stage:{fixedEquipmentControls:{fixed:{$placement:{xMeters:4,yMeters:5}}},partVisibility:{roof:false}}},notes:'Bring risers',stageVersion:4}),{
    layoutEquipment:[item(1,2,3)],layoutFixedControls:{fixed:{$placement:{xMeters:4,yMeters:5}}},stagePartVisibility:{roof:false},layoutNotes:'Bring risers',stageVersion:4,
  })
})

test('reports source-stage updates between stored revisions',()=>{
  assert.deepEqual(summariseLayoutChanges({stageVersion:2},{stageVersion:3}),[{code:'source-stage-updated',count:3,message:'Source stage updated to version 3'}])
})
