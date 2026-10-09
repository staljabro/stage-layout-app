import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateStock, equipmentRows, equipmentCsv, stockQuantity } from './inventory.js'
import { projectFile, resolveProject } from './project-file.js'

test('equipment list distinguishes custom deck sizes and excludes annotations',()=>{
  const rows=equipmentRows([
    {id:1,customType:'text',label:'Title'},
    {id:2,customType:'staging',label:'Deck',widthMeters:2,depthMeters:1,heightMm:200},
    {id:3,customType:'staging',label:'Deck',widthMeters:3,depthMeters:1,heightMm:200},
  ],[])
  assert.equal(rows.length,2)
  assert.equal(rows[0].source,'Custom staging')
  assert.notEqual(rows[0].name,rows[1].name)
  assert.equal(rows.reduce((sum,row)=>sum+row.quantity,0),2)
})

const asset={id:'chair',label:'Chair',stockQuantity:2,dimensions:{widthMeters:1,depthMeters:1},shapes:[],collisionShapes:[]}
const item=id=>({id,assetId:'chair',label:'Renamed placement',xMeters:id,yMeters:1})

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
