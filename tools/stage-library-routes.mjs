import {uid,manager,fail} from './account-store.mjs'

export function createStageLibraryRoutes(store,model) {
  const {all,get,run,transaction}=store
  const {requireUser,requireAdmin,publicStage,stageSummary,stageRow,accessStage,normaliseStage,now,text}=model
  return async({route,method,user,body,reply})=>{
    if(route==='/public-stages'&&method==='GET')return reply(200,all('SELECT * FROM wf_stages WHERE generic=0').filter(publicStage).map(stage=>stageSummary(stage,user)))
    if(route==='/stage-submissions'&&method==='GET'){
      requireUser(user)
      return reply(200,all(manager(user)?'SELECT * FROM wf_stage_submissions ORDER BY updated DESC':'SELECT * FROM wf_stage_submissions WHERE owner_id=? ORDER BY updated DESC',...(manager(user)?[]:[user.id])).map(row=>({...row,snapshot:JSON.parse(row.snapshot),ownerName:get('SELECT name FROM users WHERE id=?',row.owner_id)?.name||'Creator'})))
    }
    const submit=route.match(/^\/stages\/([a-z0-9-]+)\/submit$/)
    if(submit&&method==='POST'){
      requireUser(user);const input=await body()
      return reply(200,transaction(()=>{const stage=accessStage(submit[1],user,true);if(!stage.owner_id||stage.generic||publicStage(stage))fail(400,'This stage is already maintained as a public source');if(input.version!==stage.version)fail(409,'Save or reopen the latest stage version first');const previous=get('SELECT id FROM wf_stage_submissions WHERE stage_id=?',stage.id)
        if(previous)run("UPDATE wf_stage_submissions SET snapshot=?,source_version=?,revision=revision+1,status='pending',feedback='',updated=? WHERE id=?",stage.data,stage.version,now(),previous.id)
        else run("INSERT INTO wf_stage_submissions VALUES(?,?,?,?,?,1,'pending','',?)",uid(),stage.id,stage.owner_id,stage.data,stage.version,now())
        return stageSummary(stage,user,true)
      }))
    }
    const review=route.match(/^\/stage-submissions\/([a-f0-9]+)$/)
    if(review&&method==='POST'){
      requireAdmin(user);const input=await body()
      return reply(200,transaction(()=>{
        const proposal=get('SELECT * FROM wf_stage_submissions WHERE id=?',review[1]);if(!proposal||proposal.status!=='pending')fail(409,'Stage submission is no longer pending');if(input.revision!==proposal.revision)fail(409,'Stage submission changed. Reopen before reviewing');if(!['save','approve','decline'].includes(input.action))fail(400,'Choose save, approve or decline')
        const original=JSON.parse(proposal.snapshot),data=input.data?normaliseStage(input.data,proposal.stage_id,user,original):original,feedback=text(input.feedback||'',2000)
        if(input.action==='approve'){
          const publication=get('SELECT public_id FROM wf_stage_publications WHERE source_id=?',proposal.stage_id),id=publication?.public_id||'stage-public-'+uid(),existing=publication?stageRow(id):null,version=(existing?.version||0)+1
          const published={...data,id,editor:data.editor?{...data.editor,referenceImages:[]}:undefined}
          run('INSERT INTO wf_stages VALUES(?,NULL,?,?,?,0,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data,version=excluded.version,updated=excluded.updated',id,published.label,JSON.stringify(published),version,now(),now())
          run('INSERT INTO wf_stage_versions VALUES(?,?,?)',id,version,JSON.stringify(published))
          run('INSERT INTO wf_stage_publications VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET approved_by=excluded.approved_by,approved=excluded.approved',proposal.stage_id,id,user.id,now())
        }
        const status=input.action==='save'?'pending':input.action==='approve'?'approved':'declined'
        run('UPDATE wf_stage_submissions SET snapshot=?,feedback=?,status=?,revision=revision+1,updated=? WHERE id=?',JSON.stringify(data),feedback,status,now(),proposal.id)
        return {status}
      }))
    }
    return false
  }
}
