import test from 'node:test'
import assert from 'node:assert/strict'
import {slidePlacement,dragPlacement,equipmentRotationHandle} from './layout-tools.js'
import {normaliseLayerCollision} from './editor/equipment-session.js'
import {isItemInsideSpace,itemsCollide} from './geometry.js'
import {customTextItem,customStagingItem} from './custom-items.js'
import {equipmentVisible,stageAssetVisible} from './layer-visibility.js'
import {projectFile,resolveProject} from './project-file.js'
import {wholeDegreesWithin} from './rotation-angle.js'
import {fixedEquipmentSnapshot} from './stage-equipment.js'
const item={id:1,xMeters:2,yMeters:2,widthMeters:1,depthMeters:1,collisionShapes:[{type:'rect',x:0,y:0,width:1,height:1}]}
test('blocked movement reaches contact and continues parallel to walls, preserving group spacing',()=>{
  const boundary=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],valid=items=>items.every(item=>isItemInsideSpace(item,boundary))
  const contact=slidePlacement([item],-4,1,valid)
  assert.ok(Math.abs(contact[0].xMeters-.5)<.001)
  assert.ok(Math.abs(contact[0].yMeters-3)<.001)
  const parallel=slidePlacement(contact,-2,2,valid)
  assert.ok(Math.abs(parallel[0].xMeters-.5)<.001)
  assert.ok(Math.abs(parallel[0].yMeters-5)<.001)
  const grouped=[item,{...item,id:2,xMeters:4}],moved=slidePlacement(grouped,-4,2,valid)
  assert.equal(moved[1].xMeters-moved[0].xMeters,2)
  assert.equal(moved[1].yMeters-moved[0].yMeters,0)
})
test('swept movement does not jump through equipment and can slide along a diagonal obstacle',()=>{
  const wall={...item,id:2,xMeters:4,yMeters:5,widthMeters:.1,depthMeters:10,collisionShapes:[{type:'rect',x:0,y:0,width:.1,height:10}]}
  const moved=slidePlacement([item],5,1,items=>items.every(candidate=>!itemsCollide(candidate,wall)))
  assert.ok(moved[0].xMeters<3.46)
  assert.ok(Math.abs(moved[0].yMeters-3)<.001)
  const diagonal=slidePlacement([{...item,xMeters:1,yMeters:3}],4,0,items=>items.every(candidate=>candidate.xMeters<=candidate.yMeters),[{x:1,y:1}])
  assert.ok(diagonal[0].xMeters>3.5&&diagonal[0].yMeters>3.5)
  assert.ok(diagonal[0].xMeters<=diagonal[0].yMeters+.001)
})
test('annotations fit all lines and deck style, container overrides and labels survive a layout save',()=>{
  const small=customTextItem({text:'Short'}),large=customTextItem({text:'A much longer text annotation\nAnother line',fontSize:.4})
  assert.ok(large.widthMeters>small.widthMeters*2)
  assert.ok(large.depthMeters>small.depthMeters*2)
  const deck=customStagingItem({id:10,xMeters:2,yMeters:3,heightMm:500,showHeight:false,textOpacity:.25,fillOpacity:.4,lineOpacity:.6,labelOffset:0,equipmentGroup:{id:'g',name:'Group',visible:false,collapsed:true},equipmentFolder:{id:'f',name:'Folder',visible:true,collapsed:false},visible:true})
  assert.equal(deck.label,'Stage deck')
  const restored=resolveProject(projectFile('Deck',null,[deck]),[],[]).items[0]
  for(const key of ['showHeight','textOpacity','fillOpacity','lineOpacity','labelOffset','equipmentGroup','equipmentFolder'])assert.deepEqual(restored[key],deck[key])
  assert.equal(equipmentVisible(restored),false)
  assert.equal(restored.visible,true)
  assert.equal(equipmentVisible({...restored,equipmentGroup:{...restored.equipmentGroup,visible:true}}),true)
  assert.equal(stageAssetVisible({id:'zone',visible:true},[{assetIds:['zone'],visible:false}]),false)
})

test('rotation handles follow item orientation and share a stable pivot across a group rotation',()=>{
  for(const [rotation,dx,dy] of [[0,0,-1],[90,1,0],[180,0,1],[270,-1,0]]){
    const geometry=equipmentRotationHandle([{...item,rotation}],.01)
    assert.ok(Math.abs(geometry.pivot.x-item.xMeters)<1e-8)
    assert.ok(Math.abs(geometry.pivot.y-item.yMeters)<1e-8)
    assert.ok(Math.abs(geometry.handle.x-item.xMeters-dx*.72)<1e-8)
    assert.ok(Math.abs(geometry.handle.y-item.yMeters-dy*.72)<1e-8)
  }
  const group=[{...item,xMeters:1},{...item,id:2,xMeters:4,widthMeters:2}],before=equipmentRotationHandle(group)
  const turned=group.map(item=>({...item,xMeters:before.pivot.x-(item.yMeters-before.pivot.y),yMeters:before.pivot.y+item.xMeters-before.pivot.x,rotation:90}))
  const after=equipmentRotationHandle(turned)
  assert.ok(Math.abs(after.pivot.x-before.pivot.x)<1e-8)
  assert.ok(Math.abs(after.pivot.y-before.pivot.y)<1e-8)
})

test('dragging catches up to a clear pointer destination after collision contact',()=>{
  const wall={...item,xMeters:4,yMeters:5,widthMeters:.1,depthMeters:4,collisionShapes:[{type:'rect',x:0,y:0,width:.1,height:4}]}
  const valid=items=>items.every(candidate=>!itemsCollide(candidate,wall))
  const contact=dragPlacement([{...item,xMeters:2,yMeters:5}],2,0,valid)
  assert.ok(contact[0].xMeters<3.46)
  const recovered=dragPlacement(contact,6-contact[0].xMeters,0,valid)
  assert.equal(recovered[0].xMeters,6)
  const group=dragPlacement([{...item,xMeters:3,yMeters:5},{...item,id:2,xMeters:2,yMeters:5}],3,0,valid)
  assert.equal(group[0].xMeters,6)
  assert.equal(group[0].xMeters-group[1].xMeters,1)
})

test('unspecified artwork collision defaults off while explicit and dedicated collision layers remain on',()=>{
  const normal=normaliseLayerCollision({type:'compound',children:[{type:'rect'},{type:'rect',collision:true},{type:'vector',collisionOnly:true}]})
  assert.equal(normal.collision,false)
  assert.deepEqual(normal.children.map(layer=>layer.collision),[false,true,true])
})

test('rotation values persist in whole degrees for equipment, artwork and adjustable parts',()=>{
  const asset={id:'stand',dimensions:{widthMeters:1,depthMeters:1},shapes:[],rotationParts:[{id:'boom'}]}
  const file=projectFile('Whole rotations',null,[{...asset,...item,assetId:asset.id,rotation:12.6,controls:{boom:{rotation:29.7}}}])
  assert.equal(file.items[0].rotation,13)
  const reopened=resolveProject(file,[asset],[]).items[0]
  assert.equal(reopened.controls.boom.rotation,30)
  assert.equal(fixedEquipmentSnapshot({...item,rotation:45.6},'fixed').rotation,46)
  assert.equal(normaliseLayerCollision({type:'rect',rotation:22.4}).rotation,22)
  assert.equal(wholeDegreesWithin(19.8,-10,10),10)
  assert.equal(wholeDegreesWithin(1.2,1.2,17.8),2)
})
