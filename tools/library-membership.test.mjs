import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
import {assetProfiles,withProfile,isPublishedItem,isEquipmentItem} from './library-membership.mjs'

test('profile membership supports either, both, neither and Studio-only building blocks',()=>{
  const empire=withProfile({id:'chair',profiles:[]},'empire',true)
  const shared=withProfile(empire,'external',true)
  assert.deepEqual(assetProfiles(shared),['empire','external'])
  assert.deepEqual(assetProfiles(withProfile(shared,'empire',false)),['external'])
  assert.equal(isPublishedItem(withProfile(empire,'empire',false)),false)
  assert.equal(isEquipmentItem({editor:{advancedShapeRole:'custom'}}),false)
})

test('accounts enforce roles, asset ownership, approvals, revisions, sharing and project privacy', {timeout:30000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-accounts-'))
  const chair={schema:'stageplot-item@3',id:'existing-chair',label:'Chair',profiles:['empire','external'],stockQuantity:2,dimensions:{widthMeters:1,depthMeters:1},shapes:[],collisionShapes:[],editor:{layers:[]}}
  await mkdir(join(directory,'equipment-library'))
  await writeFile(join(directory,'equipment-library','chair.stageplot-item.json'),JSON.stringify(chair))
  const child=spawn(process.execPath,[fileURLToPath(new URL('./library-server.mjs',import.meta.url))],{env:{...process.env,STAGEPLOT_LIBRARY_ROOT:directory,STAGEPLOT_LIBRARY_PORT:'0',STAGEPLOT_SETUP_TOKEN:'test-setup-secret'},stdio:['ignore','pipe','pipe'],windowsHide:true})
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk)
  try {
    const base=await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',chunk=>{output+=chunk;const url=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(url)resolve(url[0]+'/api')});child.once('error',reject);child.once('exit',code=>reject(new Error(`Server exited ${code}: ${stderr}`)))})
    const jar={}
    const request=async(path,method='GET',data,actor='anonymous',status=200,extra={})=>{
      const response=await fetch(base+path,{method,headers:{...(method!=='GET'?{'X-Stageplot-Request':'1'}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...(jar[actor]?{Cookie:jar[actor]}:{}),...extra},...(data!==undefined?{body:JSON.stringify(data)}:{})})
      const value=await response.json()
      assert.equal(response.status,status,`${method} ${path} as ${actor}: ${JSON.stringify(value)}\n${stderr}`)
      const cookie=response.headers.get('set-cookie');if(cookie)jar[actor]=cookie.split(';')[0]
      return value
    }
    const password='testing-account-password'
    assert.equal((await request('/auth/session')).setupRequired,true)
    await request('/items/existing-chair','PUT',chair,'anonymous',401)
    await request('/items?scope=all','GET',undefined,'anonymous',401)
    await request('/auth/setup','POST',{email:'owner@example.com',password,setupToken:'wrong'},'owner',403)
    await request('/auth/setup','POST',{name:'Owner',email:'owner@example.com',password,setupToken:'test-setup-secret'},'owner',201)
    await request('/auth/setup','POST',{email:'second@example.com',password,setupToken:'test-setup-secret'},'anonymous',409)
    assert.equal((await request('/auth/session','GET',undefined,'owner')).user.role,'owner')
    const members={}
    for(const role of ['admin','contributor','editor']){
      members[role]=await request('/users','POST',{email:role+'@example.com',name:role,role,password},'owner',201)
      await request('/auth/login','POST',{email:role+'@example.com',password},role)
    }
    members.other=await request('/users','POST',{email:'other@example.com',role:'contributor',password},'owner',201)
    await request('/auth/login','POST',{email:'other@example.com',password},'other')
    await request('/users','GET',undefined,'admin',403)
    await request('/users','POST',{email:'bad@example.com',role:'owner',password},'contributor',403)
    await request('/items?scope=all','GET',undefined,'editor',403)
    await request('/items/existing-chair','PUT',chair,'editor',403)
    await request('/items/existing-chair','DELETE',undefined,'contributor',403)
    await request('/groups','PUT',[],'contributor',403)
    assert.equal((await request('/items?profile=empire'))[0].stockQuantity,2)
    assert.equal((await request('/items?profile=external'))[0].stockQuantity,null)
    let globalChair=await request('/items/existing-chair','GET',undefined,'admin')
    globalChair=await request('/items/existing-chair','PUT',{...globalChair,label:'Updated chair'},'admin')
    await request('/items/existing-chair','PUT',{...chair,revision:1},'admin',409)
    let personal=await request('/items/existing-chair/fork','POST',{},'contributor',201)
    assert.equal(personal.ownerId,members.contributor.id)
    assert.equal(personal.proposedReplacementId,chair.id)
    assert.equal(personal.stockQuantity,null)
    personal=await request('/items/'+personal.id,'PUT',{...personal,label:'Personal chair'},'contributor')
    assert.ok((await request('/items?profile=external','GET',undefined,'contributor')).some(i=>i.id===personal.id))
    assert.ok(!(await request('/items?profile=external')).some(i=>i.id===personal.id))
    assert.ok(!(await request('/items?scope=all','GET',undefined,'other')).some(i=>i.id===personal.id))
    await request('/items/'+personal.id,'GET',undefined,'other',404)
    await request('/items/'+personal.id,'PUT',personal,'other',403)
    await request('/items/'+personal.id,'GET',undefined,'admin',404)
    const submission=await request('/submissions','POST',{kind:'items',assetId:personal.id},'contributor',201)
    await request('/submissions','POST',{kind:'items',assetId:personal.id},'contributor',409)
    const submittedLabel=personal.label
    personal=await request('/items/'+personal.id,'PUT',{...personal,label:'Later draft revision'},'contributor')
    const queue=await request('/submissions','GET',undefined,'admin')
    assert.equal(queue[0].snapshot.label,submittedLabel)
    await request('/submissions/'+submission.id+'/approve','POST',{},'contributor',403)
    const approved=await request('/submissions/'+submission.id+'/approve','POST',{},'admin')
    assert.equal(approved.id,chair.id)
    assert.equal(approved.label,submittedLabel)
    assert.equal(approved.ownerId,null)
    assert.equal((await request('/items/'+personal.id,'GET',undefined,'contributor')).label,'Later draft revision')
    await request('/submissions/'+submission.id+'/approve','POST',{},'admin',409)
    const stale=await request('/submissions','POST',{kind:'items',assetId:personal.id},'contributor',201)
    globalChair=await request('/items/'+chair.id,'GET',undefined,'admin')
    await request('/items/'+chair.id,'PUT',{...globalChair,label:'Concurrent admin change'},'admin')
    await request('/submissions/'+stale.id+'/approve','POST',{},'admin',409)
    await request('/submissions/'+stale.id+'/reject','POST',{note:'Please rebase your proposal'},'admin')
    assert.equal((await request('/submissions','GET',undefined,'contributor'))[0].review_note,'Please rebase your proposal')
    assert.deepEqual(await request('/submissions','GET',undefined,'other'),[])
    const stage={schema:'stageplot-stage@1',id:'personal-stage',label:'Private stage',profiles:['external'],visibility:'link-only',shareEquipmentIds:[personal.id],dimensions:{widthMeters:10,depthMeters:5},boundary:{nodes:[{x:0,y:0},{x:10,y:0},{x:0,y:5}]},collisionBoundary:[],editor:{privateNotes:'not for clients'}}
    let savedStage=await request('/stages/'+stage.id,'PUT',stage,'contributor')
    const share=savedStage.shareToken;assert.match(share,/^[a-f0-9]{48}$/)
    assert.deepEqual(await request('/stages?profile=external'),[])
    assert.deepEqual(await request('/stages?profile=external&stage='+stage.id),[])
    assert.deepEqual(await request('/stages?profile=empire&stage='+share),[])
    const linked=await request('/stages?profile=external&stage='+share)
    assert.equal(linked[0].id,stage.id);assert.equal(linked[0].shareToken,undefined);assert.equal(linked[0].editor,undefined)
    assert.ok((await request('/items?profile=external&stage='+share)).some(i=>i.id===personal.id))
    const secret=await request('/items/unrelated','PUT',{...chair,id:'unrelated'},'other')
    await request('/stages/'+stage.id,'PUT',{...savedStage,shareEquipmentIds:[secret.id]},'contributor',403)
    savedStage=await request('/stages/'+stage.id,'PUT',{...savedStage,label:'Edited stage'},'contributor')
    assert.equal(savedStage.shareToken,share)
    savedStage=await request('/stages/'+stage.id,'PUT',{...savedStage,resetShareLink:true},'contributor')
    assert.notEqual(savedStage.shareToken,share)
    assert.deepEqual(await request('/stages?stage='+share),[])
    assert.ok(!(await request('/items?stage='+share)).some(i=>i.id===personal.id))
    await request('/stages/'+stage.id,'PUT',{...savedStage,visibility:'draft'},'contributor')
    assert.deepEqual(await request('/stages?stage='+savedStage.shareToken),[])
    assert.ok((await request('/stages','GET',undefined,'contributor')).some(s=>s.id===stage.id),'creator can use private drafts immediately')
    await request('/items/'+personal.id,'DELETE',undefined,'contributor')
    const trash=await request('/trash','GET',undefined,'contributor')
    assert.ok(trash.some(i=>i.id===personal.id))
    const history=await request('/items/'+personal.id+'/history','GET',undefined,'contributor')
    await request('/items/'+personal.id+'/restore','POST',{revision:history.at(-1).revision},'contributor')
    assert.equal((await request('/items/'+personal.id,'GET',undefined,'contributor')).label,'Updated chair')
    const data={schema:'stageplot-project@2',version:2,profile:'external',project:'My show',stage:null,items:[],assetSnapshots:{equipment:[],stage:null}}
    let project=await request('/projects','POST',{name:'My show',data},'editor',201)
    await request('/projects/'+project.id,'GET',undefined,'contributor',404)
    await request('/projects/'+project.id,'GET',undefined,'owner',404)
    await request('/projects/'+project.id,'DELETE',undefined,'other',404)
    assert.equal((await request('/projects','GET',undefined,'editor')).length,1)
    const projectLink=await request('/projects/'+project.id+'/share','POST',{},'editor')
    assert.deepEqual(await request('/shared-projects/'+projectLink.token),data)
    project=await request('/projects/'+project.id,'PUT',{name:'Renamed show',data:{...data,project:'Renamed show'},revision:project.revision},'editor')
    await request('/shared-projects/'+projectLink.token,'GET',undefined,'anonymous',404)
    await request('/projects/'+project.id,'PUT',{name:'Stale',data,revision:1},'editor',409)
    await request('/projects/'+project.id,'DELETE',undefined,'editor')
    await request('/projects/'+project.id+'/restore','POST',{revision:1},'editor')
    assert.equal((await request('/projects/'+project.id,'GET',undefined,'editor')).data.project,'My show')
    assert.equal((await request('/projects/'+project.id+'/history','GET',undefined,'editor')).length,3)
    const owner=(await request('/auth/session','GET',undefined,'owner')).user
    await request('/users/'+owner.id,'PUT',{role:'admin'},'owner',409)
    const oldCookie=jar.contributor
    await request('/auth/password','POST',{currentPassword:password,password:'new-testing-account-password'},'contributor')
    await request('/auth/login','POST',{email:'contributor@example.com',password},'unused',401)
    jar.old=oldCookie;assert.equal((await request('/auth/session','GET',undefined,'old')).user,null)
    await request('/users/'+members.editor.id,'PUT',{disabled:true},'owner')
    assert.equal((await request('/auth/session','GET',undefined,'editor')).user,null)
    await request('/auth/login','POST',{email:'editor@example.com',password},'editor',401)
    await request('/auth/logout','POST',{},'admin')
    await request('/items/'+chair.id,'DELETE',undefined,'admin',401)
    const badOrigin=await fetch(base+'/auth/session',{headers:{Origin:'https://untrusted.example'}});assert.equal(badOrigin.status,403)
    const missingProtection=await fetch(base+'/auth/logout',{method:'POST',headers:{Cookie:jar.owner}});assert.equal(missingProtection.status,403)
    assert.deepEqual(JSON.parse(await readFile(join(directory,'equipment-library','chair.stageplot-item.json'),'utf8')),chair,'initial JSON library is preserved as an import source')
  } finally {
    const exited=child.exitCode===null?once(child,'exit'):null;child.kill();if(exited)await exited
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-accounts-'))
    await rm(directory,{recursive:true,force:true})
  }
})
