import test from 'node:test'
import assert from 'node:assert/strict'
import {validateLayout} from './layout-validation.js'

const item=(id,x,y,extra={})=>({id,xMeters:x,yMeters:y,widthMeters:1,depthMeters:1,rotation:0,shapes:[],collisionShapes:[{type:'rect',x:0,y:0,width:1,height:1}],...extra})
const stage={boundary:{nodes:[{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}]},fixedEquipment:[item('fixed',2,2,{editable:true})]}

test('layout validation reports boundaries, collisions and deliberate stage overrides',()=>{
  const issues=validateLayout({stage,items:[item(1,2,2),item(2,6.2,2)],fixedControls:{fixed:{$placement:{xMeters:2.1,yMeters:2}}},partVisibility:{curtain:false}})
  assert.deepEqual(issues.map(issue=>[issue.code,issue.count]),[['outside-stage',1],['equipment-collision',1],['moved-stage-assets',1],['hidden-stage-parts',1]])
})

test('layout validation ignores hidden equipment, separate roof layers and collision opt-outs',()=>{
  const issues=validateLayout({stage:{...stage,fixedEquipment:[item('fixed',2,2,{visible:false})]},items:[item(1,2,2,{collisionEnabled:false}),item(2,2,2,{layerStack:'roof'})]})
  assert.deepEqual(issues,[])
})

test('layout validation reports outdated stages and automatic stock shortfalls',()=>{
  const asset={id:'speaker',label:'Speaker',stockQuantity:1}
  const installed=item('installed',1,1,{assetId:'speaker'})
  const placement=item(10,4,2,{assetId:'speaker',supplyOverride:'auto'})
  const issues=validateLayout({stage:{...stage,fixedEquipment:[installed]},items:[placement],library:[asset],organisationId:'org',stageVersion:2,latestStageVersion:4})
  assert.deepEqual(issues.map(issue=>[issue.code,issue.count]),[['outdated-stage',2],['stock-shortfall',1]])
})
