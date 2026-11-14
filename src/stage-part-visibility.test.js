import test from 'node:test'
import assert from 'node:assert/strict'
import {stagePartGroups,stagePartVisible,applyStagePartVisibility,normaliseStagePartVisibility} from './stage-part-visibility.js'
import {curtainCollisionLines} from './stage-curtain.js'
import {projectFile,resolveProject,stageSpace} from './project-file.js'

const group={editorGroupId:'optional',editorGroupToggleable:true,editorGroupName:'Backdrop'}
const stage={id:'stage',label:'Stage',dimensions:{widthMeters:10,depthMeters:5},zones:[{id:'zone',...group},{id:'permanent'}],textItems:[{id:'text',...group}],curtains:[{id:'curtain',...group,length:4},{id:'other',toggleable:true,length:2},{id:'hidden',toggleable:true,visible:false},{id:'fixed',length:3}]}
test('optional stage groups include curtains and have distinct controls from individually optional parts',()=>{
  assert.deepEqual(stagePartGroups(stage).map(({name,ids})=>({name,ids})),[{name:'Backdrop',ids:['zone','text','curtain']},{name:'Curtain',ids:['other']},{name:'Curtain',ids:['hidden']}])
  assert.deepEqual(normaliseStagePartVisibility(stage,{curtain:false,permanent:false,fixed:false,obsolete:false}),{zone:true,text:true,curtain:false,other:true,hidden:true})
})
test('layout toggles remove optional curtain collisions while respecting source visibility and preserving the source',()=>{
  const original=structuredClone(stage),effective=applyStagePartVisibility(stage,{zone:false,curtain:false,other:false,hidden:true,fixed:false})
  assert.equal(effective.zones[0].visible,false)
  assert.equal(effective.curtains[2].visible,false,'author-hidden layers cannot be revealed')
  assert.equal(effective.curtains[3].visible,true,'non-toggleable curtain ignores layout requests')
  assert.equal(curtainCollisionLines(effective).length,1)
  assert.deepEqual(stage,original)
})
test('per-layout curtain choices survive serialization and are filtered against the pinned stage',()=>{
  const file=projectFile('Concert',stageSpace(stage,{curtain:false,other:false,fixed:false}),[])
  const result=resolveProject(file,[],[stage])
  assert.deepEqual(result.space.partVisibility,{zone:true,text:true,curtain:false,other:false,hidden:true})
  assert.equal(curtainCollisionLines(applyStagePartVisibility(result.space.assetSnapshot,result.space.partVisibility)).length,1)
})
test('one layout control hides roof artwork and installed roof equipment',()=>{
  const roofStage={...stage,images:[{id:'truss-image',layerStack:'roof'}],fixedEquipment:[{id:'flown-speaker',layerStack:'roof',visible:true},{id:'floor-kit',visible:true}]}
  assert.deepEqual(stagePartGroups(roofStage).map(({name})=>name),['Overhead Layers','Backdrop','Curtain','Curtain'])
  const visibility=normaliseStagePartVisibility(roofStage,{roof:false})
  assert.equal(visibility.roof,false)
  const effective=applyStagePartVisibility(roofStage,visibility)
  assert.equal(effective.images[0].visible,false)
  assert.equal(effective.fixedEquipment[0].visible,false)
  assert.equal(effective.fixedEquipment[1].visible,true)
})
test('editable installed equipment is toggleable per layout without changing the source',()=>{
  const installed={id:'piano',name:'House piano',toggleable:true,editable:true,xMeters:2,yMeters:2,visible:true}
  const source={...stage,fixedEquipment:[installed]}
  const visibility=normaliseStagePartVisibility(source,{piano:false})
  const effective=applyStagePartVisibility(source,visibility)
  assert.equal(stagePartGroups(source).some(group=>group.ids.includes('piano')),true)
  assert.equal(effective.fixedEquipment[0].visible,false)
  assert.equal(source.fixedEquipment[0].visible,true)
})

test('clients can hide source dimension lines without changing the stage',()=>{
  const source={...stage,editor:{dimensionLines:[{id:'width',x:0,y:0,length:4}]}}
  assert.equal(normaliseStagePartVisibility(source).dimensions,true)
  assert.equal(stagePartVisible(source.editor.dimensionLines[0],{dimensions:false}),false)
  assert.ok(stagePartGroups(source).some(group=>group.id==='dimensions'&&group.name==='Dimensions'))
})
