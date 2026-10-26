import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {existsSync} from 'node:fs'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname,resolve,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'

const browser=[process.env.STAGEPLOT_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(path=>path&&existsSync(path))
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))

test('library tabs, compact rows, review dialogs and owner controls work in both apps',{skip:!browser,timeout:60000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-popups-'))
  const stage={schema:'stageplot-stage@1',id:'test-stage',label:'Test stage',profiles:['external'],dimensions:{widthMeters:10,depthMeters:5},boundary:{nodes:[{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:0,y:5}]},collisionBoundary:[],zones:[],revision:1}
  const item={schema:'stageplot-item@3',id:'test-chair',label:'Test chair',profiles:['external'],dimensions:{widthMeters:1,depthMeters:1},shapes:[{id:'seat',type:'rect',x:0,y:0,width:1,height:1,fill:'#ffffff',stroke:'#25261f',strokeWidth:1}],collisionShapes:[],editor:{layers:[]},revision:1,ownerId:null}
  const mutations=[],createdStages=[]
  let signedIn=false,accountRole='owner',empireAccess=false
  const proposals=[{id:'update-proposal',kind:'items',asset_id:'draft-chair',target_id:'test-chair',status:'pending',owner_name:'Test Contributor',created:'2026-10-25T00:00:00Z',snapshot:{...item,label:'Corrected chair'}},{id:'new-proposal',kind:'stages',asset_id:'draft-stage',target_id:'new-shared-stage',status:'pending',owner_name:'Test Contributor',created:'2026-10-25T00:00:00Z',snapshot:{...stage,label:'New stage'}}]

  const fixture={name:'popup-layout-fixture',configureServer(server){server.middlewares.use(async(request,response,next)=>{
    const url=new URL(request.url,'http://localhost')
    if(url.pathname.startsWith('/api/')) {
      if(['POST','PUT','DELETE'].includes(request.method)){let body='';for await(const chunk of request)body+=chunk;mutations.push({path:url.pathname,...JSON.parse(body || '{}')})}

      if(request.method==='PUT'&&url.pathname.startsWith('/api/stages/')){const saved={...mutations.at(-1),revision:1,ownerId:'owner'};const index=createdStages.findIndex(stage=>stage.id===saved.id);if(index<0)createdStages.push(saved);else createdStages[index]=saved;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(saved));return}
      const data=url.pathname==='/api/auth/session'?{user:signedIn?{id:'owner',name:'Test Owner',email:'owner@example.test',role:accountRole,empire:empireAccess}:null,appUrl:'/planner-fixture',studioUrl:'/studio-fixture',githubConfigured:true,ownerConfigured:true}:
        url.pathname==='/api/submissions'?[...proposals,...(accountRole==='contributor'?[{id:'declined-proposal',kind:'items',asset_id:'personal-feedback',status:'rejected',review_note:'Please correct the chair width.',snapshot:item}]:[])]:url.pathname==='/api/items'?[item,...(accountRole==='contributor'?[{...item,id:'personal-feedback',ownerId:'owner',label:'Personal chair'}]:[])]:url.pathname==='/api/stages'?[stage,...createdStages].filter(candidate=>!url.searchParams.has('stage')||candidate.id===url.searchParams.get('stage')):url.pathname.endsWith('/history')?[{revision:1,created:new Date().toISOString(),data:item}]:
        url.pathname==='/api/users'?[{id:'owner',name:'Test Owner',email:'owner@example.test',role:'owner'}]:
        url.pathname==='/api/access-requests'?[{github_id:'42',login:'test-user',name:'Test user',email:'user@example.test',status:'pending'}]:
        url.pathname==='/api/projects'?Array.from({length:20},(_,id)=>({id:String(id),name:'Saved show '+id,revision:1,deleted:id===19,updated:new Date().toISOString()})):[]
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify(data));return
    }
    if(!['/planner-fixture','/studio-fixture'].includes(url.pathname))return next()
    const studio=url.pathname==='/studio-fixture',app=studio?'/tools/svg-shape-studio/src':'/src'
    const html=`<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
      import {createElement as h} from 'react';
      import {createRoot} from 'react-dom/client';
      import {AccountProvider} from '/src/accounts.jsx';
      import App from '${app}/App.jsx';
      import '${app}/styles.css';
      createRoot(document.getElementById('root')).render(h(AccountProvider,{studio:${studio}},h(App)));
    </script></body></html>`
    response.setHeader('Content-Type','text/html');response.end(await server.transformIndexHtml(url.pathname,html))
  })}}
  const server=await createServer({cacheDir:join(directory,'vite-cache'),root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,plugins:[react(),fixture],resolve:{alias:{'polygon-clipping':fileURLToPath(new URL('./svg-shape-studio/node_modules/polygon-clipping/dist/polygon-clipping.cjs.js',import.meta.url)),'fit-curve':fileURLToPath(new URL('./svg-shape-studio/node_modules/fit-curve/lib/fit-curve.js',import.meta.url))},dedupe:['react','react-dom']},logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','fit-curve','polygon-clipping']}})
  let child,socket
  try {
    await server.listen()
    child=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{stdio:'ignore',windowsHide:true})
    let launchError
    child.on('error',error=>{launchError=error})
    let port
    for(let attempt=0;attempt<100;attempt++) {
      if(launchError)throw launchError
      if(child.exitCode!==null)throw new Error('Headless browser exited before startup')
      try{port=(await readFile(join(directory,'DevToolsActivePort'),'utf8')).split('\n')[0];break}catch{await delay(100)}
    }
    assert.ok(port,'Headless browser did not start')
    const target=await (await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json()
    socket=new WebSocket(target.webSocketDebuggerUrl)
    await once(socket,'open')
    const pending=new Map(),browserErrors=[];let id=0
    socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(new Error(message.error.message));else task?.resolve(message.result)}})
    const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}))})
    const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);return result.result.value}
    const waitFor=async expression=>{for(let attempt=0;attempt<150;attempt++){if(await evaluate(`Boolean(${expression})`))return;await delay(100)}throw new Error('Browser did not reach expected state: '+expression+'\n'+browserErrors.join('\n'))}
    const click=async text=>{await waitFor(`Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()===${JSON.stringify(text)})`);await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(text)}).click()`)}
    const modal=()=>evaluate(`(()=>{const dialog=document.querySelector('.account-dialog'),header=dialog.querySelector('header'),button=header.querySelector('button'),rect=dialog.getBoundingClientRect();return {inBody:dialog.parentElement.parentElement===document.body,color:getComputedStyle(header).color,background:getComputedStyle(button).backgroundColor,headerHeight:header.getBoundingClientRect().height,width:rect.width,top:rect.top,bottom:rect.bottom,viewport:innerHeight,scrollable:dialog.scrollHeight>dialog.clientHeight,formDisplay:dialog.querySelector('form')?getComputedStyle(dialog.querySelector('form')).display:null,topmost:!!document.elementFromPoint(rect.left+rect.width/2,rect.top+20)?.closest('.account-dialog')}})()`)
    await call('Runtime.enable')
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false})
    const base='http://127.0.0.1:'+server.httpServer.address().port
    await call('Page.navigate',{url:base+'/planner-fixture'})
    await waitFor(`document.querySelector('.stage-picker-backdrop') && document.querySelector('.top-actions button')`)
    await waitFor("document.querySelector('.stage-picker-actions button:last-child')?.textContent==='Sign in'")
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.stage-picker .btn.ghost')).color"),'rgb(48, 49, 44)')
    await evaluate("document.querySelector('.stage-picker-actions button:last-child').click()")
    await waitFor("document.querySelector('.account-dialog')")
    assert.equal((await modal()).topmost,true)
    signedIn=true
    await call('Page.navigate',{url:base+'/planner-fixture'})
    await waitFor("document.querySelector('.stage-picker-actions a')?.textContent==='Shape Studio'")
    assert.equal(await evaluate("document.querySelector('.stage-picker-actions a').getAttribute('href')"),'/studio-fixture')
    await click('Test Owner · owner')
    await waitFor(`document.querySelector('.account-dialog')`)
    let layout=await modal()
    assert.equal(layout.topmost,true,'account popup must appear above the stage picker')
    assert.equal(layout.inBody,true)
    await click('Manage users & access requests')
    await waitFor(`document.querySelector('.account-access-request')`)
    assert.equal((await modal()).formDisplay,'grid')
    await evaluate(`document.querySelector('[aria-label="Close account"]').click()`)
    await evaluate(`Array.from(document.querySelectorAll('.stage-picker-list button')).find(button=>button.textContent.includes('Test stage')).click()`)
    await click('Save / Load')
    await waitFor("document.querySelector('[aria-label=\"Save and load\"]')")
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.project-file-actions button')).map(b=>b.textContent).join(',')"),'Update cloud project,Save cloud project,New Project,Load Project File,Download Project File,Export PDF')
    assert.equal(await evaluate("document.querySelector('.project-file-actions button').disabled"),true)
    assert.equal(await evaluate("document.querySelectorAll('.top-actions .btn.primary').length"),1)
    await click('Close')
    assert.equal(await evaluate("document.querySelector('a.app-navigation').getAttribute('href')"),'/studio-fixture')
    await click('Help')
    await waitFor("document.querySelector('.help-dialog')")
    assert.ok(await evaluate("document.querySelector('.help-dialog').textContent.includes('Update cloud project')"))
    assert.ok(await evaluate("document.querySelector('.help-footer a').href.endsWith('/docs/USER_GUIDE.md')"))
    await evaluate("document.querySelector('[aria-label=\"Close help\"]').click()")
    await click('My projects')
    await waitFor(`document.querySelectorAll('.account-row').length===20`)
    layout=await modal()
    assert.equal(layout.scrollable,true)
    assert.ok(layout.top>=0 && layout.bottom<=layout.viewport,'long project list must stay inside the viewport')
    await evaluate('window.confirm=()=>true')
    await click('Delete permanently')
    await waitFor("!document.querySelector('.account-dialog button:disabled')")
    assert.ok(mutations.at(-1).path.endsWith('/purge'))

    await call('Page.navigate',{url:base+'/studio-fixture'})
    await click('Library')
    await waitFor("document.querySelector('.equipment-management-row.pending-update-row')")
    assert.equal(await evaluate("document.querySelectorAll('.library-tabs [role=tab]').length"),3)
    assert.equal(await evaluate("document.querySelectorAll('.equipment-management-modal .publish-equipment-toggle,.equipment-management-modal .stock-quantity-field').length"),0,'untagged users see no profile or stock controls')
    assert.equal(await evaluate("document.querySelector('a.app-navigation').getAttribute('href')"),'/planner-fixture')
    assert.equal(await evaluate("(()=>{const link=getComputedStyle(document.querySelector('.actions > a.app-navigation')),button=getComputedStyle(document.querySelector('.actions > button'));return ['fontSize','fontWeight','backgroundColor','color','borderTopColor','borderRadius','padding'].every(key=>link[key]===button[key])})()"),true,'Studio navigation must match toolbar button styling')

    assert.equal(await evaluate("new Set(Array.from(document.querySelectorAll('.library-tabs button')).map(b=>b.getBoundingClientRect().top)).size"),1)
    assert.ok(await evaluate("Array.from(document.querySelectorAll('.library-tabs button')).every(b=>b.getBoundingClientRect().width<200)"))
    assert.equal(await evaluate("document.querySelector('.equipment-management-row').getBoundingClientRect().height"),73)
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.pending-update-row')).borderRadius"),'0px')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.pending-update-row')).boxShadow"),'none')
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.equipment-management-modal button')).some(b=>b.textContent==='History')"),false)
    await click('Review update (1)')
    await waitFor("document.querySelector('[aria-label=\"Review submission\"]')")
    layout=await modal()
    assert.equal(layout.inBody,true)
    assert.equal(await evaluate("document.querySelectorAll('.submission-comparison figure').length"),2)
    assert.equal(await evaluate("document.querySelectorAll('.submission-comparison svg').length"),2)
    assert.equal(await evaluate("document.querySelector('.account-dialog select')"),null,'the update target cannot be selected')
    assert.equal(layout.color,'rgb(48, 49, 44)')
    assert.equal(layout.background,'rgb(255, 255, 255)')
    assert.ok(layout.headerHeight<70)
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.account-dialog button')).filter(b=>['Approve as new item','Approve item update','Decline'].includes(b.textContent)).length"),3)
    await click('Close')
    await click('Stages')
    await waitFor("!document.querySelector('#library-panel-stages').hidden")
    assert.ok(await evaluate("document.querySelector('.managed-stage-row').getBoundingClientRect().height<=73"))
    assert.equal(await evaluate("document.querySelectorAll('.managed-stage-row select[aria-label=\"Visibility for Test stage\"]').length"),1)
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Stage sharing\"]')"),null)
    await click('New items (1)')
    await waitFor("!document.querySelector('#library-panel-new').hidden")
    assert.equal(await evaluate("document.querySelectorAll('.new-submission-row').length"),1)
    await click('Review submission')
    await waitFor("document.querySelector('[aria-label=\"Review submission\"]')")
    assert.equal(await evaluate("document.querySelector('.account-dialog h3').textContent"),'New stage')
    await click('Close')
    await click('Review submission')
    await waitFor("document.querySelector('[aria-label=\"Review submission\"]')")
    await evaluate('window.confirm=()=>true')
    await click('Approve as new item')
    await waitFor("!document.querySelector('.account-dialog')")
    assert.equal(mutations.at(-1).mode,'new')
    await click('Review submission')
    await waitFor("document.querySelector('[aria-label=\"Review submission\"]')")
    await click('Decline')
    await waitFor("!document.querySelector('.account-dialog')")
    assert.ok(mutations.at(-1).path.endsWith('/reject'))
    await click('Equipment')
    await click('Review update (1)')
    await waitFor("document.querySelector('[aria-label=\"Review submission\"]')")
    await click('Approve item update')
    await waitFor("!document.querySelector('.account-dialog')")
    assert.equal(mutations.at(-1).mode,'update')
    assert.equal(mutations.at(-1).targetId,'test-chair')
    await evaluate("document.querySelector('.equipment-management-modal .modal-header button').click()")
    await click('Test Owner · owner')
    await click('Manage users & access requests')
    await waitFor(`document.querySelector('.account-access-request')`)
    assert.equal((await modal()).formDisplay,'grid')
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Role for owner@example.test\"]')"),null)
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.account-dialog option')).some(o=>o.value==='owner')"),false)
    await call('Emulation.setDeviceMetricsOverride',{width:480,height:640,deviceScaleFactor:1,mobile:false})
    layout=await modal()
    assert.ok(layout.width<=456 && layout.top>=0 && layout.bottom<=640,'account popup must fit a narrow viewport')
    accountRole='contributor'
    await call('Page.navigate',{url:base+'/studio-fixture'})
    await click('Library')
    await waitFor("document.querySelector('.library-tabs')")
    assert.equal(await evaluate("document.querySelectorAll('.library-tabs [role=tab]').length"),2)
    await click('View feedback')
    await waitFor("document.querySelector('[aria-label=\"Submission feedback\"]')")
    assert.equal(await evaluate("document.querySelector('.submission-feedback').textContent"),'Please correct the chair width.')
    await click('Close')
    await evaluate('window.confirm=()=>true')
    assert.equal(await evaluate("document.querySelectorAll('.equipment-management-row').length"),2,'shared item and personal copy both remain visible')
    assert.ok(await evaluate("document.querySelector('.equipment-management-modal').textContent.includes('Personal chair - Personal copy')"))
    await evaluate("Array.from(document.querySelectorAll('.equipment-management-row')).find(r=>r.textContent.includes('Test chair')).querySelectorAll('button')[1].click()")
    await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Save personal copy')")
    await click('Library')
    await waitFor("document.querySelector('.equipment-management-modal')")
    await evaluate("Array.from(document.querySelectorAll('.equipment-management-row')).find(r=>r.textContent.includes('Personal chair')).querySelectorAll('button')[1].click()")
    await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Update personal copy')")
    accountRole='owner'
    await call('Page.navigate',{url:base+'/studio-fixture'})
    await click('Library')
    await waitFor("document.querySelector('.equipment-management-row')")
    await evaluate('window.confirm=()=>true')
    await click('Edit')
    await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Update shape')")
    await click('Library')
    await click('Review update (1)')
    await click('Open submission in editor')
    await click('Save submission changes')
    await waitFor("document.querySelector('[aria-label=\"Save submission changes\"]')")
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.account-dialog button')).filter(b=>['Save new item','Update submitted item (without approving)','Approve changes'].includes(b.textContent)).length"),3)
    await click('Close')
    await waitFor("Array.from(document.querySelectorAll('.shape-grid button')).some(b=>b.textContent.includes('Text'))")
    await evaluate("Array.from(document.querySelectorAll('.shape-grid button')).find(b=>b.textContent.includes('Text')).click()")
    await waitFor("document.querySelector('.text-format-options')")
    assert.equal(await evaluate("(()=>{const text=getComputedStyle(document.querySelector('.inspector textarea')),number=getComputedStyle(document.querySelector('.inspector input[type=number]')),label=getComputedStyle(document.querySelector('.text-format-options label'));return text.fontSize===number.fontSize&&text.fontWeight===number.fontWeight&&text.fontFamily===number.fontFamily&&label.fontSize===number.fontSize})()"),true,'text inspector controls must share value typography')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.text-format-options')).marginBottom"),'14px')
    empireAccess=true
    await call('Page.navigate',{url:base+'/studio-fixture'})
    await waitFor("document.querySelector('button.app-navigation')")
    await click('Stageplot')
    await waitFor("document.querySelector('[aria-label=\"Choose Stageplot profile\"]')")
    assert.equal(await evaluate("document.querySelectorAll('.profile-choice').length"),2)
    assert.equal(await evaluate("new URL(Array.from(document.querySelectorAll('.profile-choice')).find(a=>a.textContent==='Empire Stageplot').href).searchParams.get('profile')"),'empire')
    assert.equal(await evaluate("new URL(Array.from(document.querySelectorAll('.profile-choice')).find(a=>a.textContent==='External Stageplot').href).searchParams.has('profile')"),false)
    await click('Close')
    await click('Library')
    await waitFor("document.querySelector('.stock-quantity-field')")
    assert.ok(await evaluate("document.querySelectorAll('.equipment-management-modal .publish-equipment-toggle').length>0"))
    await evaluate("document.querySelector('.equipment-management-modal .modal-header button').click()")
    await click('Help')
    await waitFor("document.querySelector('.help-dialog')")
    assert.ok(await evaluate("document.querySelector('.help-dialog').textContent.includes('Update submitted item (without approving)')"))
    assert.equal(await evaluate("document.querySelector('.help-dialog').textContent.includes('Public planner URL')"),false)

  }finally {
    if(child&&child.exitCode===null&&child.signalCode===null) {
      const closed=once(child,'close')
      // Let Chromium flush and stop its profile writers before deleting files.
      // Killing only its main process can leave those writers running on Linux.
      if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:2147483647,method:'Browser.close'}))
      else child.kill()
      const fallback=setTimeout(()=>child.kill('SIGKILL'),3000)
      try{await closed}finally{clearTimeout(fallback)}
    }
    socket?.close()
    await server.close()
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-popups-'))
    await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100})
  }
})
