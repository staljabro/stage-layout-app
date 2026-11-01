import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateStock, equipmentRows, equipmentCsv, stockQuantity,assignEquipmentSources } from './inventory.js'
import { projectFile, resolveProject } from './project-file.js'

test('equipment list distinguishes custom deck sizes and excludes annotations',()=>{
  const rows=equipmentRows([
    {id:1,customType:'text',label:'Title'},
    {id:2,customType:'staging',label:'Deck',widthMeters:2,depthMeters:1,heightMm:200},
    {id:3,customType:'staging',label:'Deck',widthMeters:3,depthMeters:1,heightMm:200},
  ],[])
  assert.equal(rows.length,2)
  assert.equal(rows[0].source,'Stage deck')
  assert.notEqual(rows[0].name,rows[1].name)
  assert.equal(rows.reduce((sum,row)=>sum+row.quantity,0),2)
})

test('installed and locked equipment use stock first while blank, zero and positive quantities remain distinct',()=>{
  const library=[{id:'stand',stockQuantity:2},{id:'blank',stockQuantity:null},{id:'zero',stockQuantity:0}]
  const placements=[{id:1,assetId:'stand'},{id:2,assetId:'stand'},{id:3,assetId:'blank'},{id:4,assetId:'zero'}]
  const result=allocateStock(placements,library,true,[{id:'installed',assetId:'stand'}])
  assert.equal(result.external.has(1),false)
  assert.equal(result.external.has(2),true)
  assert.equal(result.external.has(3),false)
  assert.equal(result.external.has(4),true)
  assert.equal(result.remaining.get('blank'),null)
  assert.equal(result.remaining.get('zero'),0)
  const locked=allocateStock([{id:1,assetId:'stand'},{id:2,assetId:'stand'},{id:9,assetId:'stand',locked:true}],library)
  assert.equal(locked.external.has(9),false)
  assert.equal(locked.external.has(2),true)
})

test('automatic sourcing draws from venue quantities after installed equipment and preserves source overrides',()=>{
  const library=[{id:'stand',stockQuantity:3}],fixed=[{id:'installed',assetId:'stand'}]
  const items=[1,2,3].map(id=>({id,assetId:'stand',supply:'client'}))
  const defaults=assignEquipmentSources(items,library,true,fixed)
  assert.deepEqual(defaults.map(item=>item.supply),['venue','venue','client'])
  assert.ok(defaults.every(item=>item.supplyOverride==='auto'&&!item.useExternal))
  const override=assignEquipmentSources(defaults.map(item=>item.id===1?{...item,supplyOverride:'client'}:item),library,true,fixed)
  assert.deepEqual(override.map(item=>item.supply),['client','venue','venue'])
  assert.equal(override[0].useExternal,true)
  const restored=assignEquipmentSources(override.map(item=>item.id===1?{...item,supplyOverride:'auto'}:item),library,true,fixed)
  assert.deepEqual(restored.map(item=>item.supply),['venue','venue','client'])
  assert.equal(restored[0].useExternal,false)
})

const asset={id:'chair',label:'Chair',stockQuantity:2,dimensions:{widthMeters:1,depthMeters:1},shapes:[],collisionShapes:[]}
const item=id=>({id,assetId:'chair',label:'Renamed placement',xMeters:id,yMeters:1})

test('venue requirements split movable venue stock from client-supplied items',()=>{
  const placements=[{...item(1),supply:'venue'},{...item(2),supply:'venue'},{...item(3),supply:'client'},{id:4,customType:'text',label:'Annotation'}]
  const rows=equipmentRows(placements,[asset],allocateStock(placements,[asset],false),false,true)
  assert.deepEqual(rows.map(row=>[row.source,row.quantity]),[['Client supplied',1],['Venue',2]])
  const csv=equipmentCsv(rows,true)
  assert.ok(csv.includes('"Source"'))
  assert.ok(csv.includes('"Chair","Venue","2"'))
  assert.ok(csv.includes('"Chair","Client supplied","1"'))
})

test('External events ignore quantities and sourcing flags and export requirements only',()=>{
  const items=[item(1),{...item(2),useExternal:true},item(3)]
  const allocation=allocateStock(items,[asset],false)
  assert.equal(allocation.external.size,0)
  assert.equal(allocation.remaining.get('chair'),null)
  const rows=equipmentRows(items,[asset],allocation,false)
  assert.equal(rows.length,1)
  assert.equal(rows[0].quantity,3)
  assert.equal(rows[0].source,'')
  assert.equal(equipmentCsv(rows,false),'\uFEFF"Equipment","Quantity"\r\n"Chair","3"\r\n')
})

test('stock goes to oldest placements, independent of layer order or visibility',()=>{
  const items=[item(3),{...item(1),visible:false},item(2)]
  const allocation=allocateStock(items,[asset])
  assert.deepEqual([...allocation.external],[3])
  assert.equal(allocation.remaining.get('chair'),0)
  assert.deepEqual(equipmentRows(items,[asset]).map(({source,quantity,name})=>({source,quantity,name})),[{source:'External',quantity:1,name:'Chair'},{source:'Stock',quantity:2,name:'Chair'}])
})

test('external overrides and deletions free stock; overflow is reallocated',()=>{
  const items=[{...item(1),useExternal:true},item(2),item(3)]
  assert.deepEqual([...allocateStock(items,[asset]).external],[1])
  assert.equal(allocateStock([item(3)],[asset]).remaining.get('chair'),1)
  assert.deepEqual([...allocateStock(items,[{...asset,stockQuantity:0}]).external],[1,2,3])
})

test('blank quantities remain untracked and invalid quantities are ignored',()=>{
  for(const value of [null,undefined,-1,1.5,'2'])assert.equal(stockQuantity({stockQuantity:value}),null)
  assert.equal(stockQuantity({stockQuantity:0}),0)
  const allocation=allocateStock([item(1),item(2),item(3)],[{...asset,stockQuantity:null}])
  assert.equal(allocation.external.size,0)
  assert.equal(allocation.remaining.get('chair'),null)
})

test('external choice survives project saving and latest stock is used on reopen',()=>{
  const file=projectFile('Concert',null,[{...item(1),useExternal:true},item(2)])
  const restored=resolveProject(file,[{...asset,stockQuantity:1}],[])
  assert.equal(restored.items[0].useExternal,true)
  assert.equal(restored.items[1].useExternal,false)
  assert.deepEqual([...allocateStock(restored.items,[{...asset,stockQuantity:1}]).external],[1])
})

test('CSV quotes names, preserves rows, and neutralizes formula-like names',()=>{
  const csv=equipmentCsv([{name:'Chair, "large"\nblue',source:'Stock',quantity:2},{name:'=1+1',source:'External',quantity:1}])
  assert.ok(csv.startsWith('\uFEFF"Equipment","Source","Quantity"\r\n'))
  assert.ok(csv.includes('"Chair, ""large""\nblue","Stock","2"'))
  assert.ok(csv.includes('"\'=1+1","External","1"'))
})
