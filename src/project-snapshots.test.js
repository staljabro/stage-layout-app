import test from 'node:test'
import assert from 'node:assert/strict'
import {pinProject} from './project-snapshots.js'
import {projectFile,resolveProject,stageSpace} from './project-file.js'

const stage={id:'private-stage',label:'Show stage',revision:2,dimensions:{widthMeters:10,depthMeters:5},boundary:{nodes:[{x:0,y:0},{x:10,y:0},{x:0,y:5}]},collisionBoundary:[],shareToken:'secret',editor:{notes:'private'}}
const asset={id:'chair',label:'Chair',revision:3,dimensions:{widthMeters:1,depthMeters:1},shapes:[{type:'rect',width:1,height:1}],collisionShapes:[],editor:{notes:'private'}}
const item={...asset,id:100,assetId:'chair',xMeters:2,yMeters:2,widthMeters:1,depthMeters:1}

test('project snapshots preserve geometry and revisions without sharing Studio data or access tokens',()=>{
  const space=stageSpace(stage)
  const file=pinProject(projectFile('Show',space,[item]),space,[item])
  assert.equal(file.assetSnapshots.stage.revision,2)
  assert.equal(file.assetSnapshots.equipment[0].revision,3)
  const json=JSON.stringify(file)
  assert.ok(!json.includes('secret'))
  assert.ok(!json.includes('editor'))
  const updated={...asset,dimensions:{widthMeters:4,depthMeters:4}}
  const restored=resolveProject(file,[updated],[])
  assert.equal(restored.items[0].widthMeters,1)
  assert.equal(restored.space.stageId,stage.id)
  assert.equal(restored.space.width,10)
  const withoutLibrary=resolveProject(file,[],[])
  assert.equal(withoutLibrary.items.length,1)
  assert.equal(withoutLibrary.space.stageId,stage.id)
})

test('stage-locked links use the designated stage rather than an imported stage snapshot',()=>{
  const space=stageSpace(stage),file=pinProject(projectFile('Show',space,[item]),space,[item])
  file.assetSnapshots.stage.dimensions={widthMeters:999,depthMeters:999}
  assert.equal(resolveProject(file,[asset],[stage],stage.id).space.width,10)
  assert.throws(()=>resolveProject(file,[asset],[stage],'another-stage'),/designated stage/)
})
