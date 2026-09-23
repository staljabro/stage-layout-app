import test from 'node:test'
import assert from 'node:assert/strict'
import { insertAtDefaultLayer } from './layer-order.js'

const existing=[{id:1,label:'Chair'},{id:2,label:'Music stand'}]
const groups=[{id:'decking',label:'Staging'},{id:'chairs',label:'Seating'}]

test('staging equipment is inserted behind the existing layer stack',()=>{
  assert.deepEqual(insertAtDefaultLayer(existing,{id:3,groupId:'decking'},groups).map(item=>item.id),[3,1,2])
  assert.deepEqual(insertAtDefaultLayer(existing,{id:3,groupId:'staging'},[]).map(item=>item.id),[3,1,2])
})

test('other equipment remains at the front of the layer stack',()=>{
  assert.deepEqual(insertAtDefaultLayer(existing,{id:3,groupId:'chairs'},groups).map(item=>item.id),[1,2,3])
})
