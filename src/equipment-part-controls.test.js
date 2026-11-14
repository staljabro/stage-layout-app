import test from 'node:test'
import assert from 'node:assert/strict'
import {equipmentRotationParts,applyFixedEquipmentControls,resetFixedEquipmentPlacements,translateFixedEquipmentPlacements} from './equipment-part-controls.js'
import {stageSpace,projectFile,resolveProject} from './project-file.js'
import {pinProject} from './project-snapshots.js'
import {customStagingItem,stagingSnapPoints} from './custom-items.js'

const part={id:'arm',name:'Boom',minRotation:-90,maxRotation:90,pivotX:.5,pivotY:.5}
const item={id:'stand',label:'Stand',dimensions:{widthMeters:1,depthMeters:1},shapes:[{id:'body',type:'rect',rotationPartId:'arm'}],rotationParts:[part]}
const stage={id:'stage',label:'Stage',dimensions:{widthMeters:10,depthMeters:5},fixedEquipment:[{...item,id:'installed',xMeters:2,yMeters:3,rotation:20,controls:{arm:{rotation:10}}}]}
test('decimal deck dimensions round to decimetres and snapping reaches fractional edges without points beyond the deck',()=>{
  const deck=customStagingItem({widthMeters:2.43,depthMeters:1.24})
  assert.equal(deck.widthMeters,2.4);assert.equal(deck.depthMeters,1.2)
  assert.equal(deck.collisionShapes[0].width,2.4)
  const points=stagingSnapPoints(2.4,1.2)
  assert.ok(points.some(point=>point.x===2.4&&point.y===1.2))
  assert.ok(points.every(point=>point.x<=2.4&&point.y<=1.2))
})
test('editable installed equipment accepts layout positions while locked equipment ignores them',()=>{
  const editableStage={...stage,fixedEquipment:[{...stage.fixedEquipment[0],editable:true},{...stage.fixedEquipment[0],id:'locked'}]}
  const saved={installed:{$placement:{xMeters:7,yMeters:4}},locked:{$placement:{xMeters:8,yMeters:1}}}
  const effective=applyFixedEquipmentControls(editableStage,saved)
  assert.deepEqual(effective.fixedEquipment.map(({xMeters,yMeters})=>({xMeters,yMeters})),[{xMeters:7,yMeters:4},{xMeters:2,yMeters:3}])
})
test('resetting installed positions preserves layout part rotations and unrelated overrides',()=>{
  const saved={installed:{$placement:{xMeters:7,yMeters:4},arm:{rotation:30}},other:{$placement:{xMeters:1,yMeters:1}}}
  assert.deepEqual(resetFixedEquipmentPlacements(saved,['installed']),{installed:{arm:{rotation:30}},other:{$placement:{xMeters:1,yMeters:1}}})
})
test('keyboard-style translations move only selected editable installed equipment',()=>{
  const editableStage={...stage,fixedEquipment:[{...stage.fixedEquipment[0],editable:true},{...stage.fixedEquipment[0],id:'other',editable:true,xMeters:5}]}
  const moved=translateFixedEquipmentPlacements(editableStage,{installed:{arm:{rotation:30}}},['installed'],.1,-.2)
  assert.deepEqual(moved,{installed:{arm:{rotation:30},$placement:{xMeters:2.1,yMeters:2.8}}})
  assert.deepEqual(applyFixedEquipmentControls(editableStage,moved).fixedEquipment.map(item=>[item.xMeters,item.yMeters]),[[2.1,2.8],[5,3]])
})
test('older snapshots recover missing part definitions from compatible equipment without replacing pinned artwork',()=>{
  const old={...item,rotationParts:undefined,shapes:[{...item.shapes[0],fill:'#123456'}]}
  const file={version:2,items:[{id:1,assetId:item.id,xMeters:1,yMeters:2,rotation:0,controls:{arm:{rotation:30}}}],assetSnapshots:{equipment:[old]}}
  const resolved=resolveProject(file,[item],[]).items[0]
  assert.equal(resolved.rotationParts[0].name,'Boom')
  assert.equal(resolved.controls.arm.rotation,30)
  assert.equal(resolved.shapes[0].fill,'#123456')
  assert.deepEqual(equipmentRotationParts({...old,shapes:[{id:'unrelated'}]},item),[])
})
test('installed part overrides survive layout files, clamp rotations and cannot change source placements or unrelated parts',()=>{
  const source=structuredClone(stage),space=stageSpace(stage,{}, {installed:{arm:{rotation:120.5},unknown:{rotation:12}},other:{arm:{rotation:20}}})
  const file=pinProject(projectFile('Plan',space,[]),space,[]),resolved=resolveProject(file,[],[])
  assert.deepEqual(resolved.space.fixedEquipmentControls,{installed:{arm:{rotation:90}}})
  assert.equal(resolved.space.fixedEquipment[0].controls.arm.rotation,90)
  assert.equal(resolved.space.fixedEquipment[0].rotation,20)
  assert.equal(resolved.space.fixedEquipment[0].xMeters,2)
  assert.deepEqual(stage,source)
  const effective=applyFixedEquipmentControls(stage,resolved.space.fixedEquipmentControls)
  effective.fixedEquipment[0].shapes[0].id='changed'
  assert.equal(stage.fixedEquipment[0].shapes[0].id,'body')
})
