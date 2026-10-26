import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname,basename} from 'node:path'
import {openStore} from './account-store.mjs'
import {createEventRoutes} from './event-routes.mjs'

test('reusable venue spaces support independent productions and twenty ordered eisteddfod layouts',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-venue-')),store=await openStore(directory)
  const owner={id:'venue-owner',role:'editor',empire:false},other={id:'another-owner',role:'editor',empire:false}
  for(const user of [owner,other])store.run('INSERT INTO users(id,email,name,role,password) VALUES(?,?,?,?,?)',user.id,user.id+'@test.invalid',user.id,'editor','')
  const chair={schema:'stageplot-item@3',id:'chair',label:'Orchestra chair',profiles:['external'],dimensions:{widthMeters:.5,depthMeters:.5},shapes:[],collisionShapes:[]}
  store.saveAsset('items','chair',chair,owner)
  store.saveAsset('items','mic',{...chair,id:'mic',label:'Mic stand'},owner)
  const route=createEventRoutes(store)
  const call=async(path,method='GET',input={},user=owner)=>{
    let result
    try{await route({path:'/api'+path,method,user,body:async()=>input,send:(status,data)=>{result={status,data:JSON.parse(JSON.stringify(data))}}})}catch(error){result={status:error.status||500,data:{error:error.message}}}
    return result
  }
  const shape={schema:'stageplot-stage@1',label:'Main auditorium',dimensions:{widthMeters:12,depthMeters:8},boundary:{nodes:[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}]},zones:[],textItems:[],fixedEquipment:[{id:'piano',label:'House piano',xMeters:8,yMeters:2,widthMeters:2,depthMeters:2,shapes:[]}],availableEquipment:[{assetId:'chair',quantity:40}]}
  try{
    const space=(await call('/spaces','POST',{venue:'Empire Theatre',data:shape})).data
    for(const label of ['Studio theatre','Forecourt'])assert.equal((await call('/spaces','POST',{venue:'Empire Theatre',data:{...shape,label}})).status,201)
    assert.equal((await call('/spaces')).data.length,3)
    assert.equal((await call('/events')).data.length,0,'spaces exist without events')
    assert.equal((await call('/spaces/'+space.id,'GET',{},other)).status,404)
    assert.equal((await call('/productions','POST',{name:'Wrong account',spaceId:space.id},other)).status,404)
    assert.equal((await call('/productions','POST',{name:'Missing space'})).status,400)
    const hamlet=(await call('/productions','POST',{name:'Hamlet',client:'Northside Players',spaceId:space.id,date:'2027-03-10',endDate:'2027-03-14'})).data
    const dance=(await call('/productions','POST',{name:'Dance showcase',client:'Riverside Dance',spaceId:space.id})).data
    assert.equal(hamlet.kind,'production');assert.equal(hamlet.bands.length,1)
    assert.equal(hamlet.bands[0].name,'Northside Players')
    assert.equal(hamlet.endDate,'2027-03-14')
    assert.notEqual(hamlet.stages[0].id,dance.stages[0].id)
    assert.equal(hamlet.stages[0].spaceId,space.id)
    assert.equal((await call('/productions')).data.length,2)
    assert.equal((await call('/events/'+hamlet.id+'/bands','POST',{name:'Extra client',stageId:hamlet.stages[0].id})).status,400)
    assert.equal((await call('/spaces/'+space.id,'PUT',{version:1,data:{...shape,availableEquipment:[{assetId:'chair',quantity:0}]}})).status,400)
    const updated=await call('/spaces/'+space.id,'PUT',{version:1,data:{...shape,dimensions:{widthMeters:14,depthMeters:8},availableEquipment:[{assetId:'chair',quantity:60}]}})
    assert.equal(updated.status,200);assert.equal(updated.data.version,2)
    assert.equal((await call('/spaces/'+space.id,'PUT',{version:1,data:shape})).status,409)
    const oldLayout=(await call('/event-bands/'+hamlet.bands[0].id)).data
    assert.equal(oldLayout.data.assetSnapshots.stage.dimensions.widthMeters,12)
    const preview=(await call('/event-stages/'+hamlet.stages[0].id+'/space-preview')).data
    assert.equal(preview.version,2)
    assert.equal((await call('/event-stages/'+hamlet.stages[0].id+'/apply-space','POST',{version:1,spaceVersion:2})).status,200)
    assert.equal((await call('/event-bands/'+hamlet.bands[0].id)).data.stageVersion,1,'space updates do not silently update client plots')
    assert.equal((await call('/event-stages/'+dance.stages[0].id)).data.spaceVersion,1,'other productions stay pinned')
    assert.equal((await call('/event-bands/'+hamlet.bands[0].id+'/apply-stage','POST',{revision:1,stageVersion:2})).status,200)
    assert.equal((await call('/event-bands/'+hamlet.bands[0].id)).data.data.assetSnapshots.stage.availableEquipment[0].quantity,60)

    const festival=(await call('/events','POST',{name:'Regional eisteddfod',kind:'eisteddfod',spaceId:space.id})).data
    assert.equal(festival.stages.length,1)
    const stageId=festival.stages[0].id
    const base=(await call('/events/'+festival.id+'/bands','POST',{name:'Group 01',stageId})).data
    const path='/band-links/'+base.guestToken,guest=(await call(path,'GET',{},null)).data
    assert.equal(guest.kind,'eisteddfod')
    const layout=structuredClone(guest.data)
    layout.items=[{id:100,assetId:'chair',xMeters:3,yMeters:3,rotation:0,supply:'venue'},{id:101,assetId:'mic',xMeters:4,yMeters:3,rotation:0,supply:'venue'}]
    const saved=(await call(path,'PUT',{data:layout,revision:1},null)).data
    assert.equal(saved.data.items[0].supply,'venue')
    assert.equal(saved.data.items[1].supply,'client','only listed venue stock can be claimed as venue supplied')
    const names=Array.from({length:19},(_,index)=>'Group '+String(index+2).padStart(2,'0'))
    const bulk=await call('/events/'+festival.id+'/bands','POST',{names,stageId,sourcePlotId:base.id})
    assert.equal(bulk.status,201);assert.equal(bulk.data.length,19)
    const event=(await call('/events/'+festival.id)).data
    assert.equal(event.stages.length,1);assert.equal(event.bands.length,20)
    assert.equal(new Set(event.bands.map(item=>item.guestToken)).size,20)
    assert.deepEqual(event.bands.map(item=>item.name),['Group 01',...names])
    const copied=(await call('/event-bands/'+bulk.data[0].id)).data
    assert.deepEqual(copied.data.items,saved.data.items)
    const change=structuredClone(copied.data);change.items[0].xMeters=5
    assert.equal((await call('/event-bands/'+copied.id,'PUT',{data:change,revision:1})).status,200)
    assert.equal((await call('/event-bands/'+base.id)).data.data.items[0].xMeters,3,'group layouts remain independent')
    assert.equal((await call('/events/'+festival.id+'/bands','POST',{names:['Good name',''],stageId})).status,400)
    assert.equal((await call('/events/'+festival.id)).data.bands.length,20,'bulk creation is atomic')
    assert.equal((await call('/events/'+festival.id+'/bands','POST',{name:'Wrong source',stageId,sourcePlotId:hamlet.bands[0].id})).status,400)
    const reversed=event.bands.map(item=>item.id).reverse()
    const reordered=await call('/events/'+festival.id+'/order','POST',{revision:event.revision,ids:reversed})
    assert.equal(reordered.status,200);assert.equal(reordered.data.bands[0].name,'Group 20')
    assert.equal((await call('/events/'+festival.id+'/order','POST',{revision:event.revision,ids:reversed})).status,409)
    const group20=reordered.data.bands[0]
    assert.equal((await call('/event-bands/'+group20.id+'/rename','POST',{revision:1,name:'Senior choir',slot:'Finals / 2 pm'})).status,200)
    const named=(await call('/band-links/'+group20.guestToken,'GET',{},null)).data
    assert.equal(named.slot,'Finals / 2 pm');assert.equal(named.name,'Senior choir')
    assert.equal((await call('/events/'+festival.id,'GET',{},other)).status,404)
    assert.equal((await call('/events/'+festival.id+'/order','POST',{revision:2,ids:reversed},other)).status,404)
  }finally{
    store.db.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-venue-'))
    await rm(directory,{recursive:true,force:true})
  }
})
