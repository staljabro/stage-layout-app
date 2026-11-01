import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,unlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname,resolve} from 'node:path'
import {openStore} from './account-store.mjs'
import {createUserWorkspace} from './user-workspace.mjs'
import {isEquipmentItem} from './library-membership.mjs'
import {equipmentSession} from '../src/editor/equipment-session.js'

const nodes=[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}]
const equipment={id:'old-stand',schema:'stageplot-item@3',label:'Archived stand',dimensions:{widthMeters:.5,depthMeters:.5},shapes:[{id:'body',type:'rect',x:0,y:0,width:.5,height:.5,fill:'#111'}],collisionShapes:[],editor:{layers:[]}}
const stage={id:'old-stage',schema:'stageplot-stage@1',label:'Archived venue',dimensions:{widthMeters:8,depthMeters:6},boundary:{closed:true,nodes},zones:[{id:'zone',name:'Pit',nodes}],textItems:[{id:'text',text:'Upstage',x:4,y:1,fontSize:.2}],curtains:[{id:'curtain',x:0,y:2,length:8}],details:['Original venue notes'],editor:{zoneFolders:[{id:'folder',name:'Pit layers',zoneIds:['zone']}],referenceImages:[{id:'ref',x:0,y:0,width:8,height:6,dataUrl:'data:image/png;base64,iVBORw0KGgo='}],dimensionLines:[{id:'dim',x:1,y:1,length:4}],stageBoundaryLocked:true}}
async function fixture(t,{bootstrap=false}={}) {
  const directory=await mkdtemp(join(tmpdir(),'stageplot-legacy-imports-'))
  let store
  t.after(async()=>{store?.db.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100})})
  if(bootstrap){for(const folder of ['stage-library','equipment-library'])await mkdir(join(directory,folder));await writeFile(join(directory,'stage-library','old.stageplot-stage.json'),JSON.stringify(stage));await writeFile(join(directory,'equipment-library','old.stageplot-item.json'),JSON.stringify(equipment))}
  store=await openStore(directory)
  const users=Object.fromEntries(['owner','admin','user'].map((role,index)=>[role,{id:String(index+1).repeat(32),name:role,email:role+'@test.invalid',role}]))
  for(const user of Object.values(users))store.run('INSERT INTO users(id,email,name,role,password) VALUES(?,?,?,?,?)',user.id,user.email,user.name,user.role,'')
  let routes=createUserWorkspace(store)
  const call=async(path,method='GET',input={},user=users.owner)=>{let result;try{await routes({path:'/api/workspace'+path,method,user,body:async()=>typeof input==='function'?input():input,send:(status,data)=>{result={status,data:JSON.parse(JSON.stringify(data))}}})}catch(error){result={status:error.status||500,data:{error:error.message}}}assert.ok(result,'handled '+path);return result}
  return {directory,users,call,get store(){return store},reopen:async()=>{store.db.close();store=await openStore(directory);routes=createUserWorkspace(store)}}
}

test('only the app Owner can list archives, import JSON or make stage templates',async t=>{
  const {store,call,users}=await fixture(t)
  store.saveAsset('stages',stage.id,stage,null,null);store.saveAsset('items',equipment.id,equipment,null,null)
  const source=(await call('/stages','POST',{data:stage})).data
  const operations=[['/legacy-stages','GET',{}],['/legacy-equipment','GET',{}],['/stages/import','POST',{data:stage}],['/stages/import','POST',{assetId:stage.id}],['/equipment/import','POST',{data:equipment}],['/equipment/import','POST',{assetId:equipment.id}],['/stages/'+source.id+'/template','POST',{name:'Copy'}]]
  await call('/organisations','POST',{name:'User owns this team'},users.user)
  for(const [path,method,input] of operations)for(const user of [null,users.user,users.admin])assert.equal((await call(path,method,input,user)).status,user?403:401,path+' rejects '+(user?.role||'guest'))
  assert.equal((await call('/legacy-stages')).data[0].name,stage.label)
  assert.equal((await call('/legacy-equipment')).data[0].label,equipment.label)
  for(const path of ['/stages/import','/equipment/import'])assert.equal((await call(path,'POST',null)).status,400)
  const before=store.get('SELECT count(*) AS count FROM wf_stages').count
  const revoked=await call('/stages/import','POST',()=>{store.run("UPDATE users SET role='admin' WHERE id=?",users.owner.id);return {data:stage}})
  assert.equal(revoked.status,403,'Owner status is rechecked after the request body')
  assert.equal(store.get('SELECT count(*) AS count FROM wf_stages').count,before)
})

test('stage restoration preserves artwork and creates independent private versions without copying grants',async t=>{
  const {store,call,users}=await fixture(t)
  const original={...stage,profiles:['empire'],visibility:'link-only',shareToken:'old-secret',generic:true,public:true,availableEquipment:[{assetId:equipment.id,quantity:3}]}
  store.saveAsset('stages',stage.id,original,null,null);store.saveAsset('items',equipment.id,equipment,null,null)
  const archived=store.asset('stages',stage.id).data
  const copy=await call('/stages/import','POST',{assetId:stage.id,name:'New venue'})
  assert.equal(copy.status,201,copy.data.error);assert.notEqual(copy.data.id,stage.id);assert.equal(copy.data.ownerId,users.owner.id)
  assert.equal(copy.data.version,1);assert.equal(copy.data.generic,false);assert.equal(copy.data.public,false);assert.deepEqual(copy.data.organisationIds,[])
  for(const key of ['boundary','zones','textItems','details','editor','dimensions'])assert.deepEqual(copy.data.data[key],stage[key])
  assert.deepEqual(copy.data.data.layerFolders,stage.editor.zoneFolders,'old stage folders load in the current editor')
  assert.equal(copy.data.data.availableEquipmentSnapshots[0].id,equipment.id,'retained available equipment remains usable without publishing it')
  assert.equal(copy.data.data.shareToken,undefined);assert.equal(copy.data.data.generic,undefined);assert.equal(copy.data.data.public,undefined)
  assert.equal(store.asset('stages',stage.id).data,archived,'archived originals are untouched')
  const next=await call('/stages/'+copy.data.id+'/template','POST',{name:'Another venue'})
  assert.equal(next.status,201,next.data.error);assert.notEqual(next.data.id,copy.data.id);assert.equal(next.data.version,1)
  await call('/stages/'+next.data.id,'PUT',{version:1,data:{...next.data.data,label:'Edited copy',zones:[]}})
  assert.equal((await call('/stages/'+copy.data.id)).data.data.zones.length,1)
  assert.equal((await call('/stages/'+copy.data.id,'GET',{},users.user)).status,404)
  const hidden={...stage,id:'someone-elses-stage'};store.saveAsset('stages',hidden.id,hidden,users.user,users.user.id)
  assert.equal((await call('/legacy-stages')).data.some(row=>row.id===hidden.id),false)
  assert.equal((await call('/stages/import','POST',{assetId:hidden.id})).status,404)
  const privateSource=(await call('/stages','POST',{data:stage},users.user)).data
  assert.equal((await call('/stages/'+privateSource.id+'/template','POST',{name:'Forbidden'})).status,404)
  await call('/stages/'+privateSource.id+'/access','POST',{email:users.owner.email,permission:'use'},users.user)
  assert.equal((await call('/stages/'+privateSource.id+'/template','POST',{name:'Permitted copy'})).status,201)
  const file=await call('/stages/import','POST',{data:stage,name:'JSON stage'})
  assert.equal(file.status,201,file.data.error);assert.equal(file.data.data.label,'JSON stage')
  assert.equal((await call('/stages/import','POST',{data:equipment})).status,400)
  assert.equal((await call('/stages/import','POST',{data:{...stage,boundary:{nodes:[]}}})).status,400)
})

test('normal users can copy accessible equipment while raw imports and private archives stay restricted',async t=>{
  const {store,call,users}=await fixture(t)
  store.saveAsset('items',equipment.id,{...equipment,profiles:['external']},null,null)
  assert.equal((await call('/equipment/import','POST',{assetId:equipment.id},users.user)).status,403)
  const copy=await call('/equipment/'+equipment.id+'/copy','POST',{},users.user)
  assert.equal(copy.status,201,copy.data.error);assert.equal(copy.data.ownerId,users.user.id);assert.equal(copy.data.public,false)
  assert.equal((await call('/equipment/'+copy.data.id+'/copy','POST',{},users.admin)).status,404)
  assert.equal((await call('/equipment/import','POST',{assetId:copy.data.id})).status,404)
  const imported=await call('/equipment/import','POST',{data:equipment})
  assert.equal(imported.status,201,imported.data.error);assert.equal(imported.data.ownerId,users.owner.id)
})

test('legacy seated-person artwork imports and saves as visible equipment without changing its custom-shape original',async t=>{
  const {store,call,users}=await fixture(t)
  const original={...structuredClone(equipment),id:'advanced-person-sitting-legs-apart',label:'Person Sitting - Legs apart',dimensions:{widthMeters:.69,depthMeters:.82},editor:{layers:structuredClone(equipment.shapes),advancedShapeRole:'custom',placementMode:'layers'}}
  assert.equal(original.label,'Person Sitting - Legs apart');assert.equal(isEquipmentItem(original),false)
  store.saveAsset('items',original.id,original,null,null)
  const imported=await call('/equipment/import','POST',{data:original})
  assert.equal(imported.status,201,imported.data.error)
  assert.equal(isEquipmentItem(imported.data),true);assert.equal(imported.data.editor.advancedShapeRole,undefined)
  assert.deepEqual(imported.data.shapes,original.shapes)
  assert.deepEqual(imported.data.editor.layers,original.editor.layers)
  assert.equal(original.editor.advancedShapeRole,'custom','normalisation does not mutate uploaded/source artwork')
  assert.equal(JSON.parse(store.asset('items',original.id).data).editor.advancedShapeRole,'custom','original custom shapes remain reusable')
  assert.ok((await call('/equipment')).data.filter(isEquipmentItem).some(item=>item.id===imported.data.id),'the personal equipment catalogue includes the import')
  const source=(await call('/stages','POST',{data:stage})).data
  const layout=(await call('/stages/'+source.id+'/layouts','POST',{name:'Use imported person'})).data
  assert.ok((await call('/layouts/'+layout.id)).data.equipment.some(item=>item.id===imported.data.id),'the layout drawer receives the imported equipment')
  const hiddenId='item-previously-hidden'
  store.saveAsset('items',hiddenId,{...original,id:hiddenId},users.owner,users.owner.id)
  const loaded=(await call('/equipment/'+hiddenId)).data
  assert.equal(equipmentSession(loaded).advancedShapeRole,null,'the equipment editor clears legacy custom-shape classification')
  const repaired=await call('/equipment/'+hiddenId,'PUT',{data:loaded,revision:loaded.revision,organisationIds:[]})
  assert.equal(repaired.status,200,repaired.data.error);assert.equal(isEquipmentItem(repaired.data),true)
  assert.equal(repaired.data.id,hiddenId);assert.equal(repaired.data.revision,loaded.revision+1)
  assert.deepEqual(repaired.data.shapes,original.shapes,'re-saving repairs the existing item without recreating artwork')
})

test('removing initial JSON files after bootstrap leaves archives and restoration available in SQLite',async t=>{
  const fixtureData=await fixture(t,{bootstrap:true}),{call,directory}=fixtureData
  assert.equal(fixtureData.store.get("SELECT value FROM settings WHERE key='imported'").value,'true')
  for(const relative of ['stage-library/old.stageplot-stage.json','equipment-library/old.stageplot-item.json']){const target=resolve(directory,relative);assert.ok(target.startsWith(resolve(directory)+join('/')));await unlink(target)}
  await fixtureData.reopen()
  assert.equal((await call('/legacy-stages')).data[0].name,stage.label)
  assert.equal((await call('/legacy-equipment')).data[0].label,equipment.label)
  assert.equal((await call('/stages/import','POST',{assetId:stage.id,name:'Recovered without JSON'})).status,201)
  assert.equal((await call('/equipment/import','POST',{assetId:equipment.id})).status,201)
})
