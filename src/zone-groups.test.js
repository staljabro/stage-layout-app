import test from 'node:test'
import assert from 'node:assert/strict'
import { copyStageGroups, copyZoneGroups, stageGroupIds, stageText, stageZone, zoneGroupIds } from './zone-groups.js'
import { stageSpace, projectFile, resolveProject } from './project-file.js'
import { toggleableParts, setPart } from './part-toggles.js'

const zones=[{id:'a',name:'Left',solid:true,editorGroupId:'g',editorGroupName:'Risers',editorGroupToggleable:true},{id:'b',name:'Right',editorGroupId:'g',editorGroupName:'Risers',editorGroupToggleable:true},{id:'c',name:'Fixed'}]

test('group members select together and copies form an independent group',()=>{
  assert.deepEqual(zoneGroupIds(zones,'b'),['a','b'])
  assert.deepEqual(zoneGroupIds(zones,'c'),['c'])
  const copied=copyZoneGroups(zones,()=> 'new-group')
  assert.equal(copied[0].editorGroupId,'new-group')
  assert.equal(copied[1].editorGroupId,'new-group')
  assert.equal(copied[2].editorGroupId,undefined)
  assert.equal(zones[0].editorGroupId,'g')
})

test('stage groups can span zones, text and dimensions',()=>{
  const assets=[zones[0],{id:'text',editorGroupId:'g'},{id:'dimension',editorGroupId:'g'}]
  assert.deepEqual(stageGroupIds(assets,'text'),['a','text','dimension'])
  assert.ok(copyStageGroups(assets,()=> 'copied-group').every(asset=>asset.editorGroupId==='copied-group'))
})

test('one stage toggle hides every grouped zone and survives project reopening',()=>{
  const stage={id:'stage',label:'Stage',dimensions:{widthMeters:10,depthMeters:10},zones}
  const space=stageSpace(stage)
  const toggleItem={shapes:space.zones,partVisibility:space.partVisibility}
  assert.deepEqual(toggleableParts(toggleItem),[{name:'Risers',ids:['a','b']}])
  space.partVisibility=setPart(toggleItem,'Risers',false).partVisibility
  const restored=resolveProject(projectFile('Concert',space,[]),[],[stage]).space
  assert.equal(restored.zones[0].solid,true)
  assert.equal(restored.zones[0].toggleable,true)
  assert.deepEqual(restored.partVisibility,{a:false,b:false})
  assert.equal(stageZone({...zones[0],editorGroupToggleable:false}).toggleable,undefined)
})

test('grouped stage text exposes the shared Stageplot toggle',()=>{
  assert.deepEqual(stageText({id:'text',editorGroupId:'g',editorGroupName:'Scenery',editorGroupToggleable:true}),{id:'text',editorGroupId:'g',editorGroupName:'Scenery',editorGroupToggleable:true,toggleable:true,toggleName:'Scenery'})
})
