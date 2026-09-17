import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFile, resolveProject, stageSpace } from './project-file.js';
const stage={id:'pit',label:'Orchestra Pit',dimensions:{widthMeters:10,depthMeters:5},boundary:{nodes:[{x:0,y:0},{x:10,y:0},{x:0,y:5}]},zones:[]};
const asset={id:'chair',label:'Chair',dimensions:{widthMeters:.5,depthMeters:.6},shapes:[{type:'rect',fill:'#ffffff'}],collisionShapes:[]};
const placement={...asset,id:123,type:'library:chair',assetId:'chair',xMeters:2,yMeters:3,rotation:35,label:'First violin',showLabel:true};
test('downloads contain references and placement data, never equipment or stage artwork',()=>{
  const file=projectFile('Concert',stageSpace(stage),[placement]);
  assert.deepEqual(file.stage,{kind:'library',id:'pit'});
  assert.equal(file.items[0].assetId,'chair');
  assert.equal(file.items[0].xMeters,2);
  const json=JSON.stringify(file);
  for(const property of ['shapes','collisionShapes','boundary','zones','dimensions'])assert.ok(!json.includes('"'+property+'"'));
});
test('opening uses current library geometry and drops missing equipment',()=>{
  const file=projectFile('Concert',stageSpace(stage),[placement,{...placement,id:124,assetId:'missing'}]);
  const updated={...asset,dimensions:{widthMeters:.7,depthMeters:.8},shapes:[{type:'ellipse',fill:'#000000'}]};
  const result=resolveProject(file,[updated],[{...stage,dimensions:{widthMeters:12,depthMeters:7}}]);
  assert.equal(result.items.length,1);assert.equal(result.dropped,1);
  assert.equal(result.items[0].widthMeters,.7);assert.deepEqual(result.items[0].shapes,updated.shapes);
  assert.equal(result.items[0].label,'First violin');assert.equal(result.items[0].rotation,35);
  assert.equal(result.space.width,12);
});
test('locked links reject other stages and custom rectangles',()=>{
  const file=projectFile('Concert',stageSpace(stage),[placement]);
  assert.equal(resolveProject(file,[asset],[stage],'pit').space.stageId,'pit');
  assert.throws(()=>resolveProject(file,[asset],[stage],'different'),/designated stage/);
  assert.throws(()=>resolveProject({...file,stage:{kind:'rectangle',width:10,depth:5}},[asset],[stage],'pit'),/designated stage/);
});
test('renaming library assets preserves saved references and stage-locked links',()=>{
  const file=projectFile('Concert',stageSpace(stage),[placement]);
  const result=resolveProject(file,[{...asset,label:'Orchestra chair'}],[{...stage,label:'Main pit'}],stage.id);
  assert.equal(result.space.stageId,stage.id);
  assert.equal(result.space.name,'Main pit');
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].assetId,asset.id);
});
test('missing stages and blank projects request stage selection without using stale geometry',()=>{
  const file=projectFile('Concert',stageSpace(stage),[placement]);
  const missing=resolveProject(file,[asset],[]);
  assert.equal(missing.space,null);assert.equal(missing.missingStage,true);
  const blank=resolveProject(projectFile('New',null,[]),[asset],[stage]);
  assert.equal(blank.space,null);assert.deepEqual(blank.items,[]);
});
test('legacy equipment and stage references resolve to current assets',()=>{
  const file={version:1,project:'Old',space:{name:stage.label,width:9,depth:4,boundary:stage.boundary},items:[{...placement,assetId:undefined,shapes:[{type:'obsolete'}]}]};
  const result=resolveProject(file,[asset],[stage],'pit');
  assert.equal(result.space.stageId,'pit');assert.deepEqual(result.items[0].shapes,asset.shapes);
});
