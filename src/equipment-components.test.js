import test from 'node:test'
import assert from 'node:assert/strict'
import {normaliseComponents,componentState,enabledComponents} from './equipment-components.js'
import {equipmentRows,equipmentCsv} from './inventory.js'
import {projectFile,resolveProject} from './project-file.js'

const components=[{id:'mic',label:'Cello mic'},{id:'stand',label:'Mic stand'}]
const asset={id:'cello',label:'Cello',components,dimensions:{widthMeters:1,depthMeters:.5},shapes:[],collisionShapes:[]}

test('component definitions keep stable ids and placement notes are filtered',()=>{
  assert.deepEqual(normaliseComponents(['Cable',{id:'mic',label:' Cello mic '}]),[{id:'component-1',label:'Cable',category:'General',quantity:1,x:0,y:0,zOrder:0},{id:'mic',label:'Cello mic',category:'General',quantity:1,x:0,y:0,zOrder:1}])
  const state=componentState(components,{mic:{enabled:true,note:'DPA4099'},stand:{enabled:false,note:'ignore'},old:{enabled:true}})
  assert.deepEqual(state,{mic:{enabled:true,note:'DPA4099'},stand:{enabled:false,note:'ignore'}})
  assert.deepEqual(enabledComponents({...asset,componentState:state}),[{id:'mic',label:'Cello mic',category:'General',quantity:1,x:0,y:0,zOrder:0,note:'DPA4099'}])
})

test('equipment references retain stock category, quantity and artwork placement',()=>{
  const chair={id:'chair',label:'Orchestra chair',dimensions:{widthMeters:.5,depthMeters:.5},shapes:[]}
  const [component]=normaliseComponents([{id:'seat',label:'Old chair',assetId:'chair',category:'Furniture',quantity:2,equipment:chair}])
  assert.deepEqual(component,{id:'seat',label:'Old chair',assetId:'chair',category:'Furniture',quantity:2,x:0,y:0,zOrder:0,equipment:chair})
  const rows=equipmentRows([{...asset,id:1,assetId:'cello',componentState:{seat:{enabled:true}},components:[component]}],[asset,{...chair,stockQuantity:1}])
  assert.deepEqual(rows.find(row=>row.assetId==='chair'),{key:'component:'+JSON.stringify(['Furniture','chair','','venue']),kind:'component',assetId:'chair',category:'Furniture',name:'Orchestra chair',note:'',source:'External',quantity:2})
})

test('equipment reports put enabled components beneath their parent item',()=>{
  const placements=[{...asset,id:1,assetId:'cello',componentState:{mic:{enabled:true,note:'DPA4099'},stand:{enabled:false}}},{...asset,id:2,assetId:'cello',componentState:{mic:{enabled:true,note:'DPA4099'},stand:{enabled:true}}}]
  const rows=equipmentRows(placements,[asset],undefined,false)
  assert.deepEqual(rows.map(row=>[row.kind||'equipment',row.name,row.note||'',row.quantity]),[['equipment','Cello','',2],['component','Cello mic','DPA4099',2],['component','Mic stand','',1]])
  assert.match(equipmentCsv(rows,false),/" {2}Cello mic — DPA4099","2"/)
})

test('component reports opt base items in individually and group fixed-stage components',()=>{
  const opted={...asset,showAsComponent:true}
  const rows=equipmentRows([{...opted,id:1,assetId:'cello'}],[opted],undefined,false,false,[{...asset,id:'fixed-1'}])
  assert.equal(rows.find(row=>row.kind!=='component')?.showAsComponent,true)
  assert.deepEqual(rows.filter(row=>row.kind==='component'&&row.category==='Stage Equipment').map(row=>row.name),['Cello mic','Mic stand'])
})

test('component choices and notes survive project save and reopen',()=>{
  const placement={...asset,id:7,assetId:'cello',xMeters:1,yMeters:2,rotation:0,componentState:{mic:{enabled:true,note:'DPA4099'},stand:{enabled:false},old:{enabled:true}}}
  const file=projectFile('Cello plot',null,[placement])
  assert.deepEqual(file.items[0].componentState,{mic:{enabled:true,note:'DPA4099'},stand:{enabled:false}})
  const restored=resolveProject(file,[asset],[])
  assert.deepEqual(restored.items[0].componentState,{mic:{enabled:true,note:'DPA4099'},stand:{enabled:false}})
})

test('components are enabled by default and explicit opt-outs keep their notes',()=>{
  assert.deepEqual(componentState(components),{mic:{enabled:true},stand:{enabled:true}})
  assert.deepEqual(enabledComponents(asset).map(component=>component.id),['mic','stand'])
  const placement={...asset,id:8,assetId:'cello',xMeters:1,yMeters:2,componentState:{mic:{enabled:false,note:'Not needed'}}}
  const restored=resolveProject(projectFile('Plot',null,[placement]),[asset],[]).items[0]
  assert.deepEqual(restored.componentState,{mic:{enabled:false,note:'Not needed'},stand:{enabled:true}})
})
