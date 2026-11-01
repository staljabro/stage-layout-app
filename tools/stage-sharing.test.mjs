import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {openStore} from './account-store.mjs'
import {createEventRoutes} from './event-routes.mjs'

async function fixture(t) {
  const directory=await mkdtemp(join(tmpdir(),'stageplot-sharing-')),store=await openStore(directory)
  t.after(async()=>{store.db.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100})})
  const users={owner:{id:'author',role:'user',empire:false},recipient:{id:'recipient',role:'user',empire:false},other:{id:'other',role:'user',empire:false},admin:{id:'admin',role:'admin',empire:true},root:{id:'root',role:'owner',empire:true}}
  for(const user of Object.values(users))store.run('INSERT INTO users(id,email,name,role,password,empire) VALUES(?,?,?,?,?,?)',user.id,user.id+'@test.invalid',user.id,user.role,'',user.empire?1:0)
  const route=createEventRoutes(store)
  const call=async(path,method='GET',input={},user=users.owner)=>{let result;try{await route({path:'/api'+path,method,user,body:async()=>typeof input==='function'?input():input,send:(status,data)=>{result={status,data:JSON.parse(JSON.stringify(data))}}})}catch(error){result={status:error.status||500,data:{error:error.message}}}assert.ok(result,'route handled '+path);return result}
  const shape={schema:'stageplot-stage@1',label:'Main stage',dimensions:{widthMeters:12,depthMeters:8},boundary:{nodes:[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}]},zones:[],fixedEquipment:[],availableEquipment:[]}
  return {store,users,call,shape}
}
test('stage sharing distinguishes independent reuse, collaborative editing, administrators and revocation',async t=>{
  const {store,users,call,shape}=await fixture(t)
  const original=(await call('/spaces','POST',{data:shape})).data,base='/spaces/'+original.id
  assert.equal((await call(base,'GET',{},users.recipient)).status,404)
  assert.equal((await call(base+'/access','POST',{user:users.recipient.id,permission:'use'})).status,200)
  assert.equal((await call('/spaces','GET',{},users.recipient)).data[0].permission,'use')
  assert.equal((await call(base,'PUT',{version:1,data:shape},users.recipient)).status,403)
  const production=(await call('/productions','POST',{name:'Visiting show',spaceId:original.id},users.recipient)).data
  assert.equal(production.stages.length,1)
  const stageId=production.stages[0].id
  assert.equal((await call('/event-stages/'+stageId,'PUT',{version:1,data:{...shape,label:'Independent copy'}},users.recipient)).status,200)
  assert.equal((await call(base)).data.name,'Main stage')
  await call(base+'/access','POST',{user:users.recipient.id,permission:'edit'})
  assert.equal((await call(base,'PUT',{version:1,data:{...shape,label:'Collaborative stage'}},users.recipient)).status,200)
  assert.equal((await call(base,'PUT',{version:1,data:shape},users.recipient)).status,409)
  assert.equal((await call(base+'/access','POST',{user:users.other.id,permission:'edit'},users.recipient)).status,403)
  const links=(await call(base+'/access','POST',{link:true,permission:'use'})).data
  const share=links.links[0].token
  const metadata=await call('/space-links/'+share,'GET',{},null)
  assert.equal(metadata.status,200);assert.equal(metadata.data.data,undefined)
  assert.equal((await call('/space-links/'+share,'POST',{},null)).status,401)
  assert.equal((await call('/space-links/'+share,'POST',{},users.other)).data.permission,'use')
  await call('/space-links/'+share,'POST',{},users.recipient)
  assert.equal((await call(base,'GET',{},users.recipient)).data.permission,'edit','accepting a use invitation does not downgrade an editor')
  await call(base+'/access','POST',{link:true,permission:'use',disable:true})
  assert.equal((await call('/space-links/'+share,'GET',{},null)).status,404)
  assert.equal((await call(base,'GET',{},users.other)).status,200,'accepted grants survive invitation replacement')
  await call(base+'/access','POST',{user:users.other.id,permission:'use',disable:true})
  assert.equal((await call(base,'GET',{},users.other)).status,404)
  const activeLink=(await call(base+'/access','POST',{link:true,permission:'use'})).data.links.find(link=>link.permission==='use').token
  assert.equal((await call('/space-links/'+activeLink,'POST',{},users.other)).status,403,'a removed account cannot reaccept an old or replacement invitation')
  await call(base+'/access','POST',{user:users.other.id,permission:'use'})
  assert.equal((await call('/space-links/'+activeLink,'POST',{},users.other)).status,200,'the owner can explicitly restore access')
  const race=await call(base,'PUT',()=>{store.run('UPDATE space_access SET permission=? WHERE space_id=? AND user_id=?','use',original.id,users.recipient.id);return {version:2,data:shape}},users.recipient)
  assert.equal(race.status,403,'permission is rechecked after the request body is read')
  await call(base+'/access','POST',{user:users.recipient.id,permission:'use',disable:true})
  assert.equal((await call('/event-stages/'+stageId,'GET',{},users.recipient)).status,200,'revoking a source does not remove independently owned copies')
  assert.equal((await call(base+'/access','GET',{},users.admin)).status,404,'administrators cannot browse ordinary users private stages')
  store.run('UPDATE users SET role=? WHERE id=?','admin',users.owner.id)
  assert.equal((await call(base+'/access','GET',{},users.admin)).status,404,'promoting an author does not expose their earlier private stages')
  const managed=(await call('/spaces','POST',{data:shape},users.root)).data
  assert.equal((await call('/spaces/'+managed.id+'/access','POST',{user:users.recipient.id,permission:'use'},users.admin)).status,200,'administrators can grant access to owner/admin created stages')
  const empire=(await call('/spaces','POST',{data:shape,profile:'empire'},users.admin)).data
  assert.equal((await call('/spaces/'+empire.id+'/access','POST',{user:users.recipient.id,permission:'use'},users.admin)).status,403)
})
test('one event invitation creates isolated performances, is retry-safe and cannot change the stage',async t=>{
  const {users,call,shape,store}=await fixture(t)
  let event=(await call('/events','POST',{name:'Festival'})).data
  const stage=(await call('/events/'+event.id+'/stages','POST',{data:shape})).data
  assert.equal((await call('/events/'+event.id+'/invitation','POST',{revision:event.revision},null)).status,401)
  event=(await call('/events/'+event.id+'/invitation','POST',{revision:event.revision})).data
  const url='/event-invitations/'+event.invitationToken
  const info=(await call(url,'GET',{},null)).data
  assert.equal(info.name,'Festival');assert.equal(info.stages.length,1);assert.equal(info.bands,undefined)
  assert.equal((await call(url,'POST',{name:'Act',stageId:stage.id,registrationKey:'bad'},null)).status,400)
  const input={name:'The Satellites',stageId:stage.id,registrationKey:'a'.repeat(48)}
  const first=await call(url,'POST',input,null),retry=await call(url,'POST',{...input,name:'Retry'},null)
  assert.equal(first.status,201);assert.deepEqual(first.data,retry.data)
  const second=(await call(url,'POST',{...input,registrationKey:'b'.repeat(48)},null)).data
  assert.notEqual(first.data.guestToken,second.guestToken)
  assert.equal(store.get('SELECT COUNT(*) AS n FROM event_bands').n,2)
  const firstPlot=(await call('/band-links/'+first.data.guestToken,'GET',{},null)).data
  assert.equal(JSON.stringify(firstPlot).includes(second.guestToken),false)
  assert.equal((await call('/spaces','GET',{},null)).status,401)
  const forged=structuredClone(firstPlot.data);forged.assetSnapshots.stage.dimensions.widthMeters=999;forged.stage.id='forged'
  const save=await call('/band-links/'+first.data.guestToken,'PUT',{data:forged,revision:firstPlot.revision,notes:'My notes'},null)
  assert.equal(save.status,200);assert.equal(save.data.data.assetSnapshots.stage.dimensions.widthMeters,12)
  assert.equal((await call('/band-links/'+second.guestToken,'GET',{},null)).data.notes,'')
  assert.equal((await call('/event-stages/'+stage.id,'PUT',{data:shape,version:1},null)).status,401)
  assert.equal((await call('/events/'+event.id,'GET',{},users.other)).status,404)
  await call('/events/'+event.id+'/invitation','POST',{revision:event.revision,disable:true})
  assert.equal((await call(url,'GET',{},null)).status,404)
  assert.equal((await call(url,'POST',input,null)).status,404)
  assert.equal((await call('/band-links/'+first.data.guestToken,'GET',{},null)).status,200)
})
