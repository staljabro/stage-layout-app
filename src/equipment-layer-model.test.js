import test from 'node:test'
import assert from 'node:assert/strict'
import {equipmentFolders,syncEquipmentFolders,moveEquipmentLayers} from './equipment-layer-model.js'
import {projectFile,resolveProject} from './project-file.js'
const asset={id:'chair',label:'Chair',dimensions:{widthMeters:1,depthMeters:1},shapes:[],collisionShapes:[]}
const items=[1,2,3].map(id=>({...asset,id,assetId:asset.id,xMeters:id,yMeters:1,widthMeters:1,depthMeters:1}))
test('empty folders survive a save and dragging layers changes stacking and folder membership',()=>{
  const folders=[{id:'f',name:'Untitled folder',visible:true,collapsed:false,itemIds:[]}]
  const saved=projectFile('Empty folder',null,items,'',{},folders),opened=resolveProject(saved,[asset],[])
  assert.deepEqual(opened.layerFolders,folders)
  const reordered=moveEquipmentLayers(items,folders,{kind:'item',id:1},{kind:'item',id:3,edge:'above'})
  assert.deepEqual(reordered.items.map(item=>item.id),[2,3,1])
  const inserted=moveEquipmentLayers(reordered.items,folders,{kind:'item',id:1},{kind:'folder',id:'f'})
  assert.deepEqual(inserted.folders[0].itemIds,[1])
  assert.equal(inserted.items.find(item=>item.id===1).equipmentFolder.id,'f')
  const outside=moveEquipmentLayers(inserted.items,inserted.folders,{kind:'item',id:1},{kind:'outside'})
  assert.deepEqual(outside.folders[0].itemIds,[])
  assert.equal(outside.items.find(item=>item.id===1).equipmentFolder,null)
})
test('folder metadata stays independent of individual visibility and folder blocks move intact',()=>{
  const folders=[{id:'one',name:'One',visible:false,itemIds:[1,2]},{id:'two',name:'Two',visible:true,itemIds:[3]}]
  const hydrated=syncEquipmentFolders(items.map(item=>({...item,visible:item.id!==2})),folders)
  assert.equal(hydrated[0].visible,true)
  assert.equal(hydrated[1].visible,false)
  const moved=moveEquipmentLayers(hydrated,folders,{kind:'folder',id:'one'},{kind:'folder',id:'two',edge:'above'})
  assert.deepEqual(moved.items.map(item=>item.id),[3,1,2])
  assert.deepEqual(moved.folders[0].itemIds,[1,2])
  const overItem=moveEquipmentLayers(hydrated,folders,{kind:'folder',id:'one'},{kind:'item',id:3,edge:'above'})
  assert.deepEqual(overItem.folders[0].itemIds,[1,2])
  assert.equal(overItem.items.find(item=>item.id===1).equipmentFolder.id,'one')
  const list=equipmentFolders(moved.items,moved.folders)
  assert.equal(list[0].visible,false)
})
