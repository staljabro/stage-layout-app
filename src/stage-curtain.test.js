import test from 'node:test'
import assert from 'node:assert/strict'
import {CURTAIN_AMPLITUDE,CURTAIN_WAVELENGTH,curtainPoints,normaliseCurtain,resizeCurtain,stageLineBounds,stageLineAssets,curtainCollisionLine,curtainCollisionLines} from './stage-curtain.js'
import {collisionPolygons,polygonsIntersect} from './geometry.js'
import {dragPlacement} from './layout-tools.js'
import {assetSnapshot,pinProject} from './project-snapshots.js'
import {stageSpace} from './project-file.js'

test('curtain folds stay 10 cm peak to trough with fixed spacing as length changes',()=>{
  const short=curtainPoints({length:1}),long=curtainPoints({length:2.17})
  assert.equal(Math.max(...long.map(point=>point.y))-Math.min(...long.map(point=>point.y)),.1)
  assert.deepEqual(long.slice(0,short.length),short,'length changes only trim or append the wave')
  assert.equal(long.at(-1).x,2.17,'partial folds end at the requested line length')
  assert.ok(Math.abs(long.at(-1).y-CURTAIN_AMPLITUDE*Math.sin(2.17*2*Math.PI/CURTAIN_WAVELENGTH))<1e-12)
  assert.equal(curtainPoints({length:.01}).at(-1).x,.01)
})
test('curtain endpoint drags keep the other endpoint fixed and use whole degrees',()=>{
  const line=normaliseCurtain({id:'c',x:2,y:3,length:4,rotation:90})
  const end=resizeCurtain(line,'end',{x:4,y:4.02})
  assert.equal(end.x,2);assert.equal(end.y,3);assert.equal(end.rotation,27)
  const start=resizeCurtain(line,'start',{x:1,y:4})
  const angle=start.rotation*Math.PI/180
  assert.ok(Math.abs(start.x+start.length*Math.cos(angle)-2)<1e-12)
  assert.ok(Math.abs(start.y+start.length*Math.sin(angle)-7)<1e-12)
  assert.equal(start.rotation,Math.round(start.rotation))
  assert.equal(resizeCurtain(line,'end',{x:2,y:3}).length,.01)
})
test('curtain bounds include rotated wave height and physical line thickness',()=>{
  assert.equal(normaliseCurtain().thickness,.02)
  assert.equal(normaliseCurtain({thickness:.0156}).thickness,.016)
  const line=normaliseCurtain({x:2,y:3,length:4,rotation:90,thickness:.02})
  const bounds=stageLineBounds(line)
  assert.ok(Math.abs(bounds.x-1.94)<1e-12);assert.ok(Math.abs(bounds.right-2.06)<1e-12)
  assert.equal(bounds.y,3);assert.equal(bounds.bottom,7)
  const safe=normaliseCurtain({length:Infinity,opacity:2,rotation:25.8,color:'url(bad)',thickness:-1})
  assert.equal(safe.length,4);assert.equal(safe.opacity,1);assert.equal(safe.rotation,26);assert.equal(safe.thickness,.001);assert.equal(safe.color,'#000000')
})
test('curtain collision follows the centre line and equipment slides along it',()=>{
  const curtain=normaliseCurtain({id:'c',x:2,y:2,length:4})
  assert.deepEqual(curtainCollisionLine(curtain),[{x:2,y:2},{x:6,y:2}])
  const item={widthMeters:.5,depthMeters:.5,xMeters:3,yMeters:1},line=curtainCollisionLine(curtain)
  const valid=items=>items.every(item=>!collisionPolygons(item).some(polygon=>polygonsIntersect(polygon,line)))
  assert.equal(valid([{...item,yMeters:2}]),false)
  assert.equal(valid([{...item,yMeters:1.74}]),true)
  assert.equal(valid([{...item,xMeters:1,yMeters:2}]),true,'the line ends do not extend the obstacle')
  assert.equal(valid([{...item,widthMeters:8,yMeters:2}]),false,'line entirely inside the footprint still collides')
  const result=dragPlacement([item],1,1,valid,[{x:1,y:0}])[0]
  assert.ok(result.yMeters<=1.75001);assert.ok(result.xMeters>3.9,'sliding is preserved at contact')
  const rotated=curtainCollisionLine({...curtain,rotation:90})
  assert.ok(Math.abs(rotated[1].x-2)<1e-12);assert.equal(rotated[1].y,6)
  assert.equal(curtainCollisionLines({curtains:[{...curtain,visible:false}]}).length,0)
  assert.equal(curtain.collisionEnabled,true,'curtains collide by default')
  assert.equal(curtainCollisionLines({curtains:[{...curtain,collisionEnabled:false}]}).length,0,'disabling collision leaves the visible curtain out of obstacles')
  assert.equal(curtainCollisionLines({curtains:[{...curtain,editorGroupVisible:false}]}).length,0)
  assert.equal(curtainCollisionLines({curtains:[curtain],layerFolders:[{assetIds:['c'],visible:false}]}).length,0)
})
test('curtains remain stage artwork in snapshots and pinned layouts without editor data',()=>{
  const curtain=normaliseCurtain({id:'c',name:'Back curtain',x:1,y:2,length:6,editorGroupId:'g',visible:false})
  const stage={id:'stage',label:'Stage',dimensions:{widthMeters:10,depthMeters:8},boundary:{nodes:[]},curtains:[curtain],editor:{dimensionLines:[{id:'dimension'}]}}
  assert.equal(stageLineAssets(stage).length,2)
  const snapshot=assetSnapshot(stage)
  assert.equal(snapshot.editor,undefined);assert.deepEqual(snapshot.curtains,[curtain])
  const pinned=pinProject({},stageSpace(snapshot),[])
  assert.deepEqual(pinned.assetSnapshots.stage.curtains,[curtain])
  assert.deepEqual(stageLineAssets(snapshot),[curtain])
})
