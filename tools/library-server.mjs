import {createServer} from 'node:http'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {openStore,uid,token,digest,roles,manager,designer,fail,publicUser} from './account-store.mjs'
import {createGithubAuth} from './github-auth.mjs'
import {createAuthCookies} from './auth-cookies.mjs'
import {assetProfiles,belongsToProfile,isPublishedItem,isEquipmentItem,profileItem,validProfiles,LIBRARY_PROFILES} from './library-membership.mjs'

const root=resolve(process.env.STAGEPLOT_LIBRARY_ROOT || resolve(dirname(fileURLToPath(import.meta.url)),'..'))
const store=await openStore(root)
const {db,get,all,run,transaction,asset,saveAsset}=store
const userLabel=id=>{
  const account=get('SELECT users.name,users.friendly_name,github_identities.login FROM users LEFT JOIN github_identities ON github_identities.user_id=users.id WHERE users.id=?',id)
  return account?.friendly_name || (account?.login?'@'+account.login:account?.name) || 'Contributor'
}
const authCookies=createAuthCookies()
const githubAuth=createGithubAuth(store,authCookies)
const validId=value=>typeof value==='string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
const parsed=row=>row ? {...JSON.parse(row.data),revision:row.revision,ownerId:row.owner_id,deleted:!!row.deleted} : null
const canEdit=(user,row)=>designer(user) && (row?.owner_id ? row.owner_id===user.id : manager(user))
const clean=data=>{const result={...data};for(const key of ['editor','shareToken','shareEquipmentIds','ownerId','deleted','proposedReplacementId','resetShareLink','assetSnapshot'])delete result[key];return result}
const empireOnly=data=>assetProfiles(data).includes('empire')&&!assetProfiles(data).includes('external')
const canView=(user,row)=>!!row && (!empireOnly(parsed(row)) || user?.empire)
const canViewProject=(user,data)=>user?.empire || ![...(data.assetSnapshots?.equipment || []),data.assetSnapshots?.stage].filter(Boolean).some(empireOnly)
const shared=row=>row && !row.deleted && !row.owner_id
const published=row=>shared(row) && (row.kind==='items' ? isPublishedItem(parsed(row)) && isEquipmentItem(parsed(row)) : (parsed(row).visibility || 'listed')==='listed')
const requireUser=user=>{if(!user)fail(401,'Sign in to continue')}
const requireManager=user=>{requireUser(user);if(!manager(user))fail(403,'An Admin or Owner account is required')}
const requireOwner=user=>{requireUser(user);if(user.role!=='owner')fail(403,'Only the Owner can manage accounts')}
const body=async request=>{
  let size=0;const chunks=[]
  for await(const chunk of request){size+=chunk.length;if(size>20_000_000)fail(413,'Request is too large');chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString() || '{}')}catch{fail(400,'Invalid JSON')}
}
const validateAsset=(kind,data)=>{
  if(!validId(data.id) || typeof data.label!=='string' || !data.label.trim())fail(400,'A valid ID and name are required')
  if(!validProfiles(data.profiles))fail(400,'Invalid library profiles')
  if(!data.dimensions || !Number.isFinite(data.dimensions.widthMeters) || !Number.isFinite(data.dimensions.depthMeters) || data.dimensions.widthMeters<=0 || data.dimensions.depthMeters<=0)fail(400,'Positive equipment or stage dimensions are required')
  if(kind==='items') {
    if(data.schema!=='stageplot-item@3' || !Array.isArray(data.shapes) || !Array.isArray(data.collisionShapes))fail(400,'Invalid equipment artwork')
    if(data.stockQuantity!=null && (!Number.isSafeInteger(data.stockQuantity)||data.stockQuantity<0))fail(400,'Stock must be a non-negative whole number or blank')
  }else if(data.schema!=='stageplot-stage@1' || !Array.isArray(data.boundary?.nodes) || data.boundary.nodes.length<3 || !Array.isArray(data.collisionBoundary) || !['listed','link-only','draft'].includes(data.visibility || 'listed'))fail(400,'Invalid stage boundary or visibility')
}
const stageAccess=(row,user,profile,ref)=>{
  if(!row || row.deleted)return false
  const data=parsed(row)
  if(ref) return belongsToProfile(data,profile) && ((data.visibility==='link-only' && data.shareToken===ref) || (shared(row) && (data.visibility || 'listed')==='listed' && data.id===ref) || (row.owner_id===user?.id && data.id===ref))
  return row.owner_id===user?.id || (shared(row) && belongsToProfile(data,profile) && (data.visibility || 'listed')==='listed')
}
const linkedStage=(user,profile,ref)=>ref ? all("SELECT * FROM assets WHERE kind='stages' AND deleted=0").find(row=>canView(user,row)&&stageAccess(row,user,profile,ref)) : null
const allowedOrigins=new Set((process.env.STAGEPLOT_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174').split(',').map(s=>s.trim()).filter(Boolean))
const sessionCookie=authCookies.session
const server=createServer(async(request,response)=>{
  const send=(status,value)=>{response.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(value===undefined?'':JSON.stringify(value))}
  try {
    const origin=request.headers.origin
    if(origin){let same=false;try{same=new URL(origin).host===request.headers.host}catch{/* invalid origin */}if(!same && !allowedOrigins.has(origin))fail(403,'Origin is not allowed');response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Access-Control-Allow-Credentials','true');response.setHeader('Vary','Origin')}
    response.setHeader('Access-Control-Allow-Headers','Content-Type,X-Stageplot-Request')
    response.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')
    if(request.method==='OPTIONS')return send(204)
    if(!['GET','HEAD'].includes(request.method) && request.headers['x-stageplot-request']!=='1')fail(403,'Missing request protection header')
    const url=new URL(request.url,'http://localhost'),path=url.pathname,method=request.method
    const profile=url.searchParams.get('profile') || 'external'
    if(!LIBRARY_PROFILES.includes(profile))fail(400,'Unknown library profile')
    const cookie=request.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('stageplot_session='))?.slice(18)
    const session=cookie ? get('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.hash=? AND sessions.expires>? AND users.disabled=0',digest(cookie),Date.now()) : null
    const user=publicUser(session)
    if(profile==='empire'&&!user?.empire)fail(403,'Empire access is required')
    const startSession=account=>{const value=token();run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?)',digest(value),account.id,Date.now()+7*86400000);response.setHeader('Set-Cookie',[...(response.getHeader('Set-Cookie')?[].concat(response.getHeader('Set-Cookie')):[]),sessionCookie(request,value,7*86400)]);return publicUser(account)}
    if(await githubAuth({request,response,url,user,send,body,startSession}))return
    if(path==='/api/auth/logout' && method==='POST'){if(cookie)run('DELETE FROM sessions WHERE hash=?',digest(cookie));response.setHeader('Set-Cookie',sessionCookie(request,'',0));return send(200,{ok:true})}
    const userMatch=path.match(/^\/api\/users\/([a-f0-9]+)$/)
    if(userMatch && method==='PUT') {
      requireOwner(user);const input=await body(request),account=get('SELECT * FROM users WHERE id=?',userMatch[1]);if(!account)fail(404,'Account not found')
      const role=input.role || account.role,disabled=input.disabled===undefined?account.disabled:input.disabled?1:0
      if(input.empire!==undefined&&typeof input.empire!=='boolean')fail(400,'Empire access must be true or false')
      if(input.friendlyName!==undefined&&(typeof input.friendlyName!=='string'||input.friendlyName.trim().length>100||/[\r\n]/.test(input.friendlyName)))fail(400,'Friendly name must be a single line of up to 100 characters')
      if(account.role==='owner'&&(input.role!==undefined||input.disabled!==undefined))fail(409,'The Owner account cannot be changed or disabled')
      if(!roles.includes(role) || role==='owner'&&account.role!=='owner')fail(400,'Choose Editor, Contributor or Admin')
      if(input.password!==undefined)fail(400,"Passwords are managed by GitHub")
      transaction(()=>{
        const latest=get('SELECT * FROM users WHERE id=?',account.id)
        if(latest.role==='owner' && !latest.disabled && (role!=='owner'||disabled) && get("SELECT count(*) AS n FROM users WHERE role='owner' AND disabled=0").n<=1)fail(409,'Keep at least one active Owner')
        run('UPDATE users SET role=?,disabled=?,empire=?,friendly_name=? WHERE id=?',role,disabled,input.empire===undefined?account.empire:Number(input.empire),input.friendlyName===undefined?account.friendly_name:input.friendlyName.trim(),account.id);if(input.role!==undefined||input.disabled!==undefined)run('DELETE FROM sessions WHERE user_id=?',account.id)
      })
      return send(200,publicUser(get('SELECT * FROM users WHERE id=?',account.id)))
    }
    if(path==='/api/groups') {
      if(method==='GET')return send(200,JSON.parse(get("SELECT value FROM settings WHERE key='groups'")?.value || '[]'))
      requireManager(user)
      if(method==='PUT') {
        const groups=await body(request)
        if(!Array.isArray(groups)||groups.some(g=>!validId(g.id)||typeof g.label!=='string'||!g.label.trim())||new Set(groups.map(g=>g.id)).size!==groups.length)fail(400,'Invalid group data')
        const old=JSON.parse(get("SELECT value FROM settings WHERE key='groups'")?.value || '[]')
        const removed=old.filter(g=>!groups.some(candidate=>candidate.id===g.id))
        if(all("SELECT * FROM assets WHERE kind='items' AND deleted=0").some(row=>removed.some(g=>g.id===parsed(row).groupId)))fail(409,'Groups containing items cannot be deleted')
        run("INSERT OR REPLACE INTO settings VALUES('groups',?)",JSON.stringify(groups));return send(200,groups)
      }
    }
    const listing=path.match(/^\/api\/(items|stages)$/)
    if(listing && method==='GET') {
      const kind=listing[1],scope=url.searchParams.get('scope'),ref=url.searchParams.get('stage')
      if(scope==='all'){requireUser(user);if(!designer(user))fail(403,'Studio access is required')}
      const link=linkedStage(user,profile,ref),grants=link?parsed(link).shareEquipmentIds || []:[]
      const rows=all('SELECT * FROM assets WHERE kind=? AND deleted=0',kind)
      // Keep approved working copies for saved projects and links, but omit them
      // from normal libraries until their creator makes further changes.
      const incorporated=row=>row.owner_id && all("SELECT * FROM submissions WHERE kind=? AND asset_id=? AND status='approved'",kind,row.id).some(s=>JSON.parse(s.snapshot).revision===row.revision && published(asset(kind,s.target_id)))
      const visible=rows.filter(row=>{
        if(!canView(user,row))return false
        if(!ref && incorporated(row))return false
        if(scope==='all')return canEdit(user,row)||published(row)
        if(kind==='stages')return stageAccess(row,user,profile,ref)
        return (published(row)&&belongsToProfile(parsed(row),profile)) || row.owner_id===user?.id || (link&&row.owner_id===link.owner_id&&grants.includes(row.id))
      }).map(row=>{
        const value=parsed(row)
        if(scope==='all') {
          const proposal=row.owner_id===user?.id ? get('SELECT status,snapshot FROM submissions WHERE kind=? AND asset_id=? ORDER BY created DESC LIMIT 1',kind,row.id) : null
          const unsentChanges=!!proposal && JSON.parse(proposal.snapshot).revision!==row.revision
          return {...value,workflowStatus:unsentChanges&&proposal.status==='approved'?'draft':proposal?.status || (row.owner_id?'draft':'approved'),unsentChanges}
        }
        return profileItem(clean(value),profile)
      })
      return send(200,visible.sort((a,b)=>a.label.localeCompare(b.label)))
    }
    const submissionMatch=path.match(/^\/api\/submissions(?:\/([a-f0-9]+)\/(approve|reject|edit))?$/)
    if(submissionMatch) {
      requireUser(user)
      if(method==='GET' && !submissionMatch[1])return send(200,all(manager(user)?'SELECT * FROM submissions ORDER BY created DESC':'SELECT * FROM submissions WHERE owner_id=? ORDER BY created DESC',...(manager(user)?[]:[user.id])).filter(s=>user.empire||!empireOnly(JSON.parse(s.snapshot))).map(s=>({...s,snapshot:JSON.parse(s.snapshot),owner_name:userLabel(s.owner_id)})))
      if(method==='POST' && !submissionMatch[1]) {
        if(!designer(user))fail(403,'Contributor access is required')
        const input=await body(request),row=asset(input.kind,input.assetId)
        if(!row || row.deleted || row.owner_id!==user.id)fail(403,'Submit one of your personal assets')
        const data=parsed(row)
        const previous=all('SELECT * FROM submissions WHERE owner_id=? AND kind=? ORDER BY created DESC',user.id,input.kind).find(s=>s.asset_id===row.id || (data.proposedReplacementId ? s.target_id===data.proposedReplacementId : JSON.parse(s.snapshot).label.trim().toLowerCase()===data.label.trim().toLowerCase()))
        const nameMatches=all('SELECT * FROM assets WHERE kind=? AND owner_id IS NULL AND deleted=0',input.kind).filter(candidate=>published(candidate)&&parsed(candidate).label.trim().toLowerCase()===data.label.trim().toLowerCase())
        const targetId=data.proposedReplacementId || (previous?.asset_id===row.id ? previous.target_id : null) || previous?.target_id || (nameMatches.length===1 ? nameMatches[0].id : null)
        const target=targetId ? asset(input.kind,targetId) : null
        if(target&&!canView(user,target))fail(403,'Empire access is required')
        if(data.proposedReplacementId && !published(target))fail(400,'Replacement target is unavailable')
        if(previous) {
          run("UPDATE submissions SET asset_id=?,snapshot=?,target_id=?,target_revision=?,status='pending',review_note='',created=? WHERE id=?",row.id,JSON.stringify(data),target?.id || previous.target_id,target?.revision || 0,new Date().toISOString(),previous.id)
          return send(200,{id:previous.id,status:'pending',updated:true})
        }
        const id=uid();run('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?)',id,input.kind,row.id,user.id,JSON.stringify(data),target?.id || 'shared-'+uid(),target?.revision || 0,'pending','',new Date().toISOString())
        return send(201,{id,status:'pending'})
      }
      if(method==='POST' && submissionMatch[1]) {
        requireManager(user);const input=await body(request),submission=get('SELECT * FROM submissions WHERE id=?',submissionMatch[1])
        if(submission&&!user.empire&&empireOnly(JSON.parse(submission.snapshot)))fail(403,'Empire access is required')
        if(!submission || submission.status!=='pending')fail(409,'Submission is no longer pending')
        const feedback=()=>{
          if(input.note===undefined || input.note===submission.review_note)return submission.review_note
          const message=String(input.note || '').replace(/\n\nReviewer: [^\n]*$/,'').trim().slice(0,2000)
          if(!message)return ''
          return message+'\n\nReviewer: '+userLabel(user.id)
        }
        if(input.snapshotRevision!==undefined && input.snapshotRevision!==JSON.parse(submission.snapshot).revision)fail(409,'The contributor updated this proposal. Reload and review it again')
        if(input.submittedAt!==undefined && input.submittedAt!==submission.created)fail(409,'The proposal changed. Reload and review it again')
        const value=transaction(()=>{
          let result
          if(submissionMatch[2]==='edit') {
            if(!['new','update','approve'].includes(input.action))fail(400,'Choose a save action')
            const original=JSON.parse(submission.snapshot)
            const edited={...input.data,id:original.id,revision:original.revision,ownerId:original.ownerId,proposedReplacementId:original.proposedReplacementId,profiles:input.data.profiles || original.profiles}
            validateAsset(submission.kind,edited)
            if(!user.empire&&empireOnly(edited))fail(403,'Empire access is required')
            if(input.action==='new') {
              const data={...edited,id:'shared-'+uid()};delete data.proposedReplacementId;delete data.shareToken;delete data.shareEquipmentIds
              if(!data.profiles.length)data.profiles=['external']
              if(submission.kind==='stages')data.visibility='listed'
              return saveAsset(submission.kind,data.id,data,user,null)
            }
            if(input.action==='update') {
              const draft=asset(submission.kind,submission.asset_id)
              if(!draft || draft.deleted || draft.owner_id!==submission.owner_id)fail(409,'The contributor draft is no longer available')
              if(draft.revision!==original.revision)fail(409,'The contributor changed their personal copy after submitting. Ask them to resubmit before saving reviewer edits')
              const privateData=parsed(draft)
              const updated={...edited,stockQuantity:null,visibility:privateData.visibility,shareToken:privateData.shareToken,shareEquipmentIds:privateData.shareEquipmentIds,proposedReplacementId:privateData.proposedReplacementId}
              validateAsset(submission.kind,updated)
              const saved=saveAsset(submission.kind,draft.id,updated,user,draft.owner_id)
              submission.snapshot=JSON.stringify(saved)
              submission.created=new Date().toISOString()
              submission.review_note=feedback()
              run('UPDATE submissions SET snapshot=?,created=?,review_note=? WHERE id=?',submission.snapshot,submission.created,submission.review_note,submission.id)
              return {...submission,snapshot:saved}
            }
            submission.snapshot=JSON.stringify(edited)
            submission.created=new Date().toISOString()
            run('UPDATE submissions SET snapshot=?,created=? WHERE id=?',submission.snapshot,submission.created,submission.id)
          }
          if(submissionMatch[2]==='approve'||submissionMatch[2]==='edit') {
            if(input.mode && !['update','new'].includes(input.mode))fail(400,'Choose update or new')
            const createNew=input.mode==='new'
            if(input.targetId && input.targetId!==submission.target_id)fail(400,'A submission can only update its original library item')
            const chosenTarget=submission.target_id
            const current=createNew ? null : asset(submission.kind,chosenTarget)
            if(input.mode==='update' && !current)fail(400,'Choose an existing shared item to update')
            if(current && !shared(current))fail(409,'The shared item is no longer available')
            if(current&&!canView(user,current))fail(403,'Empire access is required')
            const expectedRevision=input.targetId ? input.targetRevision : submission.target_revision
            if(!createNew && (current?.revision || 0)!==expectedRevision)fail(409,'The shared asset changed after submission. Ask for an updated proposal, or publish as a new item')
            const data=JSON.parse(submission.snapshot);data.id=createNew?'shared-'+uid():chosenTarget;data.profiles=input.profiles || (current?assetProfiles(parsed(current)):assetProfiles(data))
            if(submission.kind==='items')data.stockQuantity=current ? parsed(current).stockQuantity ?? null : null
            if(!data.profiles.length)data.profiles=['external']
            if(!user.empire&&empireOnly(data))fail(403,'Empire access is required')
            delete data.shareToken;delete data.shareEquipmentIds;delete data.proposedReplacementId
            if(submission.kind==='stages')data.visibility='listed'
            validateAsset(submission.kind,data);result=saveAsset(submission.kind,data.id,data,user,null)
            run('UPDATE submissions SET target_id=?,target_revision=? WHERE id=?',result.id,result.revision,submission.id)
          }
          run('UPDATE submissions SET status=?,review_note=? WHERE id=?',submissionMatch[2]==='reject'?'rejected':'approved',feedback(),submission.id)
          return result || {status:'rejected'}
        });return send(200,value)
      }
    }
    const assetMatch=path.match(/^\/api\/(items|stages)\/([a-z0-9-]+)(?:\/(history|restore|fork))?$/)
    if(assetMatch) {
      const [,kind,id,action]=assetMatch
      let row=asset(kind,id)
      if(!validId(id))fail(400,'Invalid asset ID')
      if(row&&!canView(user,row))fail(404,'Asset not found')
      if(action==='fork' && method==='POST') {
        requireUser(user);if(!designer(user)||!row||row.deleted||(!published(row)&&!canEdit(user,row)))fail(403,'This asset cannot be copied')
        const existing=all('SELECT * FROM assets WHERE kind=? AND owner_id=? AND deleted=0',kind,user.id).find(candidate=>parsed(candidate).proposedReplacementId===id)
        if(existing) {
          const approved=all("SELECT snapshot FROM submissions WHERE kind=? AND asset_id=? AND status='approved'",kind,existing.id).some(s=>JSON.parse(s.snapshot).revision===existing.revision)
          return send(200,approved?transaction(()=>saveAsset(kind,existing.id,parsed(existing),user,user.id)):parsed(existing))
        }
        const data=parsed(row);data.id='personal-'+uid();data.proposedReplacementId=!row.owner_id ? row.id : data.proposedReplacementId;data.stockQuantity=null;data.profiles=user.empire?assetProfiles(data):['external'];data.visibility='draft';delete data.shareToken;delete data.shareEquipmentIds
        return send(201,transaction(()=>saveAsset(kind,data.id,data,user,user.id)))
      }
      if(action==='history' && method==='GET') {
        requireUser(user);if(!canEdit(user,row))fail(403,'You cannot view this history')
        return send(200,all('SELECT revision,created,actor,deleted,data FROM revisions WHERE kind=? AND asset_id=? ORDER BY revision DESC',kind,id).map(r=>({...r,data:JSON.parse(r.data)})))
      }
      if(action==='restore' && method==='POST') {
        requireUser(user);if(!row||!canEdit(user,row))fail(403,'You cannot restore this asset')
        const input=await body(request),revision=get('SELECT * FROM revisions WHERE kind=? AND asset_id=? AND revision=?',kind,id,input.revision)
        if(!revision)fail(404,'Revision not found')
        const data=JSON.parse(revision.data);delete data.shareToken;if(kind==='stages'&&data.visibility==='link-only')data.shareToken=token()
        return send(200,transaction(()=>saveAsset(kind,id,data,user,row.owner_id)))
      }
      if(!action && method==='GET') {
        if(!row||row.deleted||(!published(row)&&!canEdit(user,row)))fail(404,'Asset not found')
        return send(200,canEdit(user,row)?parsed(row):clean(parsed(row)))
      }
      if(!action && method==='PUT') {
        requireUser(user);if(!designer(user)||row&&!canEdit(user,row))fail(403,'You cannot edit this asset. Create a personal copy instead')
        if(row?.deleted)fail(409,'Restore this asset before editing it')
        const input=await body(request);if(input.id!==id)fail(400,'Asset ID does not match URL');validateAsset(kind,input)
        if(!user.empire&&empireOnly(input))fail(403,'Empire access is required')
        if(!user.empire) {
          input.profiles=row?assetProfiles(parsed(row)):(kind==='items'&&!isEquipmentItem(input)?[]:['external'])
          input.stockQuantity=row?parsed(row).stockQuantity ?? null:null
        }
        delete input.workflowStatus;delete input.unsentChanges
        row=asset(kind,id)
        if(row&&!canEdit(user,row))fail(403,'You cannot edit this asset')
        if(row?.deleted || row && input.revision!==row.revision)fail(409,'This asset changed. Reload it before saving')
        const owner=row ? row.owner_id : manager(user)&&!input.personal ? null : user.id
        if(owner && row)input.proposedReplacementId=parsed(row).proposedReplacementId
        delete input.personal
        if(owner){input.stockQuantity=null;if(!input.profiles?.length)input.profiles=['external']}
        if(kind==='stages') {
          const previous=parsed(row),reset=input.resetShareLink===true
          delete input.shareToken
          if(owner && input.visibility==='listed')input.visibility='draft'
          if(input.visibility==='link-only')input.shareToken=!reset&&previous?.visibility==='link-only'&&previous.shareToken || token()
          const grants=input.shareEquipmentIds || []
          if(!Array.isArray(grants)||grants.some(itemId=>{const equipment=asset('items',itemId);return !equipment||equipment.deleted||!published(equipment)&&equipment.owner_id!==owner}))fail(403,'Only your own personal equipment or published equipment can be shared with this stage')
          input.shareEquipmentIds=grants
        }
        return send(200,transaction(()=>saveAsset(kind,id,input,user,owner)))
      }
      if(!action && method==='DELETE') {
        requireUser(user);if(!row||!canEdit(user,row))fail(403,'You cannot delete this asset')
        if(row.deleted)fail(409,'Asset is already deleted')
        transaction(()=>saveAsset(kind,id,parsed(row),user,row.owner_id,1));return send(200,{id,deleted:true})
      }
    }
    if(path==='/api/trash' && method==='GET'){requireUser(user);if(!designer(user))fail(403,'Studio access is required');return send(200,all('SELECT * FROM assets WHERE deleted=1').filter(row=>canEdit(user,row)&&canView(user,row)).map(row=>({...parsed(row),kind:row.kind})))}
    const projectMatch=path.match(/^\/api\/projects(?:\/([a-f0-9]+)(?:\/(share|history|restore|purge))?)?$/)
    if(projectMatch) {
      requireUser(user);const [,id,action]=projectMatch
      if(!id && method==='GET')return send(200,all('SELECT id,name,revision,deleted,updated,share_token FROM projects WHERE owner_id=? ORDER BY updated DESC',user.id))
      if(!id && method==='POST') {
        const input=await body(request);if(!Array.isArray(input.data?.items))fail(400,'Invalid project')
        const newId=uid(),name=String(input.name || 'Untitled stageplot').slice(0,200),json=JSON.stringify(input.data),now=new Date().toISOString()
        transaction(()=>{run('INSERT INTO projects VALUES(?,?,?,?,?,0,NULL,?)',newId,user.id,name,json,1,now);run('INSERT INTO project_revisions VALUES(?,?,?,?,?)',newId,1,json,name,now)})
        return send(201,{id:newId,revision:1})
      }
      let project=get('SELECT * FROM projects WHERE id=? AND owner_id=?',id,user.id)
      if(!project)fail(404,'Project not found')
      if((method==='GET'||action==='share'||action==='restore')&&!canViewProject(user,JSON.parse(project.data)))fail(403,'Empire access is required for this project')
      if(action==='purge' && method==='DELETE') {
        const input=await body(request)
        if(!project.deleted)fail(409,'Move this project to deleted projects first')
        if(input.revision!==project.revision)fail(409,'This project changed. Refresh the project list before deleting it permanently')
        transaction(()=>{run('DELETE FROM project_revisions WHERE project_id=?',id);run('DELETE FROM projects WHERE id=? AND owner_id=?',id,user.id)})
        return send(200,{deleted:true,permanent:true})
      }
      if(action==='history' && method==='GET')return send(200,all('SELECT revision,name,created FROM project_revisions WHERE project_id=? ORDER BY revision DESC',id))
      if(action==='share' && method==='POST') {
        if(project.deleted)fail(409,'Restore this project before sharing it')
        const input=await body(request),value=input.disable ? null : token()
        project=get('SELECT * FROM projects WHERE id=? AND owner_id=?',id,user.id)
        if(project.deleted)fail(409,'Restore this project before sharing it')
        run('UPDATE projects SET share_token=? WHERE id=?',value,id);return send(200,{token:value})
      }
      if(!action && method==='GET'){if(project.deleted)fail(404,'Project is deleted');return send(200,{id,name:project.name,revision:project.revision,data:JSON.parse(project.data)})}
      if((!action && method==='PUT') || (action==='restore' && method==='POST')) {
        const input=await body(request)
        project=get('SELECT * FROM projects WHERE id=? AND owner_id=?',id,user.id)
        if(!action && (project.deleted||input.revision!==project.revision))fail(409,'This project changed or was deleted. Reopen it before saving')
        const saved=action ? get('SELECT * FROM project_revisions WHERE project_id=? AND revision=?',id,input.revision) : null
        if(action&&!saved)fail(404,'Project revision not found')
        const data=action?JSON.parse(saved.data):input.data,name=String(action?saved.name:input.name || project.name).slice(0,200)
        if(!Array.isArray(data?.items))fail(400,'Invalid project')
        const json=JSON.stringify(data),revision=project.revision+1,now=new Date().toISOString()
        transaction(()=>{run('UPDATE projects SET name=?,data=?,revision=?,deleted=0,share_token=NULL,updated=? WHERE id=?',name,json,revision,now,id);run('INSERT INTO project_revisions VALUES(?,?,?,?,?)',id,revision,json,name,now)})
        return send(200,{id,revision})
      }
      if(!action && method==='DELETE'){run('UPDATE projects SET deleted=1,share_token=NULL WHERE id=?',id);return send(200,{deleted:true})}
    }
    const publicProject=path.match(/^\/api\/shared-projects\/([a-f0-9]{48})$/)
    if(publicProject&&method==='GET') {
      const project=get('SELECT data FROM projects WHERE share_token=? AND deleted=0',publicProject[1]);if(!project)fail(404,'Shared project is unavailable')
      const data=JSON.parse(project.data),ids=new Set(data.items.map(item=>item.assetId).filter(Boolean))
      if(!canViewProject(user,data))fail(403,'Empire access is required for this project')
      if(data.assetSnapshots)data.assetSnapshots={equipment:(data.assetSnapshots.equipment || []).filter(item=>ids.has(item.id)).map(clean),stage:data.assetSnapshots.stage && data.assetSnapshots.stage.id===data.stage?.id ? clean(data.assetSnapshots.stage) : null}
      return send(200,data)
    }
    fail(404,'Not found')
  }catch(error){if(!error.status)console.error(error);return send(error.status || 500,{error:error.status?error.message:'The request could not be completed'})}
})
server.listen(Number(process.env.STAGEPLOT_LIBRARY_PORT || 8787),process.env.STAGEPLOT_LIBRARY_HOST || '127.0.0.1',()=>console.log(`Stageplot equipment library: http://${process.env.STAGEPLOT_LIBRARY_HOST || '127.0.0.1'}:${server.address().port}\nData: ${root}`))
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}))
