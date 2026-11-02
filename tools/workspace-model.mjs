import {assignEquipmentSources} from '../src/inventory.js'
import {uid,token,fail,manager} from './account-store.mjs'
import {assetSnapshot,pinProject} from '../src/project-snapshots.js'
import {stageSpace,projectFile,resolveProject} from '../src/project-file.js'
import {sampleStageBoundary} from '../src/stage-geometry.js'
import {normaliseCurtain} from '../src/stage-curtain.js'
import {validFixedEquipment} from '../src/stage-equipment.js'
import {isEquipmentItem} from './library-membership.mjs'

export function createWorkspaceModel(store) {
  const {db,get,all,run,transaction,asset,saveAsset}=store
  db.exec(`CREATE TABLE IF NOT EXISTS wf_organisations(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wf_members(organisation_id TEXT NOT NULL REFERENCES wf_organisations(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(organisation_id,user_id));
    CREATE TABLE IF NOT EXISTS wf_org_invitations(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL REFERENCES wf_organisations(id),token TEXT UNIQUE NOT NULL,email TEXT NOT NULL DEFAULT '',role TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wf_asset_orgs(kind TEXT NOT NULL,asset_id TEXT NOT NULL,organisation_id TEXT NOT NULL REFERENCES wf_organisations(id),PRIMARY KEY(kind,asset_id,organisation_id));
    CREATE TABLE IF NOT EXISTS wf_stages(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id),name TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,generic INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wf_stage_versions(stage_id TEXT NOT NULL REFERENCES wf_stages(id),version INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(stage_id,version));
    CREATE TABLE IF NOT EXISTS wf_stage_grants(stage_id TEXT NOT NULL REFERENCES wf_stages(id),user_id TEXT NOT NULL REFERENCES users(id),permission TEXT NOT NULL,PRIMARY KEY(stage_id,user_id));
    CREATE TABLE IF NOT EXISTS wf_stage_links(stage_id TEXT PRIMARY KEY REFERENCES wf_stages(id),token TEXT UNIQUE NOT NULL,organisation_id TEXT REFERENCES wf_organisations(id));
    CREATE TABLE IF NOT EXISTS wf_layouts(id TEXT PRIMARY KEY,stage_id TEXT NOT NULL REFERENCES wf_stages(id),stage_version INTEGER NOT NULL,owner_id TEXT REFERENCES users(id),creator_id TEXT REFERENCES users(id),organisation_id TEXT REFERENCES wf_organisations(id),name TEXT NOT NULL,data TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL,status TEXT NOT NULL,review_note TEXT NOT NULL DEFAULT '',guest_token TEXT UNIQUE,registration_key TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS wf_registration_key ON wf_layouts(stage_id,registration_key) WHERE registration_key IS NOT NULL;
    CREATE TABLE IF NOT EXISTS wf_layout_versions(layout_id TEXT NOT NULL REFERENCES wf_layouts(id),revision INTEGER NOT NULL,snapshot TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(layout_id,revision));
    CREATE TABLE IF NOT EXISTS wf_submissions(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),snapshot TEXT NOT NULL,source_revision INTEGER NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,feedback TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wf_publications(source_id TEXT PRIMARY KEY,public_id TEXT UNIQUE NOT NULL,approved_by TEXT NOT NULL REFERENCES users(id),approved TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wf_builtin_equipment(asset_id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS wf_org_stock(organisation_id TEXT NOT NULL REFERENCES wf_organisations(id),asset_id TEXT NOT NULL,quantity INTEGER NOT NULL,PRIMARY KEY(organisation_id,asset_id));
    CREATE TABLE IF NOT EXISTS wf_stage_publications(source_id TEXT PRIMARY KEY,public_id TEXT UNIQUE NOT NULL,approved_by TEXT NOT NULL,approved TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wf_stage_submissions(id TEXT PRIMARY KEY,stage_id TEXT NOT NULL,owner_id TEXT NOT NULL,snapshot TEXT NOT NULL,source_version INTEGER NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,feedback TEXT NOT NULL DEFAULT '',updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS wf_stage_owner ON wf_stages(owner_id);
    CREATE INDEX IF NOT EXISTS wf_layout_owner ON wf_layouts(owner_id);
    CREATE INDEX IF NOT EXISTS wf_layout_creator ON wf_layouts(creator_id);
    CREATE INDEX IF NOT EXISTS wf_org_assets ON wf_asset_orgs(organisation_id);`)
  db.exec('CREATE TABLE IF NOT EXISTS wf_org_branding(organisation_id TEXT PRIMARY KEY REFERENCES wf_organisations(id),logo TEXT NOT NULL)')
  transaction(()=>{run("UPDATE wf_members SET role='user' WHERE role='member'");run("UPDATE wf_org_invitations SET role='user' WHERE role='member'")})
  db.exec('CREATE TABLE IF NOT EXISTS wf_library_removals(user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,asset_id TEXT NOT NULL,PRIMARY KEY(user_id,kind,asset_id))')
  db.exec('CREATE TABLE IF NOT EXISTS wf_public_library_state(kind TEXT NOT NULL,asset_id TEXT NOT NULL,hidden INTEGER NOT NULL DEFAULT 0,removed INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(kind,asset_id))')
  const submissionColumns=new Set(all('PRAGMA table_info(wf_submissions)').map(column=>column.name))
  for(const [name,type] of [['public_id','TEXT'],['public_revision','INTEGER']])if(!submissionColumns.has(name))db.exec('ALTER TABLE wf_submissions ADD COLUMN '+name+' '+type)
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS wf_returned_public_equipment ON wf_submissions(public_id) WHERE public_id IS NOT NULL')
  const layoutColumns=new Set(all('PRAGMA table_info(wf_layouts)').map(column=>column.name))
  for(const [name,definition] of [['creation_mode',"TEXT NOT NULL DEFAULT 'legacy'"],['share_stage_owner','INTEGER NOT NULL DEFAULT 0'],['deleted','INTEGER NOT NULL DEFAULT 0']])if(!layoutColumns.has(name))db.exec('ALTER TABLE wf_layouts ADD COLUMN '+name+' '+definition)
  const now=()=>new Date().toISOString()
  const requireUser=user=>{if(!user)fail(401,'Sign in to continue')}
  const requireAdmin=user=>{requireUser(user);if(!manager(user))fail(403,'An app Admin or Owner must review public equipment')}
  const requireLibraryManager=user=>{requireAdmin(user);const current=get('SELECT role,disabled FROM users WHERE id=?',user.id);if(!manager(current)||current.disabled)fail(403,'An active app Admin or Owner is required')}
  const publicLibraryState=(kind,id)=>get('SELECT hidden,removed,revision FROM wf_public_library_state WHERE kind=? AND asset_id=?',kind,id)||{hidden:0,removed:0,revision:0}
  const publicLibraryMetadata=(kind,id)=>{const state=publicLibraryState(kind,id);return {hiddenFromPublicLibrary:!!state.hidden,libraryRevision:state.revision}}
  const label=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>200)fail(400,'Enter a name of up to 200 characters');return value.trim()}
  const text=(value,max=10000)=>{if(typeof value!=='string'||value.length>max)fail(400,'Invalid text');return value}
  const parsed=row=>row?{...JSON.parse(row.data),id:row.id,revision:row.revision,ownerId:row.owner_id}:null
  const member=(id,user)=>user?get('SELECT role FROM wf_members WHERE organisation_id=? AND user_id=?',id,user.id)?.role:null
  const organisationBranding=id=>{const row=id?get('SELECT id,name FROM wf_organisations WHERE id=?',id):null;return row?{...row,logo:get('SELECT logo FROM wf_org_branding WHERE organisation_id=?',id)?.logo||null}:null}
  const org=(id,user,admin=false)=>{requireUser(user);const row=get('SELECT * FROM wf_organisations WHERE id=?',id),role=member(id,user);if(!row||!role)fail(404,'Organisation not found');if(admin&&!['owner','admin'].includes(role))fail(403,'Organisation admin access is required');return {...row,...organisationBranding(id),role}}
  const libraryState=(kind,id,ownerId,user,eligible=true)=>({canRemoveFromLibrary:Boolean(user&&ownerId!==user.id&&eligible),removedFromLibrary:Boolean(user&&ownerId!==user.id&&get('SELECT asset_id FROM wf_library_removals WHERE user_id=? AND kind=? AND asset_id=?',user.id,kind,id))})
  const shares=(kind,id)=>all('SELECT organisation_id AS id FROM wf_asset_orgs WHERE kind=? AND asset_id=?',kind,id).map(row=>row.id)
  const sharedWith=(kind,id,user,edit=false)=>shares(kind,id).some(id=>edit?['owner','admin'].includes(member(id,user)):member(id,user))
  const setShares=(kind,id,ids,user,ownerId)=>{
    if(ids===undefined)return
    if(!Array.isArray(ids)||ids.length>100||new Set(ids).size!==ids.length)fail(400,'Invalid organisation selection')
    if(user?.id!==ownerId)fail(403,'Only the creator can change asset sharing')
    const existing=shares(kind,id)
    for(const orgId of ids)if(!existing.includes(orgId))org(orgId,user)
    run('DELETE FROM wf_asset_orgs WHERE kind=? AND asset_id=?',kind,id)
    for(const orgId of ids)run('INSERT INTO wf_asset_orgs VALUES(?,?,?)',kind,id,orgId)
    if(kind==='stage'){const invitation=get('SELECT organisation_id FROM wf_stage_links WHERE stage_id=?',id);if(invitation?.organisation_id&&!ids.includes(invitation.organisation_id))run('DELETE FROM wf_stage_links WHERE stage_id=?',id)}
  }
  const isPublic=row=>!!row&&!row.deleted&&!row.owner_id&&(!!get('SELECT asset_id FROM wf_builtin_equipment WHERE asset_id=?',row.id)||!!get('SELECT public_id FROM wf_publications WHERE public_id=?',row.id)||(JSON.parse(row.data).profiles||[]).includes('external'))
  const canReadEquipment=(row,user)=>!!row&&!row.deleted&&(isPublic(row)||row.owner_id===user?.id||sharedWith('equipment',row.id,user))
  const canEditEquipment=(row,user)=>!!user&&!!row&&!row.deleted&&(isPublic(row)?manager(user):!!row.owner_id&&(row.owner_id===user.id||sharedWith('equipment',row.id,user,true)))
  const equipmentData=input=>{
    if(!input||input.schema!=='stageplot-item@3'||!Array.isArray(input.shapes)||!Array.isArray(input.collisionShapes)||input.shapes.length>5000||input.collisionShapes.length>5000)fail(400,'Equipment must use the stageplot-item@3 artwork format')
    if(!input.dimensions||![input.dimensions.widthMeters,input.dimensions.depthMeters].every(n=>Number.isFinite(n)&&n>0&&n<=1000))fail(400,'Equipment dimensions must be positive metres')
    const components=input.components??[]
    if(!Array.isArray(components)||components.length>100||new Set(components.map(component=>component?.id)).size!==components.length||components.some(component=>typeof component?.id!=='string'||!component.id||typeof component.label!=='string'||!component.label.trim()||component.label.length>200))fail(400,'Equipment components are invalid')
    const validShape=shape=>shape&&typeof shape==='object'&&(shape.type!=='image'||typeof shape.dataUrl==='string'&&shape.dataUrl.length<=16_000_000&&/^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/=\r\n]+$/i.test(shape.dataUrl)&&['x','y','width','height'].every(key=>Number.isFinite(shape[key]))&&shape.width>0&&shape.height>0)&&(shape.type!=='compound'||Array.isArray(shape.children)&&shape.children.every(validShape))
    if(!input.shapes.every(validShape)||input.editor?.layers&&!Array.isArray(input.editor.layers)||Array.isArray(input.editor?.layers)&&!input.editor.layers.every(validShape))fail(400,'Equipment artwork contains an invalid image')
    const data={...input,label:label(input.label),profiles:[]}
    // Workbench equipment saves/imports produce placeable equipment. Reusable
    // artwork is saved separately through the custom-shape routes.
    if(input.editor){data.editor={...input.editor};delete data.editor.advancedShapeRole}
    for(const key of ['hiddenFromPublicLibrary','libraryRevision','ownerId','deleted','canEdit','canShare','organisationIds','public','builtin','submission','workflowStatus','unsentChanges','shareToken','shareEquipmentIds','personal'])delete data[key]
    return data
  }
  const equipmentSnapshot=item=>{const clean=assetSnapshot(item);for(const key of ['canEdit','canShare','organisationIds','submission','builtin','public','profiles','stockQuantity'])delete clean[key];return clean}
  const decorateEquipment=(row,user)=>{
    const value=parsed(row),proposal=user&&row.owner_id===user.id?get('SELECT id,status,feedback,source_revision FROM wf_submissions WHERE asset_id=? ORDER BY updated DESC LIMIT 1',row.id):null
    return {...value,...publicLibraryMetadata('equipment',row.id),editor:isPublic(row)&&value.editor?{...value.editor,referenceImages:[]}:value.editor,profiles:undefined,public:isPublic(row),builtin:!!get('SELECT asset_id FROM wf_builtin_equipment WHERE asset_id=?',row.id),canEdit:canEditEquipment(row,user),canShare:row.owner_id===user?.id,organisationIds:shares('equipment',row.id).filter(id=>row.owner_id===user?.id||member(id,user)),submission:proposal||null}
  }
  const catalogue=(user,includeHidden=false)=>all("SELECT * FROM assets WHERE kind='items' AND deleted=0 ORDER BY id").filter(row=>canReadEquipment(row,user)&&(!isPublic(row)||!publicLibraryState('equipment',row.id).hidden||includeHidden&&manager(user))).map(row=>decorateEquipment(row,user))
  const stageRow=id=>{const row=get('SELECT * FROM wf_stages WHERE id=?',id);if(!row)fail(404,'Stage not found');return row}
  const publicStage=stage=>!!get('SELECT public_id FROM wf_stage_publications WHERE public_id=?',stage.id)
  const stagePermission=(stage,user)=>stage.generic?(user?.role==='owner'?'edit':'use'):publicStage(stage)?(manager(user)?'edit':publicLibraryState('stage',stage.id).removed?null:'use'):stage.owner_id===user?.id?'owner':sharedWith('stage',stage.id,user,true)?'edit':sharedWith('stage',stage.id,user)?'use':user?get('SELECT permission FROM wf_stage_grants WHERE stage_id=? AND user_id=?',stage.id,user.id)?.permission:null
  const accessStage=(id,user,edit=false)=>{const row=stageRow(id),permission=stagePermission(row,user);if(!permission)fail(404,'Stage not found');if(edit&&!['owner','edit'].includes(permission))fail(403,'This stage is available for layouts, not original stage editing');return row}
  const normaliseStage=(input,id,user,retainedData=null)=>{
    if(!input||input.schema!=='stageplot-stage@1'||!input.dimensions||![input.dimensions.widthMeters,input.dimensions.depthMeters].every(n=>Number.isFinite(n)&&n>0&&n<=1000))fail(400,'Invalid stage dimensions')
    if(!Array.isArray(input.boundary?.nodes)||input.boundary.nodes.length<3||input.boundary.nodes.length>5000||input.boundary.nodes.some(node=>!Number.isFinite(node.x)||!Number.isFinite(node.y)))fail(400,'A stage requires a valid boundary')
    if(!validFixedEquipment(input.fixedEquipment))fail(400,'Invalid installed equipment')
    if(input.curtains!=null&&(!Array.isArray(input.curtains)||input.curtains.length>200||input.curtains.some(line=>!line||typeof line.id!=='string'||![line.x,line.y,line.length].every(Number.isFinite)||line.length<=0||line.length>1000)||new Set(input.curtains.map(line=>line.id)).size!==input.curtains.length))fail(400,'Invalid curtains')
    const available=input.availableEquipment||[]
    if(!Array.isArray(available)||new Set(available.map(item=>item.assetId)).size!==available.length)fail(400,'Invalid available equipment')
    const previous=get('SELECT data FROM wf_stages WHERE id=?',id),retained=new Map((retainedData?.availableEquipmentSnapshots||(previous?JSON.parse(previous.data).availableEquipmentSnapshots||[]:[])).map(item=>[item.id,item]))
    const snapshots=available.map(entry=>{const row=asset('items',entry.assetId),item=canReadEquipment(row,user)?parsed(row):retained.get(entry.assetId);if(entry.quantity!=null&&(!Number.isSafeInteger(entry.quantity)||entry.quantity<0)||!item||!isEquipmentItem(item))fail(400,'Available stock must use equipment you can access with non-negative whole quantities or blank quantities');return equipmentSnapshot(item)})
    const result={...input,id,label:label(input.label),profiles:[],collisionBoundary:sampleStageBoundary(input.boundary.nodes),availableEquipment:available,availableEquipmentSnapshots:snapshots}
    if(input.curtains)result.curtains=input.curtains.map(normaliseCurtain)
    for(const key of ['ownerId','shareToken','shareEquipmentIds','layoutEquipment','organisationIds','visibility','personal'])delete result[key]
    return result
  }
  const stagePreview=data=>assetSnapshot(data)
  const orgStock=id=>new Map(all('SELECT asset_id,quantity FROM wf_org_stock WHERE organisation_id=?',id).map(row=>[row.asset_id,row.quantity]))
  const stageSummary=(stage,user,includeData=false)=>({...libraryState('stage',stage.id,stage.owner_id,user,!stage.generic&&!publicStage(stage)),...publicLibraryMetadata('stage',stage.id),id:stage.id,name:stage.name,ownerId:stage.owner_id,ownerName:get('SELECT name FROM users WHERE id=?',stage.owner_id)?.name||'Stageplot',version:stage.version,generic:!!stage.generic,public:publicStage(stage),preview:stagePreview(JSON.parse(stage.data)),submission:stage.owner_id===user?.id?get('SELECT id,status,feedback FROM wf_stage_submissions WHERE stage_id=?',stage.id)||null:null,permission:stagePermission(stage,user),canEdit:['owner','edit'].includes(stagePermission(stage,user)),canShare:stage.owner_id===user?.id,organisationIds:shares('stage',stage.id).filter(id=>stage.owner_id===user?.id||member(id,user)),updated:stage.updated,dimensions:JSON.parse(stage.data).dimensions,...(includeData?{data:JSON.parse(stage.data)}:{})})
  const stageVersion=(id,version)=>{const row=get('SELECT data FROM wf_stage_versions WHERE stage_id=? AND version=?',id,version);if(!row)fail(404,'Stage version not found');return JSON.parse(row.data)}
  const layoutAccess=(layout,user)=>!!user&&!layout.deleted&&(layout.owner_id===user.id||layout.creator_id===user.id||layout.organisation_id&&member(layout.organisation_id,user)||layout.share_stage_owner&&stageRow(layout.stage_id).owner_id===user.id)
  const getLayout=(id,user)=>{const row=get('SELECT * FROM wf_layouts WHERE id=?',id);if(!row||!layoutAccess(row,user))fail(404,'Layout not found');return row}
  const layoutEquipment=(layout,user)=>{
    const stage=stageVersion(layout.stage_id,layout.stage_version),previous=JSON.parse(layout.data),selected=new Set((stage.availableEquipment||[]).map(item=>item.assetId)),map=new Map(catalogue(user).filter(isEquipmentItem).filter(item=>!selected.size||!item.public||selected.has(item.id)).map(item=>[item.id,equipmentSnapshot(item)]))
    for(const item of stage.availableEquipmentSnapshots||[])map.set(item.id,item)
    for(const item of previous.assetSnapshots?.equipment||[])if(!map.has(item.id))map.set(item.id,item)
    return [...map.values()].map(item=>({...item,public:isPublic(asset('items',item.id))}))
  }
  const layoutSummary=(layout,user,full=false)=>{
    const stage=stageRow(layout.stage_id),stageOwnerAccess=!!user&&!!layout.share_stage_owner&&stage.owner_id===user.id,result={...libraryState('layout',layout.id,layout.owner_id,user),id:layout.id,name:layout.name,stageId:stage.id,stageName:stage.name,stageVersion:layout.stage_version,latestStageVersion:stage.version,ownerId:layout.owner_id,stageOwnerId:stage.owner_id,stageOwnerName:get('SELECT name FROM users WHERE id=?',stage.owner_id)?.name||null,creationMode:layout.creation_mode,sharedWithStageOwner:!!layout.share_stage_owner,canShareWithStageOwner:!!user&&layout.owner_id===user.id&&!!stage.owner_id&&stage.owner_id!==user.id,canDelete:!!user&&layout.owner_id===user.id,canManageLink:!!user&&(layout.owner_id===user.id||['owner','admin'].includes(member(layout.organisation_id,user))),creatorId:layout.creator_id,organisationId:layout.organisation_id,revision:layout.revision,status:layout.status,notes:layout.notes,reviewNote:layout.review_note,updated:layout.updated,canReview:!!user&&(layout.owner_id===user.id||stageOwnerAccess||['owner','admin'].includes(member(layout.organisation_id,user))),canUpdateStage:!!stagePermission(stage,user),canClaim:!!user&&!layout.creator_id}
    result.organisation=organisationBranding(layout.organisation_id)
    if(result.canManageLink||user&&layout.creator_id===user.id)result.guestToken=layout.guest_token
    result.preview={stage:stagePreview(stageVersion(layout.stage_id,layout.stage_version)),data:JSON.parse(layout.data)}
    if(full){result.organisationId=layout.organisation_id;const data=JSON.parse(layout.data);result.data={...data,assetSnapshots:{...data.assetSnapshots,stage:assetSnapshot(stageVersion(layout.stage_id,layout.stage_version))}};result.equipment=layoutEquipment(layout,user).map(item=>({...item,stockQuantity:layout.organisation_id?orgStock(layout.organisation_id).get(item.id)??null:null}));result.groups=JSON.parse(get("SELECT value FROM settings WHERE key='groups'")?.value||'[]')}
    return result
  }
  const recordLayout=layout=>run('INSERT INTO wf_layout_versions VALUES(?,?,?,?)',layout.id,layout.revision,JSON.stringify({data:JSON.parse(layout.data),notes:layout.notes,stageVersion:layout.stage_version}),now())
  const createLayout=(stage,user,input,organisationId=null,trustedInvitation=false)=>{
    if(organisationId&&!stage.generic&&!publicStage(stage)&&!shares('stage',stage.id).includes(organisationId))fail(400,'The stage is not shared with that organisation')
    if(organisationId&&!trustedInvitation)org(organisationId,user)
    if(input.shareWithStageOwner!==undefined&&typeof input.shareWithStageOwner!=='boolean')fail(400,'Choose whether to share with the stage owner')
    const id=uid(),space=stageSpace(JSON.parse(stage.data)),data=projectFile(label(input.name),space,[]),mode=trustedInvitation?'invitation':user?'direct':'generic_guest',ownerId=trustedInvitation?stage.owner_id||user?.id||null:user?.id||null,share=mode==='direct'&&input.shareWithStageOwner&&stage.owner_id&&stage.owner_id!==ownerId?1:0
    run('INSERT INTO wf_layouts(id,stage_id,stage_version,owner_id,creator_id,organisation_id,name,data,notes,revision,status,review_note,guest_token,registration_key,created,updated,creation_mode,share_stage_owner) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,stage.id,stage.version,ownerId,user?.id||null,organisationId,data.project,JSON.stringify(data),'',1,'in_progress','',token(),trustedInvitation?input.registrationKey||null:null,now(),now(),mode,share)
    const layout=get('SELECT * FROM wf_layouts WHERE id=?',id);recordLayout(layout);return layout
  }
  const saveLayout=(row,input,user)=>{
    if(input.revision!==row.revision)fail(409,'This layout changed in another window. Reload the saved version; your local work is kept.')
    const data=input.data,stage=stageVersion(row.stage_id,row.stage_version),previous=JSON.parse(row.data)
    if(data?.version!==2||!Array.isArray(data.items)||data.items.length>2000)fail(400,'Invalid layout')
    const map=new Map(layoutEquipment(row,user).map(item=>[item.id,item]))
    for(const pinned of previous.assetSnapshots?.equipment||[]){const requested=data.assetSnapshots?.equipment?.find(item=>item.id===pinned.id),current=map.get(pinned.id);if(!current||requested?.revision!==current.revision)map.set(pinned.id,pinned)}
    if(data.items.some(item=>!item||!Number.isFinite(item.xMeters)||!Number.isFinite(item.yMeters)||!Number.isFinite(item.rotation??0)||item.custom&&!['staging','text'].includes(item.custom.type)||!item.custom&&!map.has(item.assetId)))fail(400,'Unavailable or invalid equipment in this layout')
    const resolved=resolveProject({...data,project:row.name,stage:{kind:'library',id:row.stage_id,partVisibility:data.stage?.partVisibility,fixedEquipmentControls:data.stage?.fixedEquipmentControls},assetSnapshots:{stage,equipment:[...map.values()]}},[...map.values()],[stage])
    const quantities=new Map((stage.availableEquipment||[]).map(item=>[item.assetId,item.quantity])),organisationQuantities=row.organisation_id?orgStock(row.organisation_id):new Map()
    const stockLibrary=[...map.values()].map(item=>({...item,stockQuantity:quantities.get(item.id)??organisationQuantities.get(item.id)??null}))
    resolved.items=assignEquipmentSources(resolved.items,stockLibrary,Boolean(row.organisation_id||quantities.size),stage.fixedEquipment||[])

    const pinned=pinProject(projectFile(row.name,resolved.space,resolved.items,resolved.preset,resolved.collisionSettings,resolved.layerFolders),resolved.space,resolved.items);delete pinned.assetSnapshots.stage
    run('UPDATE wf_layouts SET data=?,notes=?,revision=revision+1,status=?,updated=? WHERE id=?',JSON.stringify(pinned),text(input.notes??row.notes),input.submit?'submitted':['submitted','approved','changes_requested','changed'].includes(row.status)?'changed':'in_progress',now(),row.id)
    const saved=get('SELECT * FROM wf_layouts WHERE id=?',row.id);recordLayout(saved);return saved
  }
  const submit=row=>{
    const previous=get('SELECT * FROM wf_submissions WHERE asset_id=? ORDER BY updated DESC LIMIT 1',row.id),data=parsed(row)
    if(previous){run("UPDATE wf_submissions SET snapshot=?,source_revision=?,revision=revision+1,status='pending',feedback='',updated=? WHERE id=?",JSON.stringify(data),row.revision,now(),previous.id);return previous.id}
    const id=uid();run("INSERT INTO wf_submissions(id,asset_id,owner_id,snapshot,source_revision,revision,status,feedback,created,updated) VALUES(?,?,?,?,?,1,'pending','',?,?)",id,row.id,row.owner_id,JSON.stringify(data),row.revision,now(),now());return id
  }
  transaction(()=>{
    for(const [id,name,width,depth] of [['generic-rehearsal','Rehearsal room',10,6],['generic-small-stage','Small stage',8,6],['generic-concert-stage','Concert stage',16,10]])if(!get('SELECT id FROM wf_stages WHERE id=?',id)){
      const nodes=[{x:0,y:0},{x:width,y:0},{x:width,y:depth},{x:0,y:depth}],data={schema:'stageplot-stage@1',id,label:name,dimensions:{widthMeters:width,depthMeters:depth},boundary:{closed:true,nodes},collisionBoundary:sampleStageBoundary(nodes),zones:[],textItems:[],fixedEquipment:[],availableEquipment:[]}
      run('INSERT INTO wf_stages VALUES(?,NULL,?,?,1,1,?,?)',id,name,JSON.stringify(data),now(),now());run('INSERT INTO wf_stage_versions VALUES(?,1,?)',id,JSON.stringify(data))
    }
    for(const [id,name,width,depth,type] of [['builtin-chair','Chair',.5,.5,'chair'],['builtin-table','Table',1.8,.75,'rect'],['builtin-microphone','Microphone stand',.4,.4,'circle'],['builtin-monitor','Monitor',.6,.4,'rect']])if(!asset('items',id)){
      const layer={id:1,name:'Body',type,x:0,y:0,width,height:depth,fill:'#d6ddc7',stroke:'#4f6340',strokeWidth:1,collision:true}
      const data={schema:'stageplot-item@3',id,label:name,profiles:[],dimensions:{widthMeters:width,depthMeters:depth},shapes:[{...layer,id:'body'}],collisionShapes:[{type:'rect',x:0,y:0,width,height:depth}],editor:{layers:[layer]}}
      saveAsset('items',id,data,{id:'system'},null);run('INSERT INTO wf_builtin_equipment VALUES(?)',id)
    }
  })
  return {now,requireUser,requireAdmin,requireLibraryManager,publicLibraryState,label,text,parsed,member,org,organisationBranding,shares,setShares,isPublic,canReadEquipment,canEditEquipment,equipmentData,decorateEquipment,catalogue,orgStock,publicStage,stageRow,stagePermission,accessStage,normaliseStage,stageSummary,stageVersion,layoutAccess,getLayout,layoutSummary,recordLayout,createLayout,saveLayout,submit}
}
