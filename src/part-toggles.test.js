import test from 'node:test'
import assert from 'node:assert/strict'
import { toggleableParts, sharedParts, partState, setPart } from './part-toggles.js'

test('named toggles match across assets and update every matching layer', () => {
  const first = {assetId:'a', shapes:[{id:'a1',name:'Seat',toggleable:true},{id:'a2',name:'Seat',toggleable:true},{id:'fixed',name:'Seat'}],partVisibility:{a1:false,a2:true}}
  const second = {assetId:'b', shapes:[{id:'b1',name:'Seat',toggleable:true},{id:'b2',name:'Back',toggleable:true}]}
  assert.deepEqual(sharedParts([first,second]).map(part=>part.name), ['Seat'])
  assert.equal(partState([first,second],'Seat'),'mixed')
  const updated = [first,second].map(item=>setPart(item,'Seat',false))
  assert.equal(partState(updated,'Seat'),false)
  assert.deepEqual(updated[0].partVisibility,{a1:false,a2:false})
  assert.deepEqual(updated[1].partVisibility,{b1:false})
  assert.equal(first.partVisibility.a2,true)
})

test('group artwork has one toggle while unrelated parts remain separate', () => {
  const item={shapes:[{id:'1',name:'Left',toggleable:true,toggleName:'Wheels'},{id:'2',name:'Right',toggleable:true,toggleName:'Wheels'},{id:'3',name:'Handle',toggleable:true}]}
  assert.deepEqual(toggleableParts(item),[{name:'Wheels',ids:['1','2']},{name:'Handle',ids:['3']}])
  assert.deepEqual(setPart(item,'Wheels',false).partVisibility,{'1':false,'2':false})
  assert.deepEqual(sharedParts([item,{shapes:[]}]),[])
  assert.deepEqual(sharedParts([]),[])
})
