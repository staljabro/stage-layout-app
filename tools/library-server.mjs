import {createServer} from 'node:http'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {openStore,uid,token,digest,roles,manager,designer,fail,publicUser} from './account-store.mjs'
import {createGithubAuth} from './github-auth.mjs'
import {assetProfiles,belongsToProfile,isPublishedItem,isEquipmentItem,profileItem,validProfiles,LIBRARY_PROFILES} from './library-membership.mjs'

const root=resolve(process.env.STAGEPLOT_LIBRARY_ROOT || resolve(dirname(fileURLToPath(import.meta.url)),'..'))
const store=await openStore(root)
const {db,get,all,run,transaction,asset,saveAsset}=store
const githubAuth=createGithubAuth(store)
const validId=value=>typeof value==='string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
const parsed=row=>row ? {...JSON.parse(row.data),revision:row.revision,ownerId:row.owner_id,deleted:!!row.deleted} : null
const canEdit=(user,row)=>designer(user) && (row?.owner_id ? row.owner_id===user.id || user.role==='owner' : manager(user))
const clean=data=>{const result={...data};for(const key of ['editor','shareToken','shareEquipmentIds','ownerId','deleted','proposedReplacementId','resetShareLink','assetSnapshot'])delete result[key];return result}
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
const linkedStage=(user,profile,ref)=>ref ? all("SELECT * FROM assets WHERE kind='stages' AND deleted=0").find(row=>stageAccess(row,user,profile,ref)) : null
const allowedOrigins=new Set((process.env.STAGEPLOT_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174').split(',').map(s=>s.trim()).filter(Boolean))
const sessionCookie=(request,value,age)=>`stageplot_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${request.headers['x-forwarded-proto']==='https' || process.env.STAGEPLOT_SECURE_COOKIE==='true' || process.env.STAGEPLOT_GITHUB_CALLBACK_URL?.startsWith('https://') ? '; Secure' : ''}`
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
    const startSession=account=>{const value=token();run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?)',digest(value),account.id,Date.now()+7*86400000);response.setHeader('Set-Cookie',[...(response.getHeader('Set-Cookie')?[].concat(response.getHeader('Set-Cookie')):[]),sessionCookie(request,value,7*86400)]);return publicUser(account)}
    if(await githubAuth({request,response,url,user,send,body,startSession}))return
    if(path==='/api/auth/logout' && method==='POST'){if(cookie)run('DELETE FROM sessions WHERE hash=?',digest(cookie));response.setHeader('Set-Cookie',sessionCookie(request,'',0));return send(200,{ok:true})}
    const userMatch=path.match(/^\/api\/users\/([a-f0-9]+)$/)
    if(userMatch && method==='PUT') {
      requireOwner(user);const input=await body(request),account=get('SELECT * FROM users WHERE id=?',userMatch[1]);if(!account)fail(404,'Account not found')
      const role=input.role || account.role,disabled=input.disabled===undefined?account.disabled:input.disabled?1:0
      if(!roles.includes(role))fail(400,'Invalid role')
      if(input.password!==undefined)fail(400,"Passwords are managed by GitHub")
      transaction(()=>{
        const latest=get('SELECT * FROM users WHERE id=?',account.id)
        if(latest.role==='owner' && !latest.disabled && (role!=='owner'||disabled) && get("SELECT count(*) AS n FROM users WHERE role='owner' AND disabled=0").n<=1)fail(409,'Keep at least one active Owner')
        run('UPDATE users SET role=?,disabled=? WHERE id=?',role,disabled,account.id);run('DELETE FROM sessions WHERE user_id=?',account.id)
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
      const visible=rows.filter(row=>{
        if(scope==='all')return canEdit(user,row)||published(row)
        if(kind==='stages')return stageAccess(row,user,profile,ref)
        return (published(row)&&belongsToProfile(parsed(row),profile)) || row.owner_id===user?.id || (link&&row.owner_id===link.owner_id&&grants.includes(row.id))
      }).map(row=>{
        const value=parsed(row)
        return scope==='all' ? value : profileItem(clean(value),profile)
      })
      return send(200,visible.sort((a,b)=>a.label.localeCompare(b.label)))
    }
    const submissionMatch=path.match(/^\/api\/submissions(?:\/([a-f0-9]+)\/(approve|reject))?$/)
    if(submissionMatch) {
      requireUser(user)
      if(method==='GET' && !submissionMatch[1])return send(200,all(manager(user)?'SELECT * FROM submissions ORDER BY created DESC':'SELECT * FROM submissions WHERE owner_id=? ORDER BY created DESC',...(manager(user)?[]:[user.id])).map(s=>({...s,snapshot:JSON.parse(s.snapshot)})))
      if(method==='POST' && !submissionMatch[1]) {
        if(!designer(user))fail(403,'Contributor access is required')
        const input=await body(request),row=asset(input.kind,input.assetId)
        if(!row || row.deleted || row.owner_id!==user.id)fail(403,'Submit one of your personal assets')
        const data=parsed(row),target=data.proposedReplacementId ? asset(input.kind,data.proposedReplacementId) : null
        if(data.proposedReplacementId && !published(target))fail(400,'Replacement target is unavailable')
        if(get("SELECT id FROM submissions WHERE asset_id=? AND status='pending'",row.id))fail(409,'This asset already has a pending submission')
        const id=uid();run('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?)',id,input.kind,row.id,user.id,JSON.stringify(data),target?.id || 'shared-'+uid(),target?.revision || 0,'pending','',new Date().toISOString())
        return send(201,{id,status:'pending'})
      }
      if(method==='POST' && submissionMatch[1]) {
        requireManager(user);const input=await body(request),submission=get('SELECT * FROM submissions WHERE id=?',submissionMatch[1])
        if(!submission || submission.status!=='pending')fail(409,'Submission is no longer pending')
        const value=transaction(()=>{
          let result
          if(submissionMatch[2]==='approve') {
            const current=asset(submission.kind,submission.target_id)
            if((current?.revision || 0)!==submission.target_revision)fail(409,'The shared asset changed after submission. Ask for a new proposal')
            const data=JSON.parse(submission.snapshot);data.id=submission.target_id;data.profiles=input.profiles || assetProfiles(data)
            if(submission.kind==='items')data.stockQuantity=current ? parsed(current).stockQuantity ?? null : null
            if(!data.profiles.length)data.profiles=['external']
            delete data.shareToken;delete data.shareEquipmentIds;delete data.proposedReplacementId
            if(submission.kind==='stages')data.visibility='listed'
            validateAsset(submission.kind,data);result=saveAsset(submission.kind,data.id,data,user,null)
          }
          run('UPDATE submissions SET status=?,review_note=? WHERE id=?',submissionMatch[2]==='approve'?'approved':'rejected',String(input.note || '').slice(0,2000),submission.id)
          return result || {status:'rejected'}
        });return send(200,value)
      }
    }
    const assetMatch=path.match(/^\/api\/(items|stages)\/([a-z0-9-]+)(?:\/(history|restore|fork))?$/)
    if(assetMatch) {
      const [,kind,id,action]=assetMatch
      let row=asset(kind,id)
      if(!validId(id))fail(400,'Invalid asset ID')
      if(action==='fork' && method==='POST') {
        requireUser(user);if(!designer(user)||!row||row.deleted||(!published(row)&&!canEdit(user,row)))fail(403,'This asset cannot be copied')
        const data=parsed(row);data.id='personal-'+uid();data.proposedReplacementId=!row.owner_id ? row.id : data.proposedReplacementId;data.stockQuantity=null;data.profiles=['external'];data.visibility='draft';delete data.shareToken;delete data.shareEquipmentIds
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
    if(path==='/api/trash' && method==='GET'){requireUser(user);if(!designer(user))fail(403,'Studio access is required');return send(200,all('SELECT * FROM assets WHERE deleted=1').filter(row=>canEdit(user,row)).map(row=>({...parsed(row),kind:row.kind})))}
    const projectMatch=path.match(/^\/api\/projects(?:\/([a-f0-9]+)(?:\/(share|history|restore))?)?$/)
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
      if(data.assetSnapshots)data.assetSnapshots={equipment:(data.assetSnapshots.equipment || []).filter(item=>ids.has(item.id)).map(clean),stage:data.assetSnapshots.stage && data.assetSnapshots.stage.id===data.stage?.id ? clean(data.assetSnapshots.stage) : null}
      return send(200,data)
    }
    fail(404,'Not found')
  }catch(error){if(!error.status)console.error(error);return send(error.status || 500,{error:error.status?error.message:'The request could not be completed'})}
})
server.listen(Number(process.env.STAGEPLOT_LIBRARY_PORT || 8787),process.env.STAGEPLOT_LIBRARY_HOST || '127.0.0.1',()=>console.log(`Stageplot equipment library: http://${process.env.STAGEPLOT_LIBRARY_HOST || '127.0.0.1'}:${server.address().port}\nData: ${root}`))
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}))
