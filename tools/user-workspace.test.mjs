import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname,resolve} from 'node:path'
import {openStore} from './account-store.mjs'
import {createUserWorkspace} from './user-workspace.mjs'

const equipment={schema:'stageplot-item@3',label:'Private stand',dimensions:{widthMeters:.5,depthMeters:.5},shapes:[{id:'body',type:'rect',x:0,y:0,width:.5,height:.5,fill:'#abc'}],collisionShapes:[{type:'rect',x:0,y:0,width:.5,height:.5}],rotationParts:[{id:'arm',pivotX:.2,pivotY:.2,minRotation:-90,maxRotation:90}],editor:{layers:[{id:1,type:'rect',x:0,y:0,width:.5,height:.5,fill:'#abc'}],referenceImages:[{id:'private-reference',dataUrl:'data:image/png;base64,PRIVATE'}]}}
const stage={schema:'stageplot-stage@1',label:'My stage',dimensions:{widthMeters:12,depthMeters:8},boundary:{nodes:[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}]},zones:[],fixedEquipment:[],availableEquipment:[]}
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'stageplot-user-workspace-')),store=await openStore(directory)
  t.after(async()=>{store.db.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100})})
  const users={author:{id:'a'.repeat(32),name:'Author',email:'author@test.invalid',role:'user',empire:false},other:{id:'b'.repeat(32),name:'Client',email:'client@test.invalid',role:'user',empire:false},admin:{id:'c'.repeat(32),name:'Admin',email:'admin@test.invalid',role:'admin',empire:false}}
  for(const user of Object.values(users))store.run('INSERT INTO users(id,email,name,role,password) VALUES(?,?,?,?,?)',user.id,user.email,user.name,user.role,'')
  const routes=createUserWorkspace(store)
  const call=async(path,method='GET',input={},user=users.author)=>{let result;try{await routes({path:'/api/workspace'+path,method,user,body:async()=>typeof input==='function'?input():input,send:(status,data)=>{result={status,data:JSON.parse(JSON.stringify(data))}}})}catch(error){result={status:error.status||500,data:{error:error.message}}}assert.ok(result,'handled '+path);return result}
  return {store,users,call}
}
test('organisation owners rename teams with revision checks while existing links and assets stay attached',async t=>{
  const {call,users,store}=await fixture(t),team=(await call('/organisations','POST',{name:'Original team'})).data,base='/organisations/'+team.id
  const invitation=(await call(base+'/invitations','POST',{})).data.invitations[0]
  await call('/organisation-invitations/'+invitation.token,'POST',{},users.other)
  await call(base+'/members/'+users.other.id,'PUT',{role:'admin'})
  const source=(await call('/stages','POST',{data:stage,organisationIds:[team.id]})).data
  const stageInvite=(await call('/stages/'+source.id+'/invitation','POST',{organisationId:team.id})).data
  const layout=(await call('/stage-invitations/'+stageInvite.token,'POST',{name:'Existing client',registrationKey:'e'.repeat(32)},null)).data
  assert.equal((await call(base,'PUT',{name:'No',revision:1},null)).status,401)
  assert.equal((await call(base,'PUT',{name:'No',revision:1},users.admin)).status,404,'app admins do not gain team ownership')
  assert.equal((await call(base,'PUT',{name:'No',revision:1},users.other)).status,403,'organisation admins cannot rename the team')
  for(const name of ['', ' '.repeat(5), 'a'.repeat(201),null])assert.equal((await call(base,'PUT',{name,revision:1})).status,400)
  const renamed=await call(base,'PUT',{name:'  Renamed team  ',revision:1})
  assert.equal(renamed.status,200,renamed.data.error);assert.equal(renamed.data.name,'Renamed team');assert.equal(renamed.data.revision,2)
  assert.equal((await call(base,'PUT',{name:'Stale name',revision:1})).status,409)
  assert.equal((await call('/organisations')).data[0].name,'Renamed team')
  assert.equal((await call('/organisation-invitations/'+invitation.token,'GET',{},null)).data.name,'Renamed team')
  assert.equal((await call('/stage-invitations/'+stageInvite.token,'GET',{},null)).data.organisation.name,'Renamed team')
  assert.equal((await call('/layout-links/'+layout.guestToken,'GET',{},null)).data.organisation.name,'Renamed team')
  assert.equal((await call('/stages/'+source.id)).data.organisationIds[0],team.id)
  assert.equal(store.get('SELECT count(*) AS count FROM wf_members WHERE organisation_id=?',team.id).count,2)
  const transferred=await call(base,'PUT',async()=>{await call(base+'/members/'+users.other.id,'PUT',{role:'owner'});return {name:'Old owner changed this',revision:2}})
  assert.equal(transferred.status,403,'ownership is rechecked after reading the request body')
  assert.equal((await call(base)).data.name,'Renamed team')
})

test('curtains persist in stage versions, shared layouts and previews as locked source artwork',async t=>{
  const {call}=await fixture(t),curtain={id:'back-curtain',name:'Back curtain',x:1,y:2,length:6.25,rotation:15.3,color:'#663399',thickness:.012,opacity:.6,collisionEnabled:false,visible:true,editorGroupId:'curtain-group'}
  const saved=await call('/stages','POST',{data:{...stage,curtains:[curtain]}})
  assert.equal(saved.status,201,saved.data.error)
  const source=(await call('/stages/'+saved.data.id)).data
  assert.equal(source.data.curtains[0].rotation,15)
  assert.equal(source.data.curtains[0].collisionEnabled,false)
  assert.equal((await call('/stages')).data.find(row=>row.id===source.id).preview.curtains[0].length,6.25)
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{})).data
  const layout=(await call('/stage-invitations/'+invitation.token,'POST',{name:'Curtain client',registrationKey:'c'.repeat(32)},null)).data
  const client=(await call('/layout-links/'+layout.guestToken,'GET',{},null)).data
  assert.deepEqual(client.data.assetSnapshots.stage.curtains,source.data.curtains)
  const tampered=structuredClone(client.data);tampered.assetSnapshots.stage.curtains=[]
  const edit=await call('/layout-links/'+layout.guestToken,'PUT',{data:tampered,revision:client.revision},null)
  assert.equal(edit.status,200,edit.data.error)
  assert.deepEqual((await call('/layout-links/'+layout.guestToken,'GET',{},null)).data.data.assetSnapshots.stage.curtains,source.data.curtains,'clients cannot change source curtains')
  for(const curtains of [[{...curtain,length:-1}],[{...curtain,x:null}],[curtain,curtain],'invalid'])assert.equal((await call('/stages','POST',{data:{...stage,curtains}})).status,400)
})

test('organisation logos are admin managed and follow team invitations and client layouts',async t=>{
  const {call,users}=await fixture(t),organisation=(await call('/organisations','POST',{name:'Branded venue'})).data,base='/organisations/'+organisation.id
  const logo='data:image/png;base64,iVBORw0KGgo=',replacement='data:image/png;base64,iVBORw0KGgoAAA='
  assert.equal((await call(base+'/logo','PUT',{logo,revision:1},null)).status,401)
  assert.equal((await call(base+'/logo','PUT',{logo,revision:1},users.admin)).status,404)
  assert.equal((await call(base+'/logo','PUT',{logo:'data:image/svg+xml;base64,PHN2Zz4=',revision:1})).status,400)
  const saved=await call(base+'/logo','PUT',{logo,revision:1});assert.equal(saved.status,200,saved.data.error);assert.equal(saved.data.logo,logo);assert.equal(saved.data.revision,2)
  assert.equal((await call(base+'/logo','PUT',{logo,revision:1})).status,409)
  const teamInvitation=(await call(base+'/invitations','POST',{})).data.invitations[0]
  assert.deepEqual((await call('/organisation-invitations/'+teamInvitation.token,'GET',{},null)).data.organisation,{id:organisation.id,name:organisation.name,logo})
  await call('/organisation-invitations/'+teamInvitation.token,'POST',{},users.other)
  assert.equal((await call(base+'/logo','PUT',{logo,revision:2},users.other)).status,403)
  const source=(await call('/stages','POST',{data:stage,organisationIds:[organisation.id]})).data
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{organisationId:organisation.id})).data
  assert.equal((await call('/stage-invitations/'+invitation.token,'GET',{},null)).data.organisation.logo,logo)
  const layout=(await call('/stage-invitations/'+invitation.token,'POST',{name:'Branded client',registrationKey:'a'.repeat(32)},null)).data
  const shared=(await call('/layout-links/'+layout.guestToken,'GET',{},null)).data
  assert.deepEqual(shared.organisation,{id:organisation.id,name:organisation.name,logo})
  assert.equal(shared.organisation.owner_id,undefined)
  assert.equal((await call('/layouts/'+layout.id)).data.organisation.logo,logo)
  await call(base+'/logo','PUT',{logo:replacement,revision:2})
  assert.equal((await call('/layout-links/'+layout.guestToken,'GET',{},null)).data.organisation.logo,replacement)
  assert.equal((await call(base+'/logo','PUT',{logo:null,revision:3})).data.logo,null)
  assert.equal((await call('/stage-invitations/'+invitation.token,'GET',{},null)).data.organisation.logo,null)
  await call(base+'/members/'+users.other.id,'PUT',{role:'admin'})
  const stillMember=await call(base+'/logo','PUT',async()=>{await call(base+'/members/'+users.other.id,'DELETE');return {logo,revision:4}},users.other)
  assert.equal(stillMember.status,404,'logo permissions are rechecked after reading the upload')
})

test('shared stages and layouts can be removed and restored for one user without changing originals',async t=>{
  const {call,users,store}=await fixture(t),source=(await call('/stages','POST',{data:stage})).data
  await call('/stages/'+source.id+'/access','POST',{email:users.other.email,permission:'use'})
  const endpoint='/library/stage/'+source.id
  assert.equal((await call(endpoint,'PUT',{removed:true})).status,403,'owners keep original stages in their library')
  assert.equal((await call(endpoint,'PUT',{removed:true},users.admin)).status,404)
  assert.equal((await call(endpoint,'PUT',{removed:true},null)).status,401)
  assert.equal((await call(endpoint,'PUT',{removed:'yes'},users.other)).status,400)
  assert.equal((await call(endpoint,'PUT',{removed:true},users.other)).status,200)
  assert.equal((await call('/stages','GET',{},users.other)).data.find(item=>item.id===source.id).removedFromLibrary,true)
  assert.equal((await call('/stages/'+source.id)).data.removedFromLibrary,false)
  assert.equal((await call('/stages/'+source.id,'GET',{},users.other)).data.version,1,'personal removal preserves source access and geometry')
  await call(endpoint,'PUT',{removed:false},users.other)
  assert.equal((await call('/stages','GET',{},users.other)).data.find(item=>item.id===source.id).removedFromLibrary,false)
  const layout=(await call('/stages/'+source.id+'/layouts','POST',{name:'Shared arrangement',shareWithStageOwner:true},users.other)).data,layoutEndpoint='/library/layout/'+layout.id
  assert.equal((await call(layoutEndpoint,'PUT',{removed:true},users.other)).status,403)
  assert.equal((await call(layoutEndpoint,'PUT',{removed:true})).status,200)
  assert.equal((await call('/layouts')).data.find(item=>item.id===layout.id).removedFromLibrary,true)
  assert.equal((await call('/layouts/'+layout.id,'GET',{},users.other)).data.removedFromLibrary,false)
  assert.equal(store.get('SELECT deleted FROM wf_layouts WHERE id=?',layout.id).deleted,0)
  await call(layoutEndpoint,'PUT',{removed:false})
  assert.equal((await call('/layouts/'+layout.id)).data.removedFromLibrary,false)
})

test('ordinary members author private equipment and stages without profile or contributor gates',async t=>{
  const {call,users}=await fixture(t)
  assert.equal((await call('/generic-stages','GET',{},null)).data.length,3)
  assert.equal((await call('/equipment','GET',{},null)).data.length,4)
  const saved=await call('/equipment/my-stand','PUT',{data:{...equipment,profiles:['empire']}})
  assert.equal(saved.status,200,saved.data.error);assert.equal(saved.data.ownerId,users.author.id);assert.equal(saved.data.public,false);assert.equal(saved.data.profiles,undefined)
  assert.equal((await call('/equipment/my-stand','GET',{},users.other)).status,404)
  assert.equal((await call('/equipment/my-stand','GET',{},null)).status,401)
  assert.equal((await call('/equipment/my-stand','PUT',{revision:1,data:equipment},users.other)).status,403)
  const created=await call('/stages','POST',{data:stage});assert.equal(created.status,201,created.data.error)
  assert.equal((await call('/stages/'+created.data.id,'GET',{},users.other)).status,404)
  assert.equal((await call('/stages','POST',{data:stage},null)).status,401)
  assert.equal((await call('/stages/'+created.data.id,'PUT',{data:stage,version:1})).data.version,2)
  assert.equal((await call('/stages/'+created.data.id,'PUT',{data:stage,version:1})).status,409)
})
test('organisations share assets privately with membership and independent admin boundaries',async t=>{
  const {call,users}=await fixture(t)
  const organisation=(await call('/organisations','POST',{name:'Venue team'})).data
  const base='/organisations/'+organisation.id
  const invited=await call(base+'/invitations','POST',{email:users.other.email,role:'user'})
  assert.equal(invited.status,201,invited.data.error)
  const invite=invited.data.invitations[0]
  assert.equal((await call('/organisation-invitations/'+invite.token,'POST',{},users.admin)).status,403)
  assert.equal((await call('/organisation-invitations/'+invite.token,'POST',{},null)).status,401)
  assert.equal((await call('/organisation-invitations/'+invite.token,'POST',{},users.other)).status,200)
  assert.equal((await call('/organisations','GET',{},users.other)).data.length,1)
  await call('/equipment/team-stand','PUT',{data:equipment,organisationIds:[organisation.id]})
  const sharedStage=(await call('/stages','POST',{data:stage,organisationIds:[organisation.id]})).data
  assert.equal((await call('/equipment/team-stand','GET',{},users.other)).status,200)
  assert.equal((await call('/equipment','GET',{},null)).data.some(item=>item.id==='team-stand'),false)
  assert.equal((await call('/equipment/team-stand','PUT',{data:equipment,revision:1},users.other)).status,403)
  assert.equal((await call('/stages/'+sharedStage.id,'PUT',{data:stage,version:1},users.other)).status,403)
  assert.equal((await call(base+'/invitations','POST',{},users.other)).status,403)
  await call(base+'/members/'+users.other.id,'PUT',{role:'admin'})
  assert.equal((await call('/equipment/team-stand','PUT',{data:{...equipment,label:'Team revision'},revision:1},users.other)).status,200)
  assert.equal((await call('/stages/'+sharedStage.id,'PUT',{data:stage,version:1},users.other)).status,200)
  assert.equal((await call('/submissions/not-valid','POST',{},users.other)).status,404)
  const pending=(await call('/equipment/team-stand','PUT',{data:equipment,revision:2,submit:true},users.other)).data
  assert.equal(pending.ownerId,users.author.id)
  const proposal=(await call('/submissions')).data[0]
  assert.equal((await call('/submissions/'+proposal.id,'POST',{action:'approve',revision:proposal.revision},users.other)).status,403,'organisation admins are not app approvers')
  assert.equal((await call(base+'/members/'+users.author.id,'DELETE',{},users.other)).status,403)
  await call(base+'/members/'+users.other.id,'DELETE')
  assert.equal((await call('/equipment/team-stand','GET',{},users.other)).status,404)
  assert.equal((await call('/stages/'+sharedStage.id,'GET',{},users.other)).status,404)
  assert.equal((await call(base,'GET',{},users.other)).status,404)
  assert.equal((await call(base+'/members/'+users.author.id,'DELETE')).status,409)
})
test('public review edits and approval preserve the creators private original and stable published IDs',async t=>{
  const {call,users,store}=await fixture(t)
  await call('/equipment/my-stand','PUT',{data:equipment,submit:true})
  const proposal=(await call('/submissions')).data[0]
  assert.equal((await call('/equipment','GET',{},null)).data.some(item=>item.label===equipment.label),false)
  assert.equal((await call('/submissions/'+proposal.id,'POST',{revision:proposal.revision,action:'approve'},users.other)).status,403)
  assert.equal((await call('/submissions/'+proposal.id,'POST',{revision:99,action:'approve'},users.admin)).status,409)
  assert.equal((await call('/submissions/'+proposal.id,'POST',{revision:proposal.revision,action:'save',data:{...equipment,label:'Reviewed stand'},feedback:'Adjusted artwork'},users.admin)).status,200)
  assert.equal((await call('/equipment/my-stand')).data.label,equipment.label)
  const revised=(await call('/submissions','GET',{},users.admin)).data[0]
  assert.equal((await call('/submissions/'+proposal.id,'POST',{revision:revised.revision,action:'approve'},users.admin)).status,200)
  const publicItem=(await call('/equipment','GET',{},null)).data.find(item=>item.label==='Reviewed stand')
  assert.ok(publicItem);assert.equal(publicItem.ownerId,null);assert.equal(publicItem.canEdit,false);assert.deepEqual(publicItem.editor.referenceImages,[])
  assert.equal((await call('/equipment/my-stand')).data.label,equipment.label)
  assert.deepEqual((await call('/equipment/my-stand')).data.editor.referenceImages,equipment.editor.referenceImages)
  await call('/equipment/my-stand','PUT',{revision:1,data:{...equipment,label:'Second proposal'},submit:true})
  const update=(await call('/submissions','GET',{},users.admin)).data[0]
  await call('/submissions/'+update.id,'POST',{revision:update.revision,action:'approve'},users.admin)
  assert.equal((await call('/equipment','GET',{},null)).data.find(item=>item.label==='Second proposal').id,publicItem.id)
  assert.equal(store.get('SELECT COUNT(*) AS n FROM wf_publications').n,1)
  const fork=await call('/equipment/import','POST',{assetId:publicItem.id},users.other)
  assert.equal(fork.status,201);assert.equal(fork.data.public,false);assert.equal(fork.data.ownerId,users.other.id)
})
test('client layouts reference original stage versions and expose only deliberately shared equipment',async t=>{
  const {call,users,store}=await fixture(t)
  await call('/equipment/available-stand','PUT',{data:equipment})
  await call('/equipment/secret-stand','PUT',{data:{...equipment,label:'UNSHARED SECRET'}})
  const source=(await call('/stages','POST',{data:{...stage,availableEquipment:[{assetId:'available-stand',quantity:4}]}})).data
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{})).data
  const path='/stage-invitations/'+invitation.token,input={name:'First client',registrationKey:'a'.repeat(48)}
  const first=await call(path,'POST',input,null),retry=await call(path,'POST',input,null)
  assert.equal(first.status,201,first.data.error);assert.deepEqual(first.data,retry.data)
  const second=(await call(path,'POST',{name:'Second client',registrationKey:'b'.repeat(48)},null)).data
  assert.notEqual(first.data.guestToken,second.guestToken)
  assert.equal(store.get('SELECT COUNT(*) AS n FROM wf_stages').n,4,'layouts do not create stage copies')
  const layoutUrl='/layout-links/'+first.data.guestToken,layout=(await call(layoutUrl,'GET',{},null)).data
  assert.equal(layout.stageId,source.id)
  assert.ok(layout.equipment.some(item=>item.id==='available-stand'))
  assert.equal(JSON.stringify(layout).includes('UNSHARED SECRET'),false)
  assert.equal(JSON.stringify(layout).includes('PRIVATE'),false,'private authoring reference images never enter the client palette')
  const forged={...layout.data,assetSnapshots:{...layout.data.assetSnapshots,stage:{...layout.data.assetSnapshots.stage,dimensions:{widthMeters:999,depthMeters:999}}}}
  forged.items=[{id:101,assetId:'available-stand',xMeters:2,yMeters:2,rotation:0,supply:'venue'}]
  const saved=await call(layoutUrl,'PUT',{data:forged,notes:'Client equipment',revision:1},null)
  assert.equal(saved.status,200,saved.data.error);assert.equal(saved.data.data.assetSnapshots.stage.dimensions.widthMeters,12)
  const stored=JSON.parse(store.get('SELECT data FROM wf_layouts WHERE id=?',first.data.id).data)
  assert.equal(stored.assetSnapshots.stage,undefined,'stage geometry is materialised on read, not copied into each layout')
  assert.equal((await call('/layouts')).data.length,2)
  assert.equal((await call('/layouts','GET',{},users.other)).data.length,0)
  assert.equal((await call('/layouts/'+first.data.id,'GET',{},users.other)).status,404)
  assert.equal((await call('/layout-links/'+second.guestToken,'GET',{},null)).data.data.items.length,0)
  await call('/stages/'+source.id,'PUT',{version:1,data:{...stage,dimensions:{widthMeters:14,depthMeters:8}}})
  assert.equal((await call(layoutUrl,'GET',{},null)).data.stageVersion,1)
  await call('/layouts/'+first.data.id+'/stage-update','POST',{revision:2,stageVersion:2})
  assert.equal((await call(layoutUrl,'GET',{},null)).data.stageVersion,2)
  await call('/stages/'+source.id+'/invitation','POST',{disable:true})
  assert.equal((await call(path,'GET',{},null)).status,404)
  assert.equal((await call(layoutUrl,'GET',{},null)).status,200)
})
test('anonymous generic layouts can be claimed without taking ownership of another users stage',async t=>{
  const {call,users}=await fixture(t)
  const created=(await call('/generic-stages/generic-rehearsal/layouts','POST',{name:'Anonymous arrangement'},null)).data
  const url='/layout-links/'+created.guestToken
  assert.equal((await call(url,'GET',{},null)).data.ownerId,null)
  assert.equal((await call(url+'/claim','POST',{},users.other)).status,200)
  assert.equal((await call('/layouts','GET',{},users.other)).data[0].ownerId,users.other.id)
  assert.equal((await call(url+'/claim','POST',{},users.author)).status,409)
  const source=(await call('/stages','POST',{data:stage})).data
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{})).data
  const guest=(await call('/stage-invitations/'+invitation.token,'POST',{name:'Shared work',registrationKey:'c'.repeat(48)},null)).data
  const claimed=await call('/layout-links/'+guest.guestToken+'/claim','POST',{},users.other)
  assert.equal(claimed.data.ownerId,users.author.id)
  assert.equal(claimed.data.creatorId,users.other.id)
  assert.equal((await call('/layouts','GET',{},users.other)).data.length,2)
})
test('existing equipment imports preserve artwork, collision, controls and original legacy records',async t=>{
  const {call,users,store}=await fixture(t)
  const legacy={...equipment,id:'legacy-empire-stand',profiles:['empire'],stageplotPublished:true,rotationParts:equipment.rotationParts}
  store.saveAsset('items',legacy.id,legacy,users.admin,null)
  const original=store.get("SELECT data FROM assets WHERE kind='items' AND id=?",legacy.id).data
  assert.equal((await call('/equipment','GET',{},null)).data.some(item=>item.id===legacy.id),false)
  assert.equal((await call('/legacy-equipment','GET',{},users.author)).status,403)
  const restored=await call('/equipment/import','POST',{assetId:legacy.id},users.admin)
  assert.equal(restored.status,201,restored.data.error)
  for(const key of ['schema','shapes','collisionShapes','rotationParts','editor','dimensions'])assert.deepEqual(restored.data[key],legacy[key])
  assert.equal(restored.data.public,false)
  assert.equal(store.get("SELECT data FROM assets WHERE kind='items' AND id=?",legacy.id).data,original)
  const file=await call('/equipment/import','POST',{data:legacy})
  assert.equal(file.status,201);assert.equal(file.data.ownerId,users.author.id)
})

test('organisation client invitations admit external clients and stop when stage sharing is removed',async t=>{
  const {call,users}=await fixture(t)
  const team=(await call('/organisations','POST',{name:'Festival'})).data
  const source=(await call('/stages','POST',{data:stage,organisationIds:[team.id]})).data
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{organisationId:team.id})).data
  const created=await call('/stage-invitations/'+invitation.token,'POST',{name:'Outside client',registrationKey:'d'.repeat(48)},users.other)
  assert.equal(created.status,201,created.data.error)
  const layout=(await call('/layouts/'+created.data.id,'GET',{},users.other)).data
  assert.equal(layout.organisationId,team.id)
  assert.equal(layout.canReview,false)
  assert.equal(layout.canUpdateStage,false)
  assert.equal((await call('/organisations/'+team.id,'GET',{},users.other)).status,404)
  assert.equal((await call('/layouts')).data.length,1)
  const shared=await call('/stages/'+source.id+'/sharing','POST',{organisationIds:[]})
  assert.equal(shared.status,200)
  assert.equal(shared.data.version,1,'sharing metadata does not invalidate an open stage editor')
  assert.equal((await call('/stage-invitations/'+invitation.token,'GET',{},null)).status,404)
  assert.equal((await call('/layout-links/'+created.data.guestToken,'GET',{},null)).status,200)
  const revoked=await call('/layouts/'+created.data.id+'/link','POST',{revision:1,disable:true})
  assert.equal(revoked.status,200)
  assert.equal((await call('/layout-links/'+created.data.guestToken,'GET',{},null)).status,404)
  assert.equal((await call('/layouts/'+created.data.id,'GET',{},users.other)).status,200)
})

test('organisation ownership and authorisation are rechecked after asynchronous request bodies',async t=>{
  const {call,users,store}=await fixture(t)
  const team=(await call('/organisations','POST',{name:'Team'})).data,base='/organisations/'+team.id
  const invited=(await call(base+'/invitations','POST',{role:'admin'})).data.invitations[0]
  await call('/organisation-invitations/'+invited.token,'POST',{},users.other)
  assert.equal((await call(base+'/members/'+users.author.id,'PUT',{role:'owner'},users.other)).status,403)
  assert.equal((await call(base+'/members/'+users.other.id,'PUT',{role:'owner'})).status,200)
  assert.equal((await call(base+'/members/'+users.other.id,'DELETE',{},users.other)).status,409)
  const response=await call(base+'/invitations','POST',()=>{store.run("UPDATE wf_members SET role='member' WHERE organisation_id=? AND user_id=?",team.id,users.author.id);return {role:'admin'}})
  assert.equal(response.status,403)
  assert.equal((await call(base+'/members/'+users.author.id,'DELETE')).status,200)
  assert.equal((await call(base,'GET')).status,404)
})

test('collaborating stage editors retain deliberately available private stock without catalogue access',async t=>{
  const {call,users}=await fixture(t)
  const team=(await call('/organisations','POST',{name:'Stage team'})).data,base='/organisations/'+team.id
  const invitation=(await call(base+'/invitations','POST',{role:'admin'})).data.invitations[0]
  await call('/organisation-invitations/'+invitation.token,'POST',{},users.other)
  await call('/equipment/selected-private','PUT',{data:equipment})
  await call('/equipment/other-private','PUT',{data:equipment})
  const source=(await call('/stages','POST',{data:{...stage,availableEquipment:[{assetId:'selected-private',quantity:3}]},organisationIds:[team.id]})).data
  assert.equal((await call('/equipment/selected-private','GET',{},users.other)).status,404)
  const edited=await call('/stages/'+source.id,'PUT',{version:1,data:{...source.data,label:'Edited stage'}},users.other)
  assert.equal(edited.status,200,edited.data.error)
  assert.equal(edited.data.data.availableEquipmentSnapshots[0].id,'selected-private')
  const forged=await call('/stages/'+source.id,'PUT',{version:2,data:{...source.data,availableEquipment:[{assetId:'other-private',quantity:1}],availableEquipmentSnapshots:[{...equipment,id:'other-private'}]}},users.other)
  assert.equal(forged.status,400,'a collaborator cannot invent grants to unrelated private equipment')
})

test('public equipment stays public when maintained by admins and generic stage editing is owner-only',async t=>{
  const {call,users}=await fixture(t),owner={...users.admin,role:'owner'}
  const publicItem=(await call('/equipment','GET',{},users.admin)).data[0]
  assert.equal(publicItem.canEdit,true)
  assert.equal((await call('/equipment/'+publicItem.id,'PUT',{revision:publicItem.revision,data:{...publicItem,label:'Maintained public item'}},users.other)).status,403)
  const updated=await call('/equipment/'+publicItem.id,'PUT',{revision:publicItem.revision,data:{...publicItem,label:'Maintained public item'}},users.admin)
  assert.equal(updated.status,200,updated.data.error);assert.equal(updated.data.ownerId,null);assert.equal(updated.data.public,true)
  assert.equal((await call('/equipment','GET',{},null)).data.find(item=>item.id===publicItem.id).label,'Maintained public item')
  const generic=(await call('/generic-stages','GET',{},owner)).data[0]
  assert.equal(generic.canEdit,true)
  const original=(await call('/stages/'+generic.id,'GET',{},owner)).data
  assert.equal((await call('/stages/'+generic.id,'PUT',{data:original.data,version:1},users.admin)).status,403)
  const updatedStage=await call('/stages/'+generic.id,'PUT',{data:{...original.data,label:'Updated generic stage'},version:1},owner)
  assert.equal(updatedStage.status,200,updatedStage.data.error)
  assert.equal((await call('/generic-stages','GET',{},null)).data.find(item=>item.id===generic.id).name,'Updated generic stage')
})

test('stage proposals publish separate versioned public sources without changing private originals',async t=>{
  const {call,users}=await fixture(t)
  const created=(await call('/stages','POST',{data:stage})).data
  assert.equal((await call('/stages/'+created.id+'/submit','POST',{version:created.version})).status,200)
  const proposal=(await call('/stage-submissions')).data[0]
  assert.equal((await call('/stage-submissions','GET',{},users.other)).data.length,0)
  assert.equal((await call('/stage-submissions/'+proposal.id,'POST',{action:'approve',revision:1},users.other)).status,403)
  assert.equal((await call('/stage-submissions/'+proposal.id,'POST',{action:'save',revision:1,data:{...stage,label:'Reviewed public stage'}},users.admin)).status,200)
  assert.equal((await call('/stage-submissions/'+proposal.id,'POST',{action:'approve',revision:2},users.admin)).status,200)
  const published=(await call('/public-stages','GET',{},null)).data[0]
  assert.notEqual(published.id,created.id);assert.equal(published.name,'Reviewed public stage');assert.equal(published.preview.boundary.nodes.length,4)
  assert.equal((await call('/stages/'+created.id)).data.name,stage.label)
  const source=(await call('/stages/'+published.id,'GET',{},users.admin)).data
  assert.equal((await call('/stages/'+published.id,'PUT',{data:source.data,version:source.version},users.other)).status,403)
  const client=await call('/stages/'+published.id+'/layouts','POST',{name:'Public stage layout'},users.other)
  assert.equal(client.status,201,client.data.error)
  assert.ok(client.data.preview.stage&&client.data.preview.data)
  await call('/stages/'+published.id,'PUT',{data:{...source.data,label:'Maintained public stage'},version:source.version},users.admin)
  assert.equal((await call('/layouts/'+client.data.id,'GET',{},users.other)).data.stageVersion,1)
  assert.equal((await call('/public-stages','GET',{},null)).data[0].version,2)
})

test('organisation stock is independent per team, includes public items and is live in referenced layouts',async t=>{
  const {call,users}=await fixture(t)
  const team=(await call('/organisations','POST',{name:'Inventory team'})).data,other=(await call('/organisations','POST',{name:'Other team'})).data
  const publicItem=(await call('/equipment','GET',{},null)).data[0]
  const stock='/organisations/'+team.id+'/stock'
  assert.equal((await call(stock,'PUT',{assetId:publicItem.id,quantity:2})).status,200)
  await call('/organisations/'+other.id+'/stock','PUT',{assetId:publicItem.id,quantity:7})
  assert.equal((await call(stock)).data[0].quantity,2)
  assert.equal((await call(stock,'PUT',{assetId:publicItem.id,quantity:-1})).status,400)
  assert.equal((await call(stock,'PUT',{assetId:publicItem.id,quantity:1},users.other)).status,404)
  const source=(await call('/stages','POST',{data:stage,organisationIds:[team.id]})).data
  const layout=(await call('/stages/'+source.id+'/layouts','POST',{name:'Organisation layout',organisationId:team.id})).data
  assert.equal(layout.equipment.find(item=>item.id===publicItem.id).stockQuantity,2)
  await call(stock,'PUT',{assetId:publicItem.id,quantity:3})
  assert.equal((await call('/layout-links/'+layout.guestToken,'GET',{},null)).data.equipment.find(item=>item.id===publicItem.id).stockQuantity,3)
  await call('/equipment/unshared-private','PUT',{data:equipment})
  assert.equal((await call(stock,'PUT',{assetId:'unshared-private',quantity:2})).status,400)
})

test('available equipment defaults to public items and an explicit selection restricts guest palettes',async t=>{
  const {call}=await fixture(t)
  await call('/equipment/selected-private','PUT',{data:equipment})
  const source=(await call('/stages','POST',{data:stage})).data
  const first=(await call('/stages/'+source.id+'/layouts','POST',{name:'Default public palette'})).data
  const defaults=(await call('/layout-links/'+first.guestToken,'GET',{},null)).data.equipment
  assert.ok(defaults.some(item=>item.id==='builtin-chair'))
  assert.equal(defaults.some(item=>item.id==='selected-private'),false)
  const updated=await call('/stages/'+source.id,'PUT',{version:1,data:{...stage,availableEquipment:[{assetId:'selected-private',quantity:null}]}})
  assert.equal(updated.status,200,updated.data.error)
  const second=(await call('/stages/'+source.id+'/layouts','POST',{name:'Selected palette'})).data
  assert.deepEqual((await call('/layout-links/'+second.guestToken,'GET',{},null)).data.equipment.map(item=>item.id),['selected-private'])
})

test('only the app owner deletes public equipment and deleted assets remain pinned in saved layouts',async t=>{
  const {call,users}=await fixture(t),owner={...users.admin,role:'owner'}
  const created=(await call('/generic-stages/generic-rehearsal/layouts','POST',{name:'Pinned equipment'})).data
  const url='/layout-links/'+created.guestToken,layout=(await call(url,'GET',{},null)).data
  const item=layout.equipment.find(item=>item.id==='builtin-chair')
  const saved=await call(url,'PUT',{revision:1,data:{...layout.data,items:[{id:1,assetId:item.id,xMeters:2,yMeters:2,rotation:0}]}},null)
  assert.equal(saved.status,200,saved.data.error)
  assert.equal((await call('/equipment/'+item.id,'DELETE',{},users.admin)).status,403)
  assert.equal((await call('/equipment/'+item.id,'DELETE',{},owner)).status,200)
  assert.equal((await call('/equipment','GET',{},null)).data.some(value=>value.id===item.id),false)
  assert.equal((await call(url,'GET',{},null)).data.data.items.length,1)
})

test('direct layouts on shared stages belong to their creator with optional stage-owner sharing and owner deletion',async t=>{
  const {call,users,store}=await fixture(t)
  const source=(await call('/stages','POST',{data:stage})).data
  await call('/stages/'+source.id+'/access','POST',{email:users.other.email,permission:'use'})
  const made=await call('/stages/'+source.id+'/layouts','POST',{name:'My layout on a shared stage'},users.other)
  assert.equal(made.status,201,made.data.error)
  const layout=made.data,base='/layouts/'+layout.id
  assert.equal(layout.ownerId,users.other.id)
  assert.equal(layout.creatorId,users.other.id)
  assert.equal(layout.creationMode,'direct')
  assert.equal(layout.canDelete,true)
  assert.equal(layout.canShareWithStageOwner,true)
  assert.equal((await call(base)).status,404,'stage ownership alone does not reveal privately created layouts')
  assert.equal((await call('/layouts')).data.length,0)
  assert.equal((await call('/layouts','GET',{},users.other)).data.length,1)
  const shared=await call(base+'/stage-owner-sharing','POST',{revision:1,shareWithStageOwner:true},users.other)
  assert.equal(shared.status,200,shared.data.error)
  const received=(await call(base)).data
  assert.equal(received.ownerId,users.other.id)
  assert.equal(received.canReview,true)
  assert.equal(received.canDelete,false)
  assert.equal(received.canManageLink,false)
  assert.equal(received.guestToken,undefined,'account sharing does not disclose the bearer edit link')
  assert.equal((await call(base,'DELETE',{revision:2})).status,403)
  assert.equal((await call(base+'/link','POST',{revision:2,disable:true})).status,403)
  assert.equal((await call(base+'/stage-owner-sharing','POST',{revision:2,shareWithStageOwner:false},users.other)).status,200)
  assert.equal((await call(base)).status,404)
  assert.equal((await call(base,'DELETE',{revision:1},users.other)).status,409)
  assert.equal((await call(base,'DELETE',{revision:3},users.other)).status,200)
  assert.equal((await call(base,'GET',{},users.other)).status,404)
  assert.equal((await call('/layout-links/'+layout.guestToken,'GET',{},null)).status,404)
  assert.equal(store.get('SELECT deleted FROM wf_layouts WHERE id=?',layout.id).deleted,1)
  assert.equal((await call('/stages/'+source.id)).data.version,1)
  assert.equal(store.get('SELECT count(*) AS n FROM wf_stages WHERE generic=0').n,1)
})

test('sharing can be selected on creation while signed-in client invitations remain organiser-owned',async t=>{
  const {call,users}=await fixture(t)
  const source=(await call('/stages','POST',{data:stage})).data
  await call('/stages/'+source.id+'/access','POST',{email:users.other.email,permission:'use'})
  const direct=await call('/stages/'+source.id+'/layouts','POST',{name:'Opted in',shareWithStageOwner:true},users.other)
  assert.equal(direct.data.ownerId,users.other.id)
  assert.equal((await call('/layouts/'+direct.data.id)).status,200)
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{})).data
  const client=await call('/stage-invitations/'+invitation.token,'POST',{name:'Registered client',registrationKey:'f'.repeat(48)},users.other)
  const layout=(await call('/layouts/'+client.data.id,'GET',{},users.other)).data
  assert.equal(layout.ownerId,users.author.id)
  assert.equal(layout.creatorId,users.other.id)
  assert.equal(layout.creationMode,'invitation')
  assert.equal(layout.canDelete,false)
  assert.equal((await call('/layouts/'+layout.id,'DELETE',{revision:1},users.other)).status,403)
  assert.equal((await call('/layouts/'+layout.id,'DELETE',{revision:1})).status,200)
  assert.equal((await call('/layout-links/'+client.data.guestToken,'GET',{},null)).status,404)
})

test('older databases gain layout lifecycle fields without guessing or changing existing ownership',async t=>{
  const {call,users,store}=await fixture(t)
  const source=(await call('/stages','POST',{data:stage})).data
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{})).data
  const created=(await call('/stage-invitations/'+invitation.token,'POST',{name:'Existing client',registrationKey:'e'.repeat(48)},users.other)).data
  for(const column of ['creation_mode','share_stage_owner','deleted'])store.db.exec('ALTER TABLE wf_layouts DROP COLUMN '+column)
  createUserWorkspace(store)
  const row=store.get('SELECT * FROM wf_layouts WHERE id=?',created.id)
  assert.equal(row.owner_id,users.author.id)
  assert.equal(row.creator_id,users.other.id)
  assert.equal(row.creation_mode,'legacy')
  assert.equal(row.share_stage_owner,0)
  assert.equal(row.deleted,0)
  assert.equal((await call('/layout-links/'+created.guestToken,'GET',{},null)).status,200)
})

test('organisation invitations save automatic venue-first sources and respect explicit client overrides',async t=>{
  const {call}=await fixture(t)
  const org=(await call('/organisations','POST',{name:'Venue stock'})).data
  await call('/organisations/'+org.id+'/stock','PUT',{assetId:'builtin-chair',quantity:2})
  const fixed={id:'fixed-chair',assetId:'builtin-chair',label:'Installed chair',widthMeters:.5,depthMeters:.5,xMeters:1,yMeters:1,rotation:0,shapes:[],collisionShapes:[]}
  const source=(await call('/stages','POST',{data:{...stage,fixedEquipment:[fixed]},organisationIds:[org.id]})).data
  const invitation=(await call('/stages/'+source.id+'/invitation','POST',{organisationId:org.id})).data
  const created=(await call('/stage-invitations/'+invitation.token,'POST',{name:'Organisation guest',registrationKey:'d'.repeat(48)},null)).data
  const endpoint='/layout-links/'+created.guestToken,opened=(await call(endpoint,'GET',{},null)).data
  const data={...opened.data,items:[1,2,3].map(id=>({id,assetId:'builtin-chair',xMeters:id+2,yMeters:2,rotation:12.6}))}
  const saved=await call(endpoint,'PUT',{data,revision:1},null)
  assert.equal(saved.status,200,saved.data.error)
  assert.deepEqual(saved.data.data.items.map(item=>item.supply),['venue','client','client'])
  assert.ok(saved.data.data.items.every(item=>item.rotation===13&&item.supplyOverride==='auto'))
  const changed={...saved.data.data,items:saved.data.data.items.map(item=>item.id===1?{...item,supplyOverride:'client'}:item)}
  const explicit=await call(endpoint,'PUT',{data:changed,revision:2},null)
  assert.deepEqual(explicit.data.data.items.map(item=>item.supply),['client','venue','client'])
  assert.equal(explicit.data.data.items[0].useExternal,true)
})
