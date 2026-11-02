import {createStageLibraryRoutes} from './stage-library-routes.mjs'
import {uid,token,fail,manager} from './account-store.mjs'
import {isEquipmentItem} from './library-membership.mjs'
import {createWorkspaceModel} from './workspace-model.mjs'
import {validOrganisationLogo} from '../src/organisation-logo.js'
import {assetSnapshot} from '../src/project-snapshots.js'

export function createUserWorkspace(store) {
  const {get,all,run,transaction,asset,saveAsset}=store
  const model=createWorkspaceModel(store),stageLibrary=createStageLibraryRoutes(store,model)
  const {now,requireUser,requireAdmin,label,text,parsed,member,org,organisationBranding,shares,setShares,isPublic,publicLibraryState,canReadEquipment,canEditEquipment,equipmentData,decorateEquipment,catalogue,stageRow,accessStage,normaliseStage,stageSummary,layoutAccess,getLayout,layoutSummary,recordLayout,createLayout,saveLayout,submit}=model
  const requireOwner=user=>{requireUser(user);const current=get('SELECT role,disabled FROM users WHERE id=?',user.id);if(user.role!=='owner'||current?.role!=='owner'||current.disabled)fail(403,'Only the app Owner can import or restore library records and create stage templates')}
  const importRequest=async body=>{const input=await body();if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Invalid import request');return input}
  const requireLibraryManager=user=>{requireAdmin(user);const current=get('SELECT role,disabled FROM users WHERE id=?',user.id);if(!manager(current)||current.disabled)fail(403,'An active app Admin or Owner is required')}
  const archived=(kind,id,user)=>{const row=asset(kind,id);if(!row||row.deleted||row.owner_id&&row.owner_id!==user.id)fail(404,'Archived item not found');return parsed(row)}
  const copyEquipment=(source,user,organisationIds)=>{const id='item-'+uid(),cleaned=equipmentData({...source,id}),saved=saveAsset('items',id,cleaned,user,user.id);setShares('equipment',id,organisationIds||[],user,user.id);return decorateEquipment(asset('items',saved.id),user)}
  const copyStage=(source,input,user)=>{
    if(!source||source.schema!=='stageplot-stage@1')fail(400,'Choose a stageplot-stage@1 stage file')
    const id='stage-'+uid(),data=structuredClone(source)
    data.label=input.name??source.label
    for(const key of ['public','generic','canEdit','canShare','submission','version','revision','ownerName','permission','canRemoveFromLibrary','removedFromLibrary','layoutFolders'])delete data[key]
    data.layerFolders??=data.editor?.assetFolders||data.editor?.zoneFolders||[]
    if(!Array.isArray(data.availableEquipment??[])||!Array.isArray(data.availableEquipmentSnapshots??[]))fail(400,'Invalid available equipment')
    const snapshots=new Map((data.availableEquipmentSnapshots||[]).map(item=>[item.id,equipmentData(item)]))
    for(const entry of data.availableEquipment||[]){const row=asset('items',entry.assetId);if(row&&!row.deleted&&(canReadEquipment(row,user)||!row.owner_id||row.owner_id===user.id))snapshots.set(entry.assetId,equipmentData(parsed(row)))}
    const cleaned=normaliseStage(data,id,user,{availableEquipmentSnapshots:[...snapshots.values()]})
    run('INSERT INTO wf_stages VALUES(?,?,?,?,1,0,?,?)',id,user.id,cleaned.label,JSON.stringify(cleaned),now(),now())
    run('INSERT INTO wf_stage_versions VALUES(?,1,?)',id,JSON.stringify(cleaned))
    setShares('stage',id,input.organisationIds||[],user,user.id)
    return stageSummary(stageRow(id),user,true)
  }
  return async({path,method,user,body,send})=>{
    if(!path.startsWith('/api/workspace/'))return false
    const route=path.slice('/api/workspace'.length),reply=(status,data)=>{send(status,data);return true}
    if(await stageLibrary({route,method,user,body,reply}))return true
    if(route==='/equipment'&&method==='GET')return reply(200,catalogue(user))
    if(route==='/hidden-equipment'&&method==='GET'){requireLibraryManager(user);return reply(200,catalogue(user,true).filter(item=>item.public&&item.hiddenFromPublicLibrary))}
    const visibility=route.match(/^\/public-library\/(equipment|stage)\/([a-z0-9-]+)\/visibility$/)
    if(visibility&&method==='PUT'){
      requireLibraryManager(user);const input=await body()
      return reply(200,transaction(()=>{requireLibraryManager(user);const [,kind,id]=visibility,current=kind==='equipment'?asset('items',id):model.stageRow(id)
        if(kind==='equipment'?!isPublic(current):!model.publicStage(current)||publicLibraryState(kind,id).removed)fail(404,'Public library item not found')
        if(typeof input?.hidden!=='boolean')fail(400,'Choose hide or show')
        const state=publicLibraryState(kind,id)
        if(input.libraryRevision!==state.revision)fail(409,'Library visibility changed. Reload before continuing')
        run('INSERT INTO wf_public_library_state(kind,asset_id,hidden,revision) VALUES(?,?,?,1) ON CONFLICT(kind,asset_id) DO UPDATE SET hidden=excluded.hidden,revision=revision+1',kind,id,input.hidden?1:0)
        return kind==='equipment'?decorateEquipment(current,user):stageSummary(current,user)
      }))
    }
    if(route==='/groups'&&method==='GET')return reply(200,JSON.parse(get("SELECT value FROM settings WHERE key='groups'")?.value||'[]'))
    if(route==='/generic-stages'&&method==='GET')return reply(200,all('SELECT * FROM wf_stages WHERE generic=1 ORDER BY name').map(row=>stageSummary(row,user)))
    const shared=route.match(/^\/stage-invitations\/([a-f0-9]{48})$/)
    if(shared){
      const link=get('SELECT * FROM wf_stage_links WHERE token=?',shared[1]);if(!link)fail(404,'This stage invitation is no longer available')
      const stage=stageRow(link.stage_id)
      if(method==='GET')return reply(200,{name:stage.name,ownerName:get('SELECT name FROM users WHERE id=?',stage.owner_id)?.name||'Stageplot',stageId:stage.id,organisation:organisationBranding(link.organisation_id)})
      if(method==='POST'){
        const input=await body();if(typeof input.registrationKey!=='string'||!/^[a-f0-9-]{32,64}$/.test(input.registrationKey))fail(400,'Start from the stage invitation page')
        const result=transaction(()=>{if(!get('SELECT token FROM wf_stage_links WHERE token=?',shared[1]))fail(404,'This invitation was disabled');const existing=get('SELECT * FROM wf_layouts WHERE stage_id=? AND registration_key=? AND deleted=0',stage.id,input.registrationKey);if(existing){if(!existing.guest_token)fail(404,'This layout link has been revoked');return existing}return createLayout(stageRow(stage.id),user,input,link.organisation_id,true)})
        return reply(201,{id:result.id,name:result.name,guestToken:result.guest_token})
      }
      fail(405,'Method not allowed')
    }
    const orgInvite=route.match(/^\/organisation-invitations\/([a-f0-9]{48})$/)
    if(orgInvite){
      const invitation=get('SELECT i.*,o.name FROM wf_org_invitations i JOIN wf_organisations o ON o.id=i.organisation_id WHERE i.token=?',orgInvite[1]);if(!invitation)fail(404,'Organisation invitation not found')
      if(method==='GET')return reply(200,{name:invitation.name,role:invitation.role,requiresSignIn:true,organisation:organisationBranding(invitation.organisation_id)})
      requireUser(user)
      if(method==='POST')return reply(200,transaction(()=>{const live=get('SELECT * FROM wf_org_invitations WHERE token=?',orgInvite[1]);if(!live)fail(404,'This invitation was revoked');if(live.email&&live.email.toLowerCase()!==user.email?.toLowerCase())fail(403,'This invitation is for a different email address');if(!member(live.organisation_id,user))run('INSERT INTO wf_members VALUES(?,?,?)',live.organisation_id,user.id,live.role);if(live.email)run('DELETE FROM wf_org_invitations WHERE id=?',live.id);return {organisationId:live.organisation_id}}))
      fail(405,'Method not allowed')
    }
    const guest=route.match(/^\/layout-links\/([a-f0-9]{48})(?:\/(claim))?$/)
    if(guest){
      const row=get('SELECT * FROM wf_layouts WHERE guest_token=? AND deleted=0',guest[1]);if(!row)fail(404,'This private layout link is no longer available')
      if(guest[2]==='claim'&&method==='POST'){
        requireUser(user);return reply(200,transaction(()=>{const latest=get('SELECT * FROM wf_layouts WHERE guest_token=?',guest[1]);if(!latest)fail(404,'Link revoked');if(latest.creator_id&&latest.creator_id!==user.id)fail(409,'This layout is already linked to another account');run('UPDATE wf_layouts SET creator_id=?,owner_id=COALESCE(owner_id,?) WHERE id=?',user.id,user.id,row.id);return layoutSummary(get('SELECT * FROM wf_layouts WHERE id=?',row.id),user,true)}))
      }
      if(!guest[2]&&method==='GET')return reply(200,layoutSummary(row,user,true))
      if(!guest[2]&&method==='PUT'){const input=await body();const saved=transaction(()=>{const current=get('SELECT * FROM wf_layouts WHERE guest_token=?',guest[1]);if(!current)fail(404,'Link revoked');return saveLayout(current,input,user)});return reply(200,layoutSummary(saved,user,true))}
      fail(405,'Method not allowed')
    }
    const genericLayout=route.match(/^\/generic-stages\/([a-z0-9-]+)\/layouts$/)
    if(genericLayout&&method==='POST'){const stage=stageRow(genericLayout[1]);if(!stage.generic)fail(404,'Generic stage not found');const input=await body();const row=transaction(()=>createLayout(stage,user,input,input.organisationId||null));return reply(201,{id:row.id,guestToken:row.guest_token})}
    requireUser(user)
    if(route==='/organisations'){
      if(method==='GET')return reply(200,all('SELECT o.*,m.role FROM wf_organisations o JOIN wf_members m ON m.organisation_id=o.id WHERE m.user_id=? ORDER BY o.name',user.id).map(row=>({...row,...organisationBranding(row.id)})))
      if(method==='POST'){const input=await body(),id=uid();return reply(201,transaction(()=>{run('INSERT INTO wf_organisations VALUES(?,?,?,1,?)',id,label(input.name),user.id,now());run("INSERT INTO wf_members VALUES(?,?,'owner')",id,user.id);return org(id,user)}))}
    }
    const organisation=route.match(/^\/organisations\/([a-f0-9]+)(?:\/(members|invitations|stock|logo)(?:\/([a-f0-9]+))?)?$/)
    if(organisation){
      const [,id,collection,subject]=organisation;org(id,user)
      const detail=()=>({...org(id,user),members:all('SELECT m.user_id AS id,m.role,u.name,u.email FROM wf_members m JOIN users u ON u.id=m.user_id WHERE m.organisation_id=? ORDER BY u.name',id),invitations:['owner','admin'].includes(member(id,user))?all('SELECT id,email,role,token,created FROM wf_org_invitations WHERE organisation_id=?',id):[]})
      if(collection==='logo'&&method==='PUT'){
        org(id,user,true);const input=await body()
        return reply(200,transaction(()=>{const current=org(id,user,true);if(input.revision!==current.revision)fail(409,'Organisation changed. Reload before changing its logo.');if(input.logo!==null&&!validOrganisationLogo(input.logo))fail(400,'Choose a valid logo image smaller than 2 MB');if(input.logo===null)run('DELETE FROM wf_org_branding WHERE organisation_id=?',id);else run('INSERT INTO wf_org_branding VALUES(?,?) ON CONFLICT(organisation_id) DO UPDATE SET logo=excluded.logo',id,input.logo);run('UPDATE wf_organisations SET revision=revision+1 WHERE id=?',id);return detail()}))
      }
      if(collection==='stock'){
        if(method==='GET')return reply(200,all('SELECT asset_id AS assetId,quantity FROM wf_org_stock WHERE organisation_id=?',id))
        if(method==='PUT'){const input=await body();org(id,user,true);const item=asset('items',input.assetId);if(!canReadEquipment(item,user)||!isEquipmentItem(parsed(item)))fail(404,'Equipment not found');if(!isPublic(item)&&!shares('equipment',input.assetId).includes(id))fail(400,'Share this private equipment with the organisation first');if(input.quantity!==null&&(!Number.isSafeInteger(input.quantity)||input.quantity<0))fail(400,'Quantity must be a non-negative whole number');if(input.quantity===null)run('DELETE FROM wf_org_stock WHERE organisation_id=? AND asset_id=?',id,input.assetId);else run('INSERT INTO wf_org_stock VALUES(?,?,?) ON CONFLICT(organisation_id,asset_id) DO UPDATE SET quantity=excluded.quantity',id,input.assetId,input.quantity);return reply(200,all('SELECT asset_id AS assetId,quantity FROM wf_org_stock WHERE organisation_id=?',id))}
      }
      if(!collection&&method==='GET')return reply(200,detail())
      if(!collection&&method==='PUT'){
        if(org(id,user).role!=='owner')fail(403,'Only the organisation owner can rename it')
        const input=await body()
        return reply(200,transaction(()=>{const current=org(id,user);if(current.role!=='owner')fail(403,'Only the organisation owner can rename it');if(input.revision!==current.revision)fail(409,'Organisation changed. Reload before renaming it.');run('UPDATE wf_organisations SET name=?,revision=revision+1 WHERE id=?',label(input.name),id);return detail()}))
      }
      if(collection==='invitations'&&method==='POST'){const input=await body();org(id,user,true);const role=input.role||'user';if(!['user','admin'].includes(role)||role==='admin'&&member(id,user)!=='owner')fail(403,'Only the organisation owner can invite administrators');const email=text(input.email||'',320).trim();if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))fail(400,'Enter a valid email');const inviteId=uid();run('INSERT INTO wf_org_invitations VALUES(?,?,?,?,?,?,?)',inviteId,id,token(),email,role,user.id,now());return reply(201,detail())}
      if(collection==='invitations'&&subject&&method==='DELETE'){org(id,user,true);run('DELETE FROM wf_org_invitations WHERE id=? AND organisation_id=?',subject,id);return reply(200,detail())}
      if(collection==='members'&&subject&&(method==='PUT'||method==='DELETE')){
        const input=method==='PUT'?await body():{},self=subject===user.id
        return reply(200,transaction(()=>{const current=org(id,user),target=get('SELECT role FROM wf_members WHERE organisation_id=? AND user_id=?',id,subject);if(!target)fail(404,'Member not found');if(method==='DELETE'&&self){if(target.role==='owner')fail(409,'Transfer ownership before leaving');run('DELETE FROM wf_members WHERE organisation_id=? AND user_id=?',id,subject);return {left:true}}
          org(id,user,true);if(target.role==='owner'||target.role==='admin'&&current.role!=='owner')fail(403,'The organisation owner must manage administrators')
          if(method==='DELETE')run('DELETE FROM wf_members WHERE organisation_id=? AND user_id=?',id,subject)
          else {if(!['user','admin','owner'].includes(input.role)||current.role!=='owner')fail(403,'Only the organisation owner can change roles');if(input.role==='owner'){run("UPDATE wf_members SET role='admin' WHERE organisation_id=? AND user_id=?",id,user.id);run('UPDATE wf_organisations SET owner_id=?,revision=revision+1 WHERE id=?',subject,id)}run('UPDATE wf_members SET role=? WHERE organisation_id=? AND user_id=?',input.role,id,subject)}return detail()}))
      }
    }
    const libraryEntry=route.match(/^\/library\/(stage|layout)\/([a-z0-9-]+)$/)
    if(libraryEntry&&method==='PUT'){
      const [,kind,id]=libraryEntry,input=await body()
      return reply(200,transaction(()=>{const source=kind==='stage'?stageSummary(accessStage(id,user),user):layoutSummary(getLayout(id,user),user);if(!source.canRemoveFromLibrary)fail(403,'Only shared items can be removed from your personal library');if(typeof input.removed!=='boolean')fail(400,'Choose remove or restore');if(input.removed)run('INSERT OR IGNORE INTO wf_library_removals VALUES(?,?,?)',user.id,kind,id);else run('DELETE FROM wf_library_removals WHERE user_id=? AND kind=? AND asset_id=?',user.id,kind,id);return {removed:input.removed}}))
    }
    if(route==='/stages'){
      if(method==='GET')return reply(200,all('SELECT * FROM wf_stages WHERE generic=0 ORDER BY updated DESC').filter(row=>!publicLibraryState('stage',row.id).hidden&&!publicLibraryState('stage',row.id).removed).filter(row=>{try{return accessStage(row.id,user)}catch{return false}}).map(row=>stageSummary(row,user)))
      if(method==='POST'){const input=await body(),id='stage-'+uid(),data=normaliseStage(input.data,id,user);return reply(201,transaction(()=>{run('INSERT INTO wf_stages VALUES(?,?,?,?,1,0,?,?)',id,user.id,data.label,JSON.stringify(data),now(),now());run('INSERT INTO wf_stage_versions VALUES(?,1,?)',id,JSON.stringify(data));setShares('stage',id,input.organisationIds||[],user,user.id);return stageSummary(stageRow(id),user,true)}))}
    }
    if(route==='/legacy-stages'&&method==='GET'){requireOwner(user);return reply(200,all("SELECT * FROM assets WHERE kind='stages' AND deleted=0 AND (owner_id IS NULL OR owner_id=?) ORDER BY id",user.id).map(row=>{const data=parsed(row);return {id:row.id,name:data.label,dimensions:data.dimensions,preview:assetSnapshot(data)}}))}
    if(route==='/stages/import'&&method==='POST'){
      requireOwner(user);const input=await importRequest(body)
      return reply(201,transaction(()=>{requireOwner(user);return copyStage(input.assetId?archived('stages',input.assetId,user):input.data,input,user)}))
    }
    const template=route.match(/^\/stages\/([a-z0-9-]+)\/template$/)
    if(template&&method==='POST'){
      requireOwner(user);const input=await importRequest(body)
      return reply(201,transaction(()=>{requireOwner(user);return copyStage(JSON.parse(accessStage(template[1],user).data),input,user)}))
    }
    const stagePath=route.match(/^\/stages\/([a-z0-9-]+)(?:\/(layouts|invitation|access|sharing))?$/)
    if(stagePath){
      const [,id,action]=stagePath,stage=accessStage(id,user)
      if(!action&&method==='GET')return reply(200,{...stageSummary(stage,user,true),equipment:catalogue(user).filter(isEquipmentItem)})
      if(!action&&method==='PUT'){const input=await body();return reply(200,transaction(()=>{const current=accessStage(id,user,true);if(input.version!==current.version)fail(409,'Stage changed in another window. Reload before saving');const data=normaliseStage(input.data,id,user);run('UPDATE wf_stages SET name=?,data=?,version=version+1,updated=? WHERE id=?',data.label,JSON.stringify(data),now(),id);run('INSERT INTO wf_stage_versions VALUES(?,?,?)',id,current.version+1,JSON.stringify(data));setShares('stage',id,input.organisationIds,user,current.owner_id);return stageSummary(stageRow(id),user,true)}))}
      if(action==='sharing'&&method==='POST'){const input=await body();return reply(200,transaction(()=>{const current=accessStage(id,user);setShares('stage',id,input.organisationIds,user,current.owner_id);return stageSummary(current,user)}))}
      if(action==='layouts'&&method==='POST'){const input=await body();const row=transaction(()=>createLayout(accessStage(id,user),user,input,input.organisationId||null));return reply(201,layoutSummary(row,user,true))}
      if(action==='invitation'){
        if(stage.owner_id!==user.id)fail(403,'Only the stage creator can manage public invitations')
        if(method==='GET')return reply(200,get('SELECT token,organisation_id AS organisationId FROM wf_stage_links WHERE stage_id=?',id)||{token:null})
        if(method==='POST'){const input=await body();if(input.organisationId){org(input.organisationId,user,true);if(!shares('stage',id).includes(input.organisationId))fail(400,'Share this stage with the organisation first')}if(input.disable)run('DELETE FROM wf_stage_links WHERE stage_id=?',id);else run('INSERT INTO wf_stage_links VALUES(?,?,?) ON CONFLICT(stage_id) DO UPDATE SET token=excluded.token,organisation_id=excluded.organisation_id',id,token(),input.organisationId||null);return reply(200,get('SELECT token,organisation_id AS organisationId FROM wf_stage_links WHERE stage_id=?',id)||{token:null})}
      }
      if(action==='access'){
        if(stage.owner_id!==user.id)fail(403,'Only the creator can manage stage access')
        const detail=()=>all('SELECT g.user_id AS id,g.permission,u.name,u.email FROM wf_stage_grants g JOIN users u ON u.id=g.user_id WHERE g.stage_id=?',id)
        if(method==='GET')return reply(200,detail())
        if(method==='POST'){const input=await body(),account=get('SELECT * FROM users WHERE disabled=0 AND email=? COLLATE NOCASE',String(input.email||'').trim());if(!account)fail(404,'No active account with that email');if(!['use','edit'].includes(input.permission))fail(400,'Choose can use or can edit');if(input.remove)run('DELETE FROM wf_stage_grants WHERE stage_id=? AND user_id=?',id,account.id);else run('INSERT INTO wf_stage_grants VALUES(?,?,?) ON CONFLICT(stage_id,user_id) DO UPDATE SET permission=excluded.permission',id,account.id,input.permission);return reply(200,detail())}
      }
    }
    if(route==='/layouts'&&method==='GET')return reply(200,all('SELECT * FROM wf_layouts ORDER BY updated DESC').filter(row=>layoutAccess(row,user)).map(row=>layoutSummary(row,user)))
    const layoutPath=route.match(/^\/layouts\/([a-f0-9]+)(?:\/(link|review|stage-update|history|restore|stage-owner-sharing))?$/)
    if(layoutPath){
      const [,id,action]=layoutPath,row=getLayout(id,user)
      if(!action&&method==='GET')return reply(200,layoutSummary(row,user,true))
      if(!action&&method==='DELETE'){const input=await body();return reply(200,transaction(()=>{const current=getLayout(id,user);if(current.owner_id!==user.id)fail(403,'Only the layout owner can delete this layout');if(input.revision!==current.revision)fail(409,'Layout changed. Reopen before deleting');run('UPDATE wf_layouts SET deleted=1,guest_token=NULL,registration_key=NULL,revision=revision+1,updated=? WHERE id=?',now(),id);return {deleted:true}}))}
      if(!action&&method==='PUT'){const input=await body();return reply(200,transaction(()=>layoutSummary(saveLayout(getLayout(id,user),input,user),user,true)))}
      if(action==='history'&&method==='GET')return reply(200,all('SELECT revision,created FROM wf_layout_versions WHERE layout_id=? ORDER BY revision DESC',id))
      if(action&&method==='POST'){
        const input=await body();return reply(200,transaction(()=>{const current=getLayout(id,user);if(input.revision!==current.revision)fail(409,'Layout changed. Reopen before continuing')
          if(action==='link'){if(!layoutSummary(current,user).canManageLink)fail(403,'Only the organiser can replace or revoke private links');run('UPDATE wf_layouts SET guest_token=?,registration_key=NULL WHERE id=?',input.disable?null:token(),id);return layoutSummary(get('SELECT * FROM wf_layouts WHERE id=?',id),user,true)}
          if(action==='stage-owner-sharing'){if(!layoutSummary(current,user).canShareWithStageOwner)fail(403,'Only the layout owner can change sharing with the stage owner');if(typeof input.shareWithStageOwner!=='boolean')fail(400,'Choose whether to share with the stage owner');run('UPDATE wf_layouts SET share_stage_owner=?,revision=revision+1,updated=? WHERE id=?',input.shareWithStageOwner?1:0,now(),id)}
          else if(action==='review'){if(!layoutSummary(current,user).canReview)fail(403,'Only the organiser can review this layout');if(!['approved','changes_requested'].includes(input.status))fail(400,'Choose approve or request changes');run('UPDATE wf_layouts SET status=?,review_note=?,revision=revision+1,updated=? WHERE id=?',input.status,text(input.note||''),now(),id)}
          else if(action==='stage-update'){accessStage(current.stage_id,user);const latest=stageRow(current.stage_id);if(input.stageVersion!==latest.version)fail(409,'The source stage changed again');run("UPDATE wf_layouts SET stage_version=?,revision=revision+1,status='changes_requested',review_note=?,updated=? WHERE id=?",latest.version,'The source stage was updated. Check equipment positions.',now(),id)}
          else if(action==='restore'){const previous=get('SELECT snapshot FROM wf_layout_versions WHERE layout_id=? AND revision=?',id,input.restoreRevision);if(!previous)fail(404,'Revision not found');const saved=JSON.parse(previous.snapshot);run("UPDATE wf_layouts SET data=?,notes=?,stage_version=?,revision=revision+1,status='in_progress',updated=? WHERE id=?",JSON.stringify(saved.data),saved.notes,saved.stageVersion,now(),id)}
          const saved=getLayout(id,user);recordLayout(saved);return layoutSummary(saved,user,true)}))
      }
    }
    if(route==='/equipment/import'&&method==='POST'){
      requireOwner(user);const input=await importRequest(body)
      return reply(201,transaction(()=>{requireOwner(user);return copyEquipment(input.assetId?archived('items',input.assetId,user):input.data,user,input.organisationIds)}))
    }
    if(route==='/legacy-equipment'&&method==='GET'){requireOwner(user);return reply(200,all("SELECT * FROM assets WHERE kind='items' AND deleted=0 AND owner_id IS NULL").filter(row=>!isPublic(row)&&isEquipmentItem(parsed(row))).map(row=>({id:row.id,label:parsed(row).label,dimensions:parsed(row).dimensions,schema:parsed(row).schema})))}
    const equipmentCopy=route.match(/^\/equipment\/([a-z0-9-]+)\/copy$/)
    if(equipmentCopy&&method==='POST'){
      const input=await body()
      return reply(201,transaction(()=>{const source=asset('items',equipmentCopy[1]);if(!canReadEquipment(source,user))fail(404,'Equipment not found');return copyEquipment(parsed(source),user,input.organisationIds)}))
    }
    const withdraw=route.match(/^\/equipment\/([a-z0-9-]+)\/withdraw$/)
    if(withdraw&&method==='POST'){
      requireLibraryManager(user);const input=await body()
      if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Invalid library review request')
      return reply(200,transaction(()=>{
        requireLibraryManager(user)
        const current=asset('items',withdraw[1])
        if(!current||current.owner_id)fail(404,'Public equipment not found')
        if(!isPublic(current))fail(409,'This equipment is no longer in the public library')
        if(input.revision!==current.revision)fail(409,'Public equipment changed. Reload before returning it to reviews')
        const snapshot=equipmentData(parsed(current)),feedback=text(input.feedback??'Returned from the public library for review.',2000)
        const publication=get('SELECT source_id FROM wf_publications WHERE public_id=?',current.id),creator=publication?asset('items',publication.source_id)?.owner_id:null
        const removed=saveAsset('items',current.id,parsed(current),user,null,1),previous=get('SELECT id FROM wf_submissions WHERE public_id=?',current.id),id=previous?.id||uid()
        if(previous)run("UPDATE wf_submissions SET snapshot=?,source_revision=?,public_revision=?,status='pending',feedback=?,revision=revision+1,updated=? WHERE id=?",JSON.stringify(snapshot),current.revision,removed.revision,feedback,now(),id)
        else run("INSERT INTO wf_submissions(id,asset_id,owner_id,snapshot,source_revision,revision,status,feedback,created,updated,public_id,public_revision) VALUES(?,?,?,?,?,1,'pending',?,?,?,?,?)",id,current.id,creator||user.id,JSON.stringify(snapshot),current.revision,feedback,now(),now(),current.id,removed.revision)
        return {id,publicId:current.id,status:'pending'}
      }))
    }
    const itemPath=route.match(/^\/equipment\/([a-z0-9-]+)$/)
    if(itemPath){
      const id=itemPath[1],row=asset('items',id)
      if(method==='GET'){if(!canReadEquipment(row,user))fail(404,'Equipment not found');return reply(200,decorateEquipment(row,user))}
      if(method==='PUT'){
        const input=await body(),data=equipmentData({...input.data,id})
        return reply(200,transaction(()=>{const current=asset('items',id);if(current&&!canEditEquipment(current,user))fail(403,'Make a private copy to edit this equipment');if(current&&input.revision!==current.revision)fail(409,'Equipment changed in another window');const ownerId=current?current.owner_id:user.id;saveAsset('items',id,{...data,id,profiles:current&&isPublic(current)?['external']:[]},user,ownerId);setShares('equipment',id,input.organisationIds,user,ownerId);if(input.submit){if(!ownerId)fail(400,'Public equipment is updated directly');submit(asset('items',id))};return decorateEquipment(asset('items',id),user)}))
      }
      if(method==='DELETE'){if(!row||row.deleted)fail(404,'Equipment not found');if(isPublic(row)){if(user.role!=='owner')fail(403,'Only the app Owner can delete public equipment')}else if(row.owner_id!==user.id)fail(403,'Only the creator can delete an asset');transaction(()=>saveAsset('items',id,parsed(row),user,row.owner_id,1));return reply(200,{deleted:true})}
    }
    if(route==='/submissions'&&method==='GET')return reply(200,all(manager(user)?'SELECT * FROM wf_submissions ORDER BY updated DESC':'SELECT * FROM wf_submissions WHERE owner_id=? ORDER BY updated DESC',...(manager(user)?[]:[user.id])).map(row=>({...row,snapshot:JSON.parse(row.snapshot),ownerName:get('SELECT name FROM users WHERE id=?',row.owner_id)?.name||'Creator'})))
    const review=route.match(/^\/submissions\/([a-f0-9]+)$/)
    if(review&&method==='POST'){
      requireLibraryManager(user);const input=await body()
      return reply(200,transaction(()=>{requireLibraryManager(user);const proposal=get('SELECT * FROM wf_submissions WHERE id=?',review[1]);if(!proposal||proposal.status!=='pending')fail(409,'Submission is no longer pending');if(input.revision!==proposal.revision)fail(409,'Submission changed. Reopen it before reviewing')
        if(proposal.public_id){const current=asset('items',proposal.public_id);if(!current||current.owner_id||!current.deleted||current.revision!==proposal.public_revision)fail(409,'The published equipment changed. Reopen its latest review')}
        if(!['save','approve','decline'].includes(input.action))fail(400,'Choose save, approve or decline')
        const data=input.data?equipmentData(input.data):JSON.parse(proposal.snapshot),feedback=text(input.feedback??proposal.feedback,2000)
        if(input.action==='save'){run('UPDATE wf_submissions SET snapshot=?,feedback=?,revision=revision+1,updated=? WHERE id=?',JSON.stringify(data),feedback,now(),proposal.id);return {saved:true}}
        if(input.action==='approve'){
          const publication=get('SELECT * FROM wf_publications WHERE source_id=?',proposal.asset_id),publicId=proposal.public_id||publication?.public_id||'public-'+uid()
          const published={...data,id:publicId,profiles:['external'],editor:data.editor?{...data.editor,referenceImages:[]}:undefined}
          for(const key of ['ownerId','proposedReplacementId','legacySourceId'])delete published[key]
          saveAsset('items',publicId,published,user,null)
          if(proposal.public_id)run('UPDATE wf_publications SET approved_by=?,approved=? WHERE public_id=?',user.id,now(),publicId)
          else run('INSERT INTO wf_publications VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET approved_by=excluded.approved_by,approved=excluded.approved',proposal.asset_id,publicId,user.id,now())
          run("UPDATE wf_submissions SET status='superseded',revision=revision+1,updated=? WHERE public_id=? AND status='pending' AND id<>?",now(),publicId,proposal.id)
        }
        run('UPDATE wf_submissions SET snapshot=?,status=?,feedback=?,revision=revision+1,updated=? WHERE id=?',JSON.stringify(data),input.action==='approve'?'approved':'declined',feedback,now(),proposal.id);return {status:input.action==='approve'?'approved':'declined'}
      }))
    }
    fail(404,'Workspace resource not found')
  }
}
