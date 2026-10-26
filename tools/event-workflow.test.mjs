import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname,basename} from 'node:path'
import {openStore} from './account-store.mjs'
import {createEventRoutes} from './event-routes.mjs'

test('event owners and guest bands collaborate on separate plots with protected stages and recoverable revisions',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-events-'))
  const store=await openStore(directory)
  const jimmy={id:'jimmy',role:'editor',empire:false},other={id:'other',role:'editor',empire:false}
  for(const user of [jimmy,other])store.run('INSERT INTO users VALUES(?,?,?,?,?,0,0,?)',user.id,user.id+'@test.invalid',user.id,'editor','','')
  const chair={schema:'stageplot-item@3',id:'chair',label:'Chair',profiles:['external'],dimensions:{widthMeters:1,depthMeters:1},shapes:[{id:'body',type:'rect',x:0,y:0,width:1,height:1}],collisionShapes:[]}
  store.saveAsset('items','chair',chair,jimmy)
  store.saveAsset('items','private-chair',{...chair,id:'private-chair'},other,other.id)
  const routes=createEventRoutes(store)
  const call=async(path,method='GET',input={},user=jimmy)=>{
    let response
    try{await routes({path:'/api'+path,method,user,body:async()=>input,send:(status,data)=>{response={status,data:JSON.parse(JSON.stringify(data))}}})}
    catch(error){response={status:error.status||500,data:{error:error.message}}}
    return response
  }
  try{
    assert.equal((await call('/events','GET',{},null)).status,401)
    const event=(await call('/events','POST',{name:'Summer festival',date:'2027-01-14'})).data
    assert.equal((await call('/events/'+event.id,'GET',{},other)).status,404)
    const stage={schema:'stageplot-stage@1',label:'Main stage',dimensions:{widthMeters:12,depthMeters:8},boundary:{nodes:[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}]},fixedEquipment:[{id:'kit',label:'House kit',xMeters:6,yMeters:2,widthMeters:2,depthMeters:2,shapes:[],collisionShapes:[]}],zones:[],textItems:[]}
    const createdStage=await call('/events/'+event.id+'/stages','POST',{data:stage})
    assert.equal(createdStage.status,201)
    const stageId=createdStage.data.id
    assert.equal((await call('/event-stages/'+stageId,'PUT',{version:1,data:stage},other)).status,404)
    const bandA=(await call('/events/'+event.id+'/bands','POST',{name:'Satellites',stageId})).data
    const bandB=(await call('/events/'+event.id+'/bands','POST',{name:'Paper Tigers',stageId})).data
    assert.notEqual(bandA.guestToken,bandB.guestToken)
    const guestPath='/band-links/'+bandA.guestToken
    const guest=(await call(guestPath,'GET',{},null)).data
    assert.equal(guest.name,'Satellites')
    assert.equal(guest.guestToken,undefined)
    assert.equal(guest.equipment.length,1,'unrelated personal equipment stays private')
    assert.equal(guest.data.assetSnapshots.stage.fixedEquipment.length,1)
    assert.equal((await call('/event-bands/'+bandB.id,'GET',{},other)).status,404)
    const data=structuredClone(guest.data)
    data.items.push({id:100,assetId:'chair',xMeters:3,yMeters:4,rotation:0})
    data.assetSnapshots.stage.fixedEquipment=[]
    data.stage={kind:'rectangle',width:999,depth:999}
    const saved=await call(guestPath,'PUT',{data,notes:'Two vocal mics',revision:1},null)
    assert.equal(saved.status,200)
    assert.equal(saved.data.status,'in_progress')
    assert.equal(saved.data.data.assetSnapshots.stage.fixedEquipment.length,1,'guest stage edits are ignored')
    assert.equal(saved.data.data.stage.id,stageId)
    assert.equal((await call('/event-bands/'+bandB.id)).data.data.items.length,0,'each band has its own plot')
    assert.equal((await call(guestPath,'PUT',{data,revision:1},null)).status,409,'stale writes cannot overwrite another window')
    const denied=structuredClone(saved.data.data);denied.items[0].assetId='private-chair'
    assert.equal((await call(guestPath,'PUT',{data:denied,revision:2},null)).status,400)
    const submitted=(await call(guestPath,'PUT',{data:saved.data.data,revision:2,submit:true},null)).data
    assert.equal(submitted.status,'submitted')
    const approved=(await call('/event-bands/'+bandA.id+'/review','POST',{revision:3,status:'approved',note:'Looks good'})).data
    assert.equal(approved.status,'approved')
    const changed=(await call(guestPath,'PUT',{data:approved.data,revision:4},null)).data
    assert.equal(changed.status,'changed')
    assert.equal(changed.reviewNote,'Looks good')
    assert.equal((await call('/event-stages/'+stageId,'PUT',{version:1,data:{...stage,label:'New main stage',fixedEquipment:[{...stage.fixedEquipment[0],xMeters:3,yMeters:4}]}})).status,200)
    assert.equal((await call('/event-stages/'+stageId,'PUT',{version:1,data:stage})).status,409)
    const beforeUpdate=(await call(guestPath,'GET',{},null)).data
    assert.equal(beforeUpdate.stageVersion,1)
    assert.equal(beforeUpdate.latestStageVersion,2)
    assert.equal(beforeUpdate.data.assetSnapshots.stage.fixedEquipment[0].xMeters,6)
    const preview=(await call('/event-bands/'+bandA.id+'/stage-preview')).data
    assert.deepEqual(preview.conflicts,['Chair'])
    const updated=(await call('/event-bands/'+bandA.id+'/apply-stage','POST',{revision:5,stageVersion:2})).data
    assert.equal(updated.stageVersion,2)
    assert.equal(updated.data.items[0].xMeters,3,'stage updates leave band placements alone')
    assert.equal(updated.status,'changes_requested')
    assert.equal((await call('/event-bands/'+bandB.id)).data.stageVersion,1,'updates are deliberately per plot')
    const history=(await call('/event-bands/'+bandA.id+'/history')).data
    assert.equal(history.length,6)
    const restored=(await call('/event-bands/'+bandA.id+'/restore','POST',{revision:6,restoreRevision:2})).data
    assert.equal(restored.revision,7)
    assert.equal(restored.stageVersion,1)
    assert.equal(restored.notes,'Two vocal mics')
    const renamed=(await call('/event-bands/'+bandA.id+'/rename','POST',{revision:7,name:'The Satellites'})).data
    assert.equal(renamed.name,'The Satellites')
    assert.equal((await call(guestPath,'GET',{},null)).data.name,'The Satellites')
    const replacement=(await call('/event-bands/'+bandA.id+'/link','POST',{revision:8})).data
    assert.notEqual(replacement.guestToken,bandA.guestToken)
    assert.equal((await call(guestPath,'GET',{},null)).status,404)
    assert.equal((await call(guestPath,'PUT',{data:restored.data,revision:8},null)).status,404)
    await call('/event-bands/'+bandA.id+'/link','POST',{revision:8,disable:true})
    assert.equal((await call('/band-links/'+replacement.guestToken,'GET',{},null)).status,404)
    assert.equal((await call('/event-bands/'+bandA.id)).status,200,'revoking links preserves organiser access')
    assert.equal((await call('/events/'+event.id)).data.bands.length,2)

    // Saving notes preserves pinned artwork; explicit refresh can adopt a known
    // new catalogue revision without trusting client-supplied shapes.
    const bPath='/band-links/'+bandB.guestToken,bData=structuredClone(bandB.data)
    bData.items=[{id:100,assetId:'chair',xMeters:1,yMeters:1,rotation:0}]
    const bSaved=(await call(bPath,'PUT',{data:bData,revision:1},null)).data
    const newChair=store.saveAsset('items','chair',{...chair,dimensions:{widthMeters:2,depthMeters:1}},jimmy)
    const bPinned=(await call(bPath,'PUT',{data:bSaved.data,revision:2,notes:'Notes only'},null)).data
    assert.equal(bPinned.data.assetSnapshots.equipment[0].dimensions.widthMeters,1)
    const bRefresh=structuredClone(bPinned.data)
    bRefresh.assetSnapshots.equipment=[{...newChair,dimensions:{widthMeters:999,depthMeters:999}}]
    const refreshed=(await call(bPath,'PUT',{data:bRefresh,revision:3},null)).data
    assert.equal(refreshed.data.assetSnapshots.equipment[0].dimensions.widthMeters,2)
    assert.equal(refreshed.data.assetSnapshots.equipment[0].stockQuantity,null,'external palettes do not expose stock quantities')

    let releaseSave,guestResponse
    const pendingSave=routes({path:'/api'+bPath,method:'PUT',user:null,body:()=>new Promise(resolve=>{releaseSave=resolve}),send:(status,data)=>{guestResponse={status,data}}}).catch(error=>{guestResponse={status:error.status}})
    await call('/event-bands/'+bandB.id+'/link','POST',{revision:4,disable:true})
    releaseSave({data:refreshed.data,revision:4});await pendingSave
    assert.equal(guestResponse.status,404,'revocation is rechecked after an in-flight request body arrives')

    let releaseDetails,eventResponse
    const pendingDetails=routes({path:'/api/events/'+event.id,method:'PUT',user:jimmy,body:()=>new Promise(resolve=>{releaseDetails=resolve}),send:(status,data)=>{eventResponse={status,data}}}).catch(error=>{eventResponse={status:error.status}})
    await call('/events/'+event.id,'PUT',{revision:1,name:'Latest festival'})
    releaseDetails({revision:1,name:'Stale festival'});await pendingDetails
    assert.equal(eventResponse.status,409,'event metadata also uses the latest stored revision')
    assert.equal((await call('/events/'+event.id)).data.name,'Latest festival')
  }finally{
    store.db.close()
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-events-'))
    await rm(directory,{recursive:true,force:true})
  }
})
