import test from 'node:test'
import assert from 'node:assert/strict'
import {sharedProperties,normalisePlacement} from './editor/selection-properties.js'
import {rectangularZoneNodes,boundaryBounds} from './editor/stage-zone.js'
import {customStagingItem,customTextItem} from './custom-items.js'

const field=(items,context,id)=>sharedProperties(items,context).find(field=>field.id===id)
test('artwork controls depend on compatibility, including mixed colours, dimensions and checkboxes',()=>{
  const items=[{id:1,type:'rect',width:1,fill:'#ff0000',toggleable:true},{id:2,type:'circle',width:2,fill:'#0000ff',toggleable:false}]
  for(const id of ['fill','width','toggleable'])assert.equal(field(items,'artwork',id).mixed,true)
  assert.equal(field(items,'artwork','fill').set(items[1],'#00ff00').fill,'#00ff00')
  assert.equal(field(items,'artwork','width').scale,100,'artwork is measured in metres and displayed in centimetres')
  assert.equal(field(items,'artwork','radius'),undefined,'type-specific controls require compatible items')
})
test('shared stage positioning moves complete curved geometry and rectangular resizing preserves its anchor',()=>{
  const items=[{id:'a',assetType:'zone',zoneShape:'rectangle',nodes:rectangularZoneNodes(1,2,2,4)},{id:'b',assetType:'zone',zoneShape:'rectangle',anchorMode:'centre',nodes:rectangularZoneNodes(4,4,6,8)}]
  const width=field(items,'stage','width');assert.equal(width.mixed,true)
  assert.equal(boundaryBounds(width.set(items[1],10).nodes).centreX,7)
  const curved={...items[0],nodes:[{x:1,y:2,curveMode:'line'},{x:3,y:2,curveMode:'bezier',cx:2,cy:1},{x:1,y:6,curveMode:'line'}]}
  const x=field([curved,items[1]],'stage','x'),changed=x.set(curved,x.values[0]+2)
  assert.equal(changed.nodes[1].x,5);assert.equal(changed.nodes[1].cx,4)
  assert.equal(field([{...items[0],assetType:'boundary'},items[1]],'stage','fill'),undefined)
})
test('mixed curtains share style and collision controls with per-item values preserved until edited',()=>{
  const items=[{id:'a',assetType:'line',type:'curtain',thickness:.01,collisionEnabled:true},{id:'b',assetType:'line',type:'curtain',thickness:.02,collisionEnabled:false}]
  assert.equal(field(items,'stage','thickness').mixed,true)
  assert.equal(field(items,'stage','thickness').step,.001)
  assert.equal(field(items,'stage','collision').mixed,true)
  assert.equal(field(items,'stage','collision').set(items[1],true).collisionEnabled,true)
})
test('shared dimensions respect each shape constraint and each background aspect lock',()=>{
  const shapes=[{id:1,type:'rect',width:1,height:2},{id:2,type:'circle',width:2,height:2},{id:3,type:'tripod',width:Math.sqrt(3),height:1.5}]
  const height=field(shapes,'artwork','height')
  assert.equal(height.set(shapes[0],3).width,1)
  assert.equal(height.set(shapes[1],3).width,3)
  assert.equal(height.set(shapes[2],3).width,2*Math.sqrt(3))
  const images=[{id:1,assetType:'image',width:4,height:2},{id:2,assetType:'image',width:4,height:4,lockAspect:false}]
  assert.equal(field(images,'stage','lockAspect').mixed,true)
  const width=field(images,'stage','width')
  assert.equal(width.set(images[0],8).height,4)
  assert.equal(width.set(images[1],8).height,4)
})
test('part controls show mixed when a named artwork group itself contains different visibility states',()=>{
  const items=[{id:1,shapes:[{id:'a',toggleable:true,toggleName:'Body'},{id:'b',toggleable:true,toggleName:'Body'}],partVisibility:{a:false}},{id:2,shapes:[{id:'c',toggleable:true,toggleName:'Body'}],partVisibility:{c:false}}]
  const body=field(items,'placement','part:Body')
  assert.equal(body.mixed,true)
  assert.deepEqual(body.set(items[0],true).partVisibility,{a:true,b:true})
})
test('placement controls match named parts and components using each equipment asset’s own identifiers',()=>{
  const items=['a','b'].map((id,index)=>({id,rotationParts:[{id:'arm-'+id,name:'Boom',minRotation:index?-30:-90,maxRotation:90}],controls:{['arm-'+id]:{rotation:index*10}},shapes:[{id:'body-'+id,toggleable:true,toggleName:'Body'}],partVisibility:{['body-'+id]:!index},components:[{id:'mic-'+id,label:'Cello mic'}],componentState:{['mic-'+id]:{enabled:!index,note:index?'DPA4099':''}}}))
  const angle=field(items,'placement','rotation-part:Boom');assert.equal(angle.min,-30);assert.equal(angle.mixed,true)
  assert.deepEqual(angle.set(items[1],25).controls,{'arm-b':{rotation:25}})
  const body=field(items,'placement','part:Body');assert.equal(body.mixed,true);assert.deepEqual(body.set(items[0],false).partVisibility,{'body-a':false})
  const mic=field(items,'placement','component:Cello mic:0');assert.equal(mic.mixed,true)
  assert.deepEqual(mic.set(items[1],true).componentState,{'mic-b':{enabled:true,note:'DPA4099'}})
  const note=field(items,'placement','component:Cello mic:0:note');assert.equal(note.mixed,true)
  assert.deepEqual(note.set(items[1],'SM57').componentState,{'mic-b':{enabled:false,note:'SM57'}})
})
test('multi-selected decks and text remeasure bounds and snapping when shared controls change',()=>{
  const decks=[customStagingItem({id:1,widthMeters:1}),customStagingItem({id:2,widthMeters:3})],width=field(decks,'placement','widthMeters')
  assert.equal(width.mixed,true)
  const deck=normalisePlacement(width.set(decks[0],4));assert.equal(deck.collisionShapes[0].width,4);assert.equal(deck.snapPoints.length,10)
  const texts=[customTextItem({id:1,text:'A'}),customTextItem({id:2,text:'Longer'})],body=field(texts,'placement','text')
  assert.equal(body.mixed,true)
  assert.ok(normalisePlacement(body.set(texts[0],'Much longer text')).widthMeters>texts[0].widthMeters)
  assert.equal(field([decks[0],texts[0]],'placement','widthMeters'),undefined)
  assert.ok(field([decks[0],texts[0]],'placement','rotation'))
})
