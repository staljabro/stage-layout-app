import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFile, resolveProject, stageSpace } from './project-file.js';
import { customStagingItem, customTextItem, stagingSnapPoints } from './custom-items.js';
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
test('collision movement preferences are saved and default on for older files',()=>{
  const disabled=projectFile('Concert',stageSpace(stage),[placement],'',{equipment:false,zone:false});
  assert.deepEqual(resolveProject(disabled,[asset],[stage]).collisionSettings,{equipment:false,zone:false,snapping:true});
  const legacy={...disabled};delete legacy.collisionSettings;
  assert.deepEqual(resolveProject(legacy,[asset],[stage]).collisionSettings,{equipment:true,zone:true,snapping:true});
});
test('per-placement collision overrides survive project files and default on',()=>{
  const file=projectFile('Concert',stageSpace(stage),[{...placement,collisionEnabled:false}]);
  assert.equal(file.items[0].collisionEnabled,false);
  assert.equal(resolveProject(file,[asset],[stage]).items[0].collisionEnabled,false);
  delete file.items[0].collisionEnabled;
  assert.equal(resolveProject(file,[asset],[stage]).items[0].collisionEnabled,true);
});
test('layer folders and visibility survive project files',()=>{
  const hidden={...placement,visible:false};
  const file=projectFile('Concert',stageSpace(stage),[hidden],'',{},[{id:'risers',name:'Risers',collapsed:true,visible:false,itemIds:[hidden.id]}]);
  const result=resolveProject(file,[asset],[stage]);
  assert.equal(result.items[0].visible,false);
  assert.deepEqual(result.layerFolders,[{id:'risers',name:'Risers',collapsed:true,visible:false,itemIds:[hidden.id]}]);
});
test('toggleable part visibility is saved per placement and filtered against current artwork',()=>{
  const configurable={...asset,shapes:[{id:'label',name:'Deck label',type:'text',toggleable:true},{id:'deck',name:'Deck',type:'rect'}]};
  const file=projectFile('Concert',stageSpace(stage),[{...placement,assetId:asset.id,partVisibility:{label:false,obsolete:false}}]);
  assert.deepEqual(file.items[0].partVisibility,{label:false,obsolete:false});
  const restored=resolveProject(file,[configurable],[stage]).items[0];
  assert.deepEqual(restored.partVisibility,{label:false});
});
test('adjustable part rotations survive project files and ignore removed controls',()=>{
  const articulated={...asset,rotationParts:[{id:'tray',name:'Tray',pivotX:.25,pivotY:.3,defaultRotation:0}]};
  const file=projectFile('Concert',stageSpace(stage),[{...placement,assetId:asset.id,controls:{tray:{rotation:42},obsolete:{rotation:90}}}]);
  assert.deepEqual(file.items[0].controls,{tray:{rotation:42},obsolete:{rotation:90}});
  const result=resolveProject(file,[articulated],[stage]);
  assert.deepEqual(result.items[0].controls,{tray:{rotation:42}});
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
test('project-created staging and text survive without library assets',()=>{
  const staging=customStagingItem({id:201,xMeters:3,yMeters:2,widthMeters:3.2,depthMeters:1.7,heightMm:400,showHeight:false,fill:'#123456',line:'#abcdef',textColor:'#ffffff'});
  const text=customTextItem({id:202,xMeters:5,yMeters:4,text:'Stage\nleft',fontSize:.25,bold:true,italic:true,fill:'#ff0000',widthMeters:.8,depthMeters:.5});
  const file=projectFile('Custom',stageSpace(stage),[staging,text]);
  assert.equal(file.items[0].assetId,undefined);assert.equal(file.items[0].custom.type,'staging');
  const result=resolveProject(file,[],[stage]);
  assert.equal(result.dropped,0);assert.equal(result.items.length,2);
  assert.equal(result.items[0].widthMeters,3);assert.equal(result.items[0].depthMeters,2);
  assert.equal(result.items[0].heightMm,400);assert.equal(result.items[0].showHeight,false);
  assert.equal(result.items[1].text,'Stage\nleft');assert.equal(result.items[1].bold,true);
});
test('custom staging creates snap points at every metre-grid intersection',()=>{
  assert.deepEqual(stagingSnapPoints(2,2),[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:0,y:2},{x:1,y:2},{x:2,y:2}]);
});
test('toggleable stage-part visibility is saved per project and filtered against the current stage',()=>{
  const configurable={...stage,zones:[{id:'warning',name:'Warning zone',toggleable:true,nodes:[]},{id:'fixed',name:'Fixed zone',nodes:[]}],textItems:[{id:'caption',name:'Caption',toggleable:true}]};
  const space={...stageSpace(configurable),partVisibility:{warning:false,caption:true,removed:false}};
  const file=projectFile('Concert',space,[],'stage:pit');
  const result=resolveProject(file,[],[configurable]);
  assert.deepEqual(result.space.partVisibility,{warning:false,caption:true});
});
