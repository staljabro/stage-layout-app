import test from 'node:test'
import assert from 'node:assert/strict'
import { layerRows, moveFolderBlock, putItemInFolder, putItemsInFolder } from './layer-folders.js'

const items=[1,2,3,4].map(id=>({id}))
test('folder rows replace their children and can collapse independently',()=>{
  const folders=[{id:'a',itemIds:[2,3],collapsed:true}]
  const rows=layerRows(items,folders)
  assert.deepEqual(rows.map(row=>row.type==='item'?row.item.id:row.folder.id),[4,'a',1])
  assert.deepEqual(rows[1].items.map(item=>item.id),[3,2])
})
test('dropping a layer into a folder makes its members a contiguous block',()=>{
  const result=putItemInFolder(items,[{id:'a',itemIds:[2,3]}],4,'a')
  assert.deepEqual(result.items.map(item=>item.id),[1,2,3,4])
  assert.deepEqual(result.folders[0].itemIds,[2,3,4])
})
test('dropping selected layers into a folder moves the selection as one block',()=>{
  const result=putItemsInFolder(items,[{id:'a',itemIds:[2]}],[1,4],'a')
  assert.deepEqual(result.items.map(item=>item.id),[2,1,4,3])
  assert.deepEqual(result.folders[0].itemIds,[2,1,4])
})
test('folders move through the stack as one block',()=>{
  const moved=moveFolderBlock(items,[{id:'a',itemIds:[2,3]}],'a',1)
  assert.deepEqual(moved.map(item=>item.id),[2,3,1,4])
})
