import {uid,token,fail} from './account-store.mjs'
import {assetProfiles,isEquipmentItem,profileItem} from './library-membership.mjs'
import {assetSnapshot,pinProject} from '../src/project-snapshots.js'
import {stageSpace,projectFile,resolveProject} from '../src/project-file.js'
import {sampleStageBoundary} from '../src/stage-geometry.js'
import {validFixedEquipment} from '../src/stage-equipment.js'
import {isItemInsideSpace,itemsCollide,collisionPolygons,polygonsIntersect} from '../src/geometry.js'

export function createEventRoutes(store) {
  const {db,get,all,run,transaction}=store
  db.exec(`CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,date TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',profile TEXT NOT NULL DEFAULT 'external',revision INTEGER NOT NULL,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS event_stages(id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,name TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS event_stage_versions(stage_id TEXT NOT NULL REFERENCES event_stages(id) ON DELETE CASCADE,version INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(stage_id,version));
    CREATE TABLE IF NOT EXISTS event_bands(id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,stage_id TEXT NOT NULL REFERENCES event_stages(id),name TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,guest_token TEXT UNIQUE,notes TEXT NOT NULL DEFAULT '',review_note TEXT NOT NULL DEFAULT '',updated TEXT NOT NULL,stage_version INTEGER NOT NULL,submitted_revision INTEGER);
    CREATE TABLE IF NOT EXISTS event_band_revisions(band_id TEXT NOT NULL REFERENCES event_bands(id) ON DELETE CASCADE,revision INTEGER NOT NULL,snapshot TEXT NOT NULL,actor TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(band_id,revision));
    CREATE INDEX IF NOT EXISTS events_owner ON events(owner_id);
    CREATE INDEX IF NOT EXISTS event_stages_event ON event_stages(event_id);
    CREATE INDEX IF NOT EXISTS event_bands_event ON event_bands(event_id);`)
  const column=(table,key,definition)=>{if(!all(`PRAGMA table_info(${table})`).some(entry=>entry.name===key))db.exec(`ALTER TABLE ${table} ADD COLUMN ${key} ${definition}`)}
  column('events','kind',"TEXT NOT NULL DEFAULT 'festival'")
  column('events','client',"TEXT NOT NULL DEFAULT ''")
  column('events','end_date',"TEXT NOT NULL DEFAULT ''")
  column('events','invitation_token','TEXT')
  column('event_bands','registration_key','TEXT')
  column('event_stages','space_id','TEXT')
  column('event_stages','space_version','INTEGER')
  column('event_bands','sort_order','INTEGER NOT NULL DEFAULT 0')
  column('event_bands','slot',"TEXT NOT NULL DEFAULT ''")
  db.exec(`CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,venue TEXT NOT NULL DEFAULT '',profile TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS space_versions(space_id TEXT NOT NULL REFERENCES spaces(id),version INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(space_id,version));
    CREATE INDEX IF NOT EXISTS spaces_owner ON spaces(owner_id);`)
  db.exec(`CREATE TABLE IF NOT EXISTS space_access(space_id TEXT NOT NULL REFERENCES spaces(id),user_id TEXT NOT NULL REFERENCES users(id),permission TEXT NOT NULL,PRIMARY KEY(space_id,user_id));
    CREATE TABLE IF NOT EXISTS space_links(space_id TEXT NOT NULL REFERENCES spaces(id),permission TEXT NOT NULL,token TEXT UNIQUE NOT NULL,PRIMARY KEY(space_id,permission));
    CREATE UNIQUE INDEX IF NOT EXISTS event_registration ON event_bands(event_id,registration_key) WHERE registration_key IS NOT NULL;`)
  const firstManagedMigration=!get("SELECT name FROM sqlite_master WHERE type='table' AND name='administrative_stages'")
  db.exec(`CREATE TABLE IF NOT EXISTS administrative_stages(space_id TEXT PRIMARY KEY REFERENCES spaces(id));CREATE TABLE IF NOT EXISTS revoked_stage_access(space_id TEXT NOT NULL REFERENCES spaces(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(space_id,user_id));`)
  if(firstManagedMigration)run("INSERT OR IGNORE INTO administrative_stages SELECT s.id FROM spaces s JOIN users u ON u.id=s.owner_id WHERE u.role IN ('owner','admin')")
  const now=()=>new Date().toISOString()
  const name=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>200)fail(400,'Enter a name of up to 200 characters');return value.trim()}
  const note=value=>{if(typeof value!=='string'||value.length>10000)fail(400,'Notes must be text of up to 10,000 characters');return value}
  const ownerEvent=(id,user)=>{if(!user)fail(401,'Sign in to manage your events');const event=get('SELECT * FROM events WHERE id=? AND owner_id=?',id,user.id);if(!event)fail(404,'Event not found');if(event.profile==='empire'&&!user.empire)fail(403,'Empire access is required');return event}
  const manager=user=>['owner','admin'].includes(user?.role)
  const spacePermission=(space,user)=>{
    if(space.owner_id===user.id||manager(user)&&get('SELECT space_id FROM administrative_stages WHERE space_id=?',space.id))return 'manage'
    return get('SELECT permission FROM space_access WHERE space_id=? AND user_id=?',space.id,user.id)?.permission||null
  }
  const ownerSpace=(id,user)=>{if(!user)fail(401,'Sign in to access stages');const space=get('SELECT * FROM spaces WHERE id=?',id);if(!space||!spacePermission(space,user))fail(404,'Stage not found');if(space.profile==='empire'&&!user.empire)fail(403,'Empire access is required');return space}
  const manageSpace=(id,user)=>{const space=ownerSpace(id,user);if(spacePermission(space,user)!=='manage')fail(403,'Only the stage owner or its administrators can manage access');return space}
  const publicSpace=(space,includeData=false,user=null)=>({id:space.id,name:space.name,venue:space.venue,profile:space.profile,version:space.version,updated:space.updated,ownerName:get('SELECT name FROM users WHERE id=?',space.owner_id)?.name||'Stage owner',permission:user?spacePermission(space,user):undefined,dimensions:JSON.parse(space.data).dimensions,equipmentCount:(JSON.parse(space.data).fixedEquipment||[]).length,...(includeData?{data:JSON.parse(space.data)}:{})})
  const stageRow=id=>{const stage=get('SELECT * FROM event_stages WHERE id=?',id);if(!stage)fail(404,'Stage not found');return stage}
  const bandRow=id=>{const band=get('SELECT * FROM event_bands WHERE id=?',id);if(!band)fail(404,'Band plot not found');return band}
  const equipment=event=>all("SELECT * FROM assets WHERE kind='items' AND deleted=0 AND owner_id IS NULL").map(row=>JSON.parse(row.data)).filter(item=>isEquipmentItem(item)&&assetProfiles(item).includes(event.profile)).map(item=>assetSnapshot(profileItem(item,event.profile)))
  const stageData=(input,id,event)=>{
    if(input?.schema!=='stageplot-stage@1'||!input.dimensions||![input.dimensions.widthMeters,input.dimensions.depthMeters].every(value=>Number.isFinite(value)&&value>0&&value<=1000))fail(400,'Stage dimensions must be between 0 and 1000 metres')
    if(!Array.isArray(input.boundary?.nodes)||input.boundary.nodes.length<3||input.boundary.nodes.some(node=>!Number.isFinite(node.x)||!Number.isFinite(node.y)))fail(400,'A stage boundary needs at least three valid points')
    if(!validFixedEquipment(input.fixedEquipment))fail(400,'Invalid fixed stage equipment')
    if(input.availableEquipment!==undefined&&(!Array.isArray(input.availableEquipment)||new Set(input.availableEquipment.map(item=>item?.assetId)).size!==input.availableEquipment.length||input.availableEquipment.some(item=>!item||typeof item.assetId!=='string'||!Number.isSafeInteger(item.quantity)||item.quantity<1||!equipment(event).some(asset=>asset.id===item.assetId))))fail(400,'Available venue equipment must use published equipment and positive whole quantities')
    return {...input,id,label:name(input.label),profiles:[event.profile],visibility:'draft',collisionBoundary:sampleStageBoundary(input.boundary.nodes)}
  }
  const initialPlot=(stage,label)=>{const space=stageSpace(stage);return pinProject({...projectFile(label,space,[]),profile:stage.profiles[0]},space,[])}
  const publicBand=(band,owned=false)=>{
    const event=get('SELECT * FROM events WHERE id=?',band.event_id),stage=stageRow(band.stage_id)
    return {id:band.id,eventId:band.event_id,eventName:event.name,kind:event.kind,client:event.client,slot:band.slot,order:band.sort_order,stageId:band.stage_id,stageName:stage.name,name:band.name,data:JSON.parse(band.data),revision:band.revision,status:band.status,notes:band.notes,reviewNote:band.review_note,updated:band.updated,stageVersion:band.stage_version,latestStageVersion:stage.version,owned,...(owned?{guestToken:band.guest_token}:{}),profile:event.profile}
  }
  const record=(id,actor)=>{const band=bandRow(id);const snapshot={...publicBand(band),submittedRevision:band.submitted_revision};run('INSERT INTO event_band_revisions VALUES(?,?,?,?,?)',id,band.revision,JSON.stringify(snapshot),actor,band.updated)}
  const summary=event=>({...event,endDate:event.end_date,owner_id:undefined,invitation_token:undefined,invitationToken:event.invitation_token||null,stages:all('SELECT * FROM event_stages WHERE event_id=? ORDER BY name',event.id).map(stage=>({id:stage.id,name:stage.name,version:stage.version,spaceId:stage.space_id,spaceVersion:stage.space_version,latestSpaceVersion:stage.space_id?get('SELECT version FROM spaces WHERE id=?',stage.space_id)?.version:null,dimensions:JSON.parse(stage.data).dimensions,equipmentCount:(JSON.parse(stage.data).fixedEquipment||[]).length})),bands:all('SELECT * FROM event_bands WHERE event_id=? ORDER BY sort_order,name',event.id).map(band=>{const value=publicBand(band,true);delete value.data;return value})})
  const attachSpace=(event,space,label)=>{
    if(space.profile!==event.profile)fail(400,'Choose a space from the same equipment library')
    const id='event-stage-'+uid(),data=stageData({...JSON.parse(space.data),...(label?{label}: {})},id,event)
    run('INSERT INTO event_stages(id,event_id,name,data,version,space_id,space_version) VALUES(?,?,?,?,?,?,?)',id,event.id,data.label,JSON.stringify(data),1,space.id,space.version)
    run('INSERT INTO event_stage_versions VALUES(?,?,?)',id,1,JSON.stringify(data));return stageRow(id)
  }
  const createLayouts=(event,input)=>{
    const stage=stageRow(input.stageId);if(stage.event_id!==event.id)fail(404,'Stage not found')
    const names=input.names===undefined?[input.name]:input.names
    if(!Array.isArray(names)||!names.length||names.length>100)fail(400,'Enter between 1 and 100 layout names')
    const labels=names.map(name),source=input.sourcePlotId?bandRow(input.sourcePlotId):null
    if(source&&(source.event_id!==event.id||source.stage_id!==stage.id))fail(400,'Copy a layout from the same event and stage')
    const first=get('SELECT COALESCE(MAX(sort_order),-1)+1 AS position FROM event_bands WHERE event_id=?',event.id).position
    return labels.map((label,index)=>{
      const id=uid(),data=source?JSON.parse(source.data):initialPlot(JSON.parse(stage.data),label);data.project=label
      run('INSERT INTO event_bands(id,event_id,stage_id,name,data,revision,status,guest_token,notes,review_note,updated,stage_version,submitted_revision,sort_order,slot) VALUES(?,?,?,?,?,1,?,?,?,?,?,?,NULL,?,?)',id,event.id,stage.id,label,JSON.stringify(data),'awaiting_band',token(),note(input.notes??source?.notes??''),'',now(),source?.stage_version??stage.version,first+index,String(input.slot||'').slice(0,200))
      record(id,'organiser');return publicBand(bandRow(id),true)
    })
  }
  const canonicalPlot=(data,band,event)=>{
    if(data?.version!==2||!Array.isArray(data.items)||data.items.length>2000)fail(400,'Invalid band plot')
    const previous=JSON.parse(band.data),stage=previous.assetSnapshots.stage
    const assets=new Map(equipment(event).map(item=>[item.id,item]))
    // Keep pinned artwork unless the client explicitly refreshed to a known
    // catalogue revision. Client-supplied geometry is never authoritative.
    for(const item of previous.assetSnapshots.equipment||[]){
      const current=assets.get(item.id),requested=data.assetSnapshots?.equipment?.find(candidate=>candidate.id===item.id)
      if(!current||requested?.revision!==current.revision)assets.set(item.id,{...item,stockQuantity:current?.stockQuantity??null})
    }
    if(data.items.some(item=>!item||!Number.isFinite(item.xMeters)||!Number.isFinite(item.yMeters)||!Number.isFinite(item.rotation??0)||item.custom&&!['staging','text'].includes(item.custom.type)||!item.custom&&!assets.has(item.assetId)))fail(400,'The plot contains invalid or unavailable equipment')
    const constrained={...data,stage:{...previous.stage,partVisibility:data.stage?.partVisibility||previous.stage.partVisibility},profile:event.profile,assetSnapshots:{stage,equipment:[...assets.values()]}}
    const resolved=resolveProject(constrained,[...assets.values()],[stage])
    const venueItems=new Set((stage.availableEquipment||[]).map(item=>item.assetId))
    resolved.items=resolved.items.map(item=>({...item,supply:item.supply==='venue'&&venueItems.has(item.assetId)?'venue':'client'}))
    return pinProject({...projectFile(band.name,resolved.space,resolved.items,resolved.preset,resolved.collisionSettings,resolved.layerFolders),profile:event.profile},resolved.space,resolved.items)
  }
  const saveBand=(id,input,actor,guest=false,guestToken=null)=>transaction(()=>{
    const band=bandRow(id),event=get('SELECT * FROM events WHERE id=?',band.event_id)
    if(guest&&band.guest_token!==guestToken)fail(404,'This band link has been revoked. Ask the organiser for a new link.')
    if(input.revision!==band.revision)fail(409,'This plot was updated in another window. Reload the latest version before saving; your local work has been kept.')
    const data=canonicalPlot(input.data,band,event),revision=band.revision+1,status=input.submit?'submitted':band.submitted_revision?'changed':'in_progress'
    run('UPDATE event_bands SET data=?,notes=?,revision=?,status=?,updated=?,submitted_revision=? WHERE id=?',JSON.stringify(data),input.notes===undefined?band.notes:note(input.notes),revision,status,now(),input.submit?revision:band.submitted_revision,id)
    record(id,actor);return publicBand(bandRow(id),!guest)
  })
  const conflicts=(band,stage)=>{
    const data=JSON.parse(band.data),resolved=resolveProject(data,data.assetSnapshots.equipment||[],[])
    return resolved.items.filter(item=>!isItemInsideSpace(item,stage.collisionBoundary)||(stage.fixedEquipment||[]).some(fixed=>fixed.collisionEnabled!==false&&itemsCollide(item,fixed))||(stage.zones||[]).some(zone=>zone.solid&&zone.nodes?.length>=3&&collisionPolygons(item).some(polygon=>polygonsIntersect(polygon,zone.collisionBoundary||sampleStageBoundary(zone.nodes))))).map(item=>item.label)
  }
  return async({path,method,user,body,send})=>{
    if(!/^\/api\/(events|productions|spaces|space-links|event-invitations|event-stages|event-bands|band-links)(\/|$)/.test(path))return false
    const reply=(status,data)=>{send(status,data);return true}
    const guest=path.match(/^\/api\/band-links\/([a-f0-9]{48})$/)
    if(guest){
      const band=get('SELECT * FROM event_bands WHERE guest_token=?',guest[1]);if(!band)fail(404,'This band link has been revoked or is unavailable. Ask the organiser for a new link.')
      if(method==='GET'){const event=get('SELECT * FROM events WHERE id=?',band.event_id);return reply(200,{...publicBand(band),equipment:equipment(event),groups:JSON.parse(get("SELECT value FROM settings WHERE key='groups'")?.value||'[]')})}
      if(method==='PUT')return reply(200,saveBand(band.id,await body(),'band',true,guest[1]))
      fail(405,'Method not allowed')
    }
    const invitation=path.match(/^\/api\/event-invitations\/([a-f0-9]{48})$/)
    if(invitation){
      const event=get('SELECT * FROM events WHERE invitation_token=?',invitation[1]);if(!event||event.kind==='production')fail(404,'This invitation is no longer available. Ask the organiser for a current link.')
      if(method==='GET')return reply(200,{name:event.name,kind:event.kind,date:event.date,stages:all('SELECT id,name FROM event_stages WHERE event_id=? ORDER BY name',event.id)})
      if(method==='POST'){
        const input=await body();name(input.name)
        if(typeof input.registrationKey!=='string'||!/^[a-f0-9-]{32,64}$/.test(input.registrationKey))fail(400,'Start a new registration from the invitation page')
        const result=transaction(()=>{
          const current=get('SELECT invitation_token FROM events WHERE id=?',event.id);if(current?.invitation_token!==invitation[1])fail(404,'This invitation is no longer available')
          const existing=get('SELECT * FROM event_bands WHERE event_id=? AND registration_key=?',event.id,input.registrationKey)
          if(existing){if(!existing.guest_token)fail(404,'This edit link is no longer available');return {name:existing.name,guestToken:existing.guest_token}}
          const created=createLayouts(event,{name:input.name,stageId:input.stageId})[0]
          run('UPDATE event_bands SET registration_key=? WHERE id=?',input.registrationKey,created.id);run('UPDATE events SET updated=? WHERE id=?',now(),event.id)
          return {name:created.name,guestToken:created.guestToken}
        });return reply(201,result)
      }
      fail(405,'Method not allowed')
    }
    const sharedSpace=path.match(/^\/api\/space-links\/([a-f0-9]{48})$/)
    if(sharedSpace){
      const link=get('SELECT * FROM space_links WHERE token=?',sharedSpace[1]);if(!link)fail(404,'This stage invitation is no longer available')
      const space=get('SELECT * FROM spaces WHERE id=?',link.space_id);if(!space)fail(404,'Stage not found')
      if(method==='GET')return reply(200,{name:space.name,venue:space.venue,permission:link.permission,ownerName:get('SELECT name FROM users WHERE id=?',space.owner_id)?.name||'Stage owner'})
      if(!user)fail(401,'Sign in to accept this shared stage')
      if(method==='POST'){
        if(space.profile==='empire'&&!user.empire)fail(403,'Empire access is required')
        transaction(()=>{if(get('SELECT user_id FROM revoked_stage_access WHERE space_id=? AND user_id=?',space.id,user.id))fail(403,'Your access was removed. Ask the stage owner to grant access again.');const current=get('SELECT token FROM space_links WHERE space_id=? AND permission=?',space.id,link.permission);if(current?.token!==sharedSpace[1])fail(404,'This stage invitation is no longer available');const access=spacePermission(space,user);if(!['edit','manage'].includes(access))run('INSERT INTO space_access(space_id,user_id,permission) VALUES(?,?,?) ON CONFLICT(space_id,user_id) DO UPDATE SET permission=excluded.permission',space.id,user.id,link.permission)})
        return reply(200,publicSpace(space,true,user))
      }
      fail(405,'Method not allowed')
    }
    if(!user)fail(401,'Sign in to manage your events')
    if(path==='/api/spaces'){
      if(method==='GET')return reply(200,all('SELECT * FROM spaces ORDER BY venue,name').filter(space=>spacePermission(space,user)&&(space.profile!=='empire'||user.empire)).map(space=>publicSpace(space,false,user)))
      if(method==='POST'){
        const input=await body(),profile=input.profile||'external',id='space-'+uid()
        if(!['external','empire'].includes(profile)||profile==='empire'&&!user.empire)fail(403,'This library profile is unavailable')
        const data=stageData(input.data,id,{profile})
        transaction(()=>{run('INSERT INTO spaces VALUES(?,?,?,?,?,?,?,?)',id,user.id,data.label,String(input.venue||'').slice(0,200),profile,JSON.stringify(data),1,now());run('INSERT INTO space_versions VALUES(?,?,?)',id,1,JSON.stringify(data));if(manager(user))run('INSERT INTO administrative_stages VALUES(?)',id)})
        return reply(201,publicSpace(ownerSpace(id,user),true,user))
      }
    }
    const accessPath=path.match(/^\/api\/spaces\/(space-[a-f0-9]+)\/access$/)
    if(accessPath){
      const space=manageSpace(accessPath[1],user)
      const access=()=>({members:all('SELECT a.user_id AS userId,a.permission,u.name,u.email FROM space_access a JOIN users u ON u.id=a.user_id WHERE a.space_id=? ORDER BY u.name',space.id),links:all('SELECT permission,token FROM space_links WHERE space_id=?',space.id)})
      if(method==='GET')return reply(200,access())
      if(method==='POST'){
        const input=await body();if(!['use','edit'].includes(input.permission))fail(400,'Choose can use or can edit')
        if(input.link){if(input.disable)run('DELETE FROM space_links WHERE space_id=? AND permission=?',space.id,input.permission);else run('INSERT INTO space_links VALUES(?,?,?) ON CONFLICT(space_id,permission) DO UPDATE SET token=excluded.token',space.id,input.permission,token())}
        else {
          const identifier=String(input.user||'').trim(),recipient=get('SELECT * FROM users WHERE disabled=0 AND (id=? OR email=? COLLATE NOCASE)',identifier,identifier)||(get("SELECT name FROM sqlite_master WHERE type='table' AND name='github_identities'")?get('SELECT u.* FROM users u JOIN github_identities g ON g.user_id=u.id WHERE u.disabled=0 AND g.login=? COLLATE NOCASE',identifier.replace(/^@/,'')):null)
          if(!recipient)fail(404,'No active account matches that email or GitHub username')
          if(recipient.id===space.owner_id)fail(400,'The owner already has access')
          if(space.profile==='empire'&&!recipient.empire)fail(403,'That account needs Empire access first')
          transaction(()=>{if(input.disable){run('DELETE FROM space_access WHERE space_id=? AND user_id=?',space.id,recipient.id);run('INSERT OR IGNORE INTO revoked_stage_access VALUES(?,?)',space.id,recipient.id)}else {run('DELETE FROM revoked_stage_access WHERE space_id=? AND user_id=?',space.id,recipient.id);run('INSERT INTO space_access VALUES(?,?,?) ON CONFLICT(space_id,user_id) DO UPDATE SET permission=excluded.permission',space.id,recipient.id,input.permission)}})
        }
        return reply(200,access())
      }
      fail(405,'Method not allowed')
    }
    const spacePath=path.match(/^\/api\/spaces\/(space-[a-f0-9]+)$/)
    if(spacePath){
      const space=ownerSpace(spacePath[1],user)
      if(method==='GET')return reply(200,publicSpace(space,true,user))
      if(method==='PUT'){
        if(!['manage','edit'].includes(spacePermission(space,user)))fail(403,'This stage is shared for use only')
        const input=await body(),data=stageData(input.data,space.id,space)
        const saved=transaction(()=>{const current=ownerSpace(space.id,user);if(!['manage','edit'].includes(spacePermission(current,user)))fail(403,'Stage editing access was removed');if(input.version!==current.version)fail(409,'Space changed. Reopen it before saving');run('UPDATE spaces SET name=?,venue=?,data=?,version=version+1,updated=? WHERE id=?',data.label,String(input.venue??current.venue).slice(0,200),JSON.stringify(data),now(),space.id);run('INSERT INTO space_versions VALUES(?,?,?)',space.id,current.version+1,JSON.stringify(data));return publicSpace(ownerSpace(space.id,user),true,user)})
        return reply(200,saved)
      }
    }
    if(path==='/api/events'||path==='/api/productions'){
      const productionRoute=path==='/api/productions'
      if(method==='GET'&&productionRoute)return reply(200,all("SELECT * FROM events WHERE owner_id=? AND kind='production' ORDER BY updated DESC",user.id).filter(event=>event.profile!=='empire'||user.empire).map(summary))
      if(method==='GET')return reply(200,all('SELECT * FROM events WHERE owner_id=? ORDER BY updated DESC',user.id).filter(event=>event.profile!=='empire'||user.empire).map(summary))
      if(method==='POST'){
        const input=await body(),id=uid(),kind=productionRoute?'production':input.kind||'festival',space=input.spaceId?ownerSpace(input.spaceId,user):null,profile=space?.profile||input.profile||'external'
        if(!['festival','eisteddfod','production'].includes(kind))fail(400,'Choose festival, eisteddfod or production')
        if(kind==='production'&&!space)fail(400,'Choose a reusable space for this production')
        if(!['external','empire'].includes(profile)||profile==='empire'&&!user.empire)fail(403,'This library profile is unavailable')
        const result=transaction(()=>{
          run('INSERT INTO events(id,owner_id,name,date,notes,profile,revision,updated,kind,client,end_date) VALUES(?,?,?,?,?,?,1,?,?,?,?)',id,user.id,name(input.name),String(input.date||'').slice(0,30),note(input.notes||''),profile,now(),kind,String(input.client||'').slice(0,200),String(input.endDate||'').slice(0,30))
          const event=ownerEvent(id,user)
          if(space){const stage=attachSpace(event,space);if(kind==='production')createLayouts(event,{stageId:stage.id,name:input.client||input.name})}
          return summary(event)
        });return reply(201,result)
      }
    }
    const eventPath=path.match(/^\/api\/events\/([a-f0-9]+)(?:\/(stages|bands|order|invitation))?$/)
    if(eventPath){
      const [,id,collection]=eventPath,event=ownerEvent(id,user)
      if(!collection&&method==='GET')return reply(200,summary(event))
      if(!collection&&method==='PUT'){const input=await body();const result=transaction(()=>{const current=ownerEvent(id,user);if(input.revision!==current.revision)fail(409,'Event details changed. Refresh before saving');run('UPDATE events SET name=?,date=?,notes=?,client=?,end_date=?,revision=revision+1,updated=? WHERE id=?',name(input.name),String(input.date||'').slice(0,30),note(input.notes||''),String(input.client??current.client).slice(0,200),String(input.endDate??current.end_date).slice(0,30),now(),id);return summary(ownerEvent(id,user))});return reply(200,result)}
      if(collection==='invitation'&&method==='POST'){
        if(event.kind==='production')fail(400,'Productions use their individual client link')
        const input=await body();const result=transaction(()=>{const current=ownerEvent(id,user);if(input.revision!==current.revision)fail(409,'Event changed. Refresh before changing its invitation');run('UPDATE events SET invitation_token=?,revision=revision+1,updated=? WHERE id=?',input.disable?null:token(),now(),id);return summary(ownerEvent(id,user))});return reply(200,result)
      }
      if(collection==='order'&&method==='POST'){
        const input=await body();const result=transaction(()=>{
          const current=ownerEvent(id,user),ids=all('SELECT id FROM event_bands WHERE event_id=?',id).map(band=>band.id)
          if(input.revision!==current.revision)fail(409,'The running order changed. Refresh before continuing')
          if(!Array.isArray(input.ids)||input.ids.length!==ids.length||new Set(input.ids).size!==ids.length||input.ids.some(value=>!ids.includes(value)))fail(400,'Include each layout exactly once in the running order')
          input.ids.forEach((bandId,index)=>run('UPDATE event_bands SET sort_order=? WHERE id=?',index,bandId))
          run('UPDATE events SET revision=revision+1,updated=? WHERE id=?',now(),id);return summary(ownerEvent(id,user))
        });return reply(200,result)
      }
      if(collection==='stages'&&method==='POST'){
        if(event.kind==='production')fail(400,'A production uses its assigned space')
        const input=await body()
        if(input.spaceId){const space=ownerSpace(input.spaceId,user),stage=transaction(()=>attachSpace(event,space,input.name));return reply(201,{id:stage.id,eventId:id,name:stage.name,data:JSON.parse(stage.data),version:stage.version})}
        const stageId='event-stage-'+uid(),data=stageData(input.data,stageId,event)
        transaction(()=>{run('INSERT INTO event_stages(id,event_id,name,data,version) VALUES(?,?,?,?,?)',stageId,id,data.label,JSON.stringify(data),1);run('INSERT INTO event_stage_versions VALUES(?,?,?)',stageId,1,JSON.stringify(data))});return reply(201,{id:stageId,eventId:id,name:data.label,data,version:1})
      }
      if(collection==='bands'&&method==='POST'){
        if(event.kind==='production')fail(400,'Open the production client layout')
        const input=await body(),created=transaction(()=>{const result=createLayouts(event,input);run('UPDATE events SET updated=? WHERE id=?',now(),id);return result})
        return reply(201,input.names?created:created[0])
      }
    }
    const stagePath=path.match(/^\/api\/event-stages\/(event-stage-[a-f0-9]+)(?:\/(space-preview|apply-space|save-space))?$/)
    if(stagePath){
      const stage=stageRow(stagePath[1]),event=ownerEvent(stage.event_id,user),action=stagePath[2]
      if(!action&&method==='GET')return reply(200,{id:stage.id,eventId:event.id,eventName:event.name,name:stage.name,data:JSON.parse(stage.data),version:stage.version,spaceId:stage.space_id,spaceVersion:stage.space_version})
      if(!action&&method==='PUT'){const input=await body(),data=stageData(input.data,stage.id,event);const result=transaction(()=>{const current=stageRow(stage.id);if(input.version!==current.version)fail(409,'Stage changed. Reopen it before saving');const version=current.version+1;run('UPDATE event_stages SET name=?,data=?,version=? WHERE id=?',data.label,JSON.stringify(data),version,stage.id);run('INSERT INTO event_stage_versions VALUES(?,?,?)',stage.id,version,JSON.stringify(data));return {id:stage.id,eventId:event.id,name:data.label,data,version}});return reply(200,result)}
      if(action==='space-preview'&&method==='GET'){
        const space=ownerSpace(stage.space_id,user),source=JSON.parse(space.data),current=JSON.parse(stage.data)
        return reply(200,{spaceId:space.id,name:space.name,version:space.version,currentVersion:stage.space_version,dimensions:source.dimensions,equipmentCount:(source.fixedEquipment||[]).length,localChanges:JSON.stringify({...current,id:space.id})!==JSON.stringify(source)})
      }
      if(action==='apply-space'&&method==='POST'){
        const input=await body(),result=transaction(()=>{
          const current=stageRow(stage.id),space=ownerSpace(current.space_id,user)
          if(input.version!==current.version||input.spaceVersion!==space.version)fail(409,'The stage or space changed. Preview the update again')
          const data=stageData(JSON.parse(space.data),stage.id,event),version=current.version+1
          run('UPDATE event_stages SET name=?,data=?,version=?,space_version=? WHERE id=?',data.label,JSON.stringify(data),version,space.version,stage.id);run('INSERT INTO event_stage_versions VALUES(?,?,?)',stage.id,version,JSON.stringify(data))
          return {id:stage.id,eventId:event.id,data,version}
        });return reply(200,result)
      }
      if(action==='save-space'&&method==='POST'){
        const input=await body(),result=transaction(()=>{
          const current=stageRow(stage.id);if(input.version!==current.version)fail(409,'Stage changed. Refresh before saving a reusable space')
          const id='space-'+uid(),data=stageData({...JSON.parse(current.data),label:input.name||current.name},id,event)
          run('INSERT INTO spaces VALUES(?,?,?,?,?,?,?,?)',id,user.id,data.label,String(input.venue||'').slice(0,200),event.profile,JSON.stringify(data),1,now());run('INSERT INTO space_versions VALUES(?,?,?)',id,1,JSON.stringify(data));run('UPDATE event_stages SET space_id=?,space_version=1 WHERE id=?',id,current.id)
          return publicSpace(ownerSpace(id,user),true,user)
        });return reply(201,result)
      }
    }
    const bandPath=path.match(/^\/api\/event-bands\/([a-f0-9]+)(?:\/(link|review|stage-preview|apply-stage|history|restore|rename))?$/)
    if(bandPath){
      const [,id,action]=bandPath,band=bandRow(id);ownerEvent(band.event_id,user)
      if(!action&&method==='GET'){const event=get('SELECT * FROM events WHERE id=?',band.event_id);return reply(200,{...publicBand(band,true),equipment:equipment(event),groups:JSON.parse(get("SELECT value FROM settings WHERE key='groups'")?.value||'[]')})}
      if(!action&&method==='PUT')return reply(200,saveBand(id,await body(),'organiser'))
      if(action==='history'&&method==='GET')return reply(200,all('SELECT revision,actor,created FROM event_band_revisions WHERE band_id=? ORDER BY revision DESC',id))
      if(action==='stage-preview'&&method==='GET'){const stage=stageRow(band.stage_id);return reply(200,{version:stage.version,conflicts:conflicts(band,JSON.parse(stage.data))})}
      if(method==='POST'&&action){
        const input=await body();const result=transaction(()=>{
          const current=bandRow(id);if(input.revision!==current.revision)fail(409,'This band plot changed. Refresh before continuing')
          if(action==='link'){run('UPDATE event_bands SET guest_token=?,registration_key=NULL WHERE id=?',input.disable?null:token(),id);return publicBand(bandRow(id),true)}
          if(action==='rename'){const label=name(input.name),data=JSON.parse(current.data);data.project=label;run('UPDATE event_bands SET name=?,data=?,slot=? WHERE id=?',label,JSON.stringify(data),String(input.slot??current.slot).slice(0,200),id)}
          else if(action==='review'){if(!['approved','changes_requested'].includes(input.status))fail(400,'Choose approve or request changes');run('UPDATE event_bands SET status=?,review_note=?,submitted_revision=COALESCE(submitted_revision,revision) WHERE id=?',input.status,note(input.note||''),id)}
          else if(action==='apply-stage'){
            const stage=stageRow(current.stage_id);if(input.stageVersion!==stage.version)fail(409,'The stage changed. Preview the update again');const data=JSON.parse(current.data);const snapshot=assetSnapshot(JSON.parse(stage.data));data.stage={kind:'library',id:stage.id};data.assetSnapshots.stage=snapshot;run("UPDATE event_bands SET data=?,stage_version=?,status='changes_requested',review_note=? WHERE id=?",JSON.stringify(data),stage.version,'The organiser updated the stage. Please check your equipment positions.',id)
          }else if(action==='restore'){
            const previous=get('SELECT snapshot FROM event_band_revisions WHERE band_id=? AND revision=?',id,input.restoreRevision);if(!previous)fail(404,'Revision not found');const snapshot=JSON.parse(previous.snapshot);run("UPDATE event_bands SET data=?,notes=?,stage_version=?,status='in_progress',submitted_revision=NULL WHERE id=?",JSON.stringify(snapshot.data),snapshot.notes,snapshot.stageVersion,id)
          }else fail(404,'Unknown action')
          run('UPDATE event_bands SET revision=revision+1,updated=? WHERE id=?',now(),id);record(id,'organiser');return publicBand(bandRow(id),true)
        });return reply(200,result)
      }
    }
    fail(404,'Not found')
  }
}
