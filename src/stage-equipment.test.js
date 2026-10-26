import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFromLayout, avoidsFixedEquipment, validFixedEquipment } from './stage-equipment.js';
import { stageSpace, projectFile, resolveProject } from './project-file.js';
import { pinProject } from './project-snapshots.js';

const equipment={id:100,assetId:'kit',profiles:['external'],label:'Permanent kit',widthMeters:2,depthMeters:1,xMeters:3,yMeters:2,rotation:90,shapes:[{id:'body',type:'rect',x:0,y:0,width:2,height:1}],collisionShapes:[{type:'rect',x:0,y:0,width:2,height:1}],controls:{arm:{rotation:30}},partVisibility:{body:true},editor:{privateNotes:'secret'},shareToken:'secret'};
const space={name:'Festival',width:10,depth:6,zones:[{id:'hidden',toggleable:true,nodes:[]},{id:'visible',nodes:[]}],textItems:[],partVisibility:{hidden:false}};

test('creating a stage embeds selected placements and strips editor and access data',()=>{
  const stage=stageFromLayout(space,[equipment],{id:'new-stage',label:' Festival fixed '});
  assert.equal(stage.visibility,'draft');
  assert.equal(stage.personal,true);
  assert.equal(stage.label,'Festival fixed');
  assert.deepEqual(stage.zones.map(zone=>zone.id),['visible']);
  assert.equal(stage.boundary.nodes.length,4);
  assert.equal(stage.fixedEquipment[0].rotation,90);
  assert.deepEqual(stage.fixedEquipment[0].controls,equipment.controls);
  assert.ok(!JSON.stringify(stage).includes('secret'));
  stage.fixedEquipment[0].shapes[0].width=99;
  assert.equal(equipment.shapes[0].width,2);
});

test('deriving another stage preserves boundary and existing fixed equipment without source sharing metadata',()=>{
  const original=stageFromLayout(space,[equipment],{id:'original',label:'Original'});
  original.shareToken='secret';original.ownerId='owner';original.revision=5;
  const next=stageFromLayout(stageSpace(original),[equipment],{id:'copy',label:'Copy'});
  assert.deepEqual(next.boundary,original.boundary);
  assert.equal(next.fixedEquipment.length,2);
  assert.notEqual(next.fixedEquipment[0].id,next.fixedEquipment[1].id);
  assert.equal(next.ownerId,undefined);
  assert.equal(next.shareToken,undefined);
  assert.equal(next.revision,undefined);
  assert.equal(original.fixedEquipment.length,1);
});

test('fixed equipment survives project snapshots with no equipment library and stays outside editable items',()=>{
  const stage=stageFromLayout(space,[equipment],{id:'fixed-stage',label:'Fixed stage'});
  const stageState=stageSpace(stage);
  const saved=pinProject(projectFile('Show',stageState,[]),stageState,[]);
  const restored=resolveProject(JSON.parse(JSON.stringify(saved)),[],[]);
  assert.equal(restored.items.length,0);
  assert.deepEqual(restored.space.fixedEquipment,stage.fixedEquipment);
  restored.space.fixedEquipment[0].xMeters=9;
  assert.equal(stage.fixedEquipment[0].xMeters,3);
});

test('fixed collisions respect rotated geometry and placement collision settings',()=>{
  const candidate={...equipment,widthMeters:.2,depthMeters:.2,collisionShapes:[],xMeters:3,yMeters:2.8,rotation:0};
  assert.equal(avoidsFixedEquipment(candidate,[equipment]),false);
  assert.equal(avoidsFixedEquipment({...candidate,xMeters:3.8,yMeters:2},[equipment]),true);
  assert.equal(avoidsFixedEquipment(candidate,[{...equipment,collisionEnabled:false}]),true);
});

test('invalid embedded placements are rejected while old stages remain valid',()=>{
  const fixed=stageFromLayout(space,[equipment],{id:'test',label:'Test'}).fixedEquipment;
  assert.equal(validFixedEquipment(undefined),true);
  assert.equal(validFixedEquipment(fixed),true);
  for(const items of [null,{},[...fixed,...fixed],[{...fixed[0],widthMeters:0}],[{...fixed[0],xMeters:NaN}],[{...fixed[0],shapes:null}]])assert.equal(validFixedEquipment(items),false);
  assert.throws(()=>stageFromLayout(space,[{...equipment,profiles:['empire']}],{id:'test',label:'Test'}),/share a library profile/);
});
