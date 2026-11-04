import test from 'node:test'
import assert from 'node:assert/strict'
import {launchBrowser} from './browser-launch.mjs'
import {once} from 'node:events'
import {existsSync} from 'node:fs'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import {openStore} from './account-store.mjs'
import {createEventRoutes} from './event-routes.mjs'

const browser=[process.env.STAGEPLOT_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(path=>path&&existsSync(path))
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))

test('one canvas supports stage and equipment authoring, shared stages and self-registering private performances',{skip:!browser,timeout:90000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-event-browser-')),store=await openStore(directory)
  const jimmy={id:'jimmy',name:'Jimmy',role:'user',empire:false}
  store.run('INSERT INTO users VALUES(?,?,?,?,?,0,0,?)',jimmy.id,'jimmy@test.invalid','Jimmy','editor','','')
  const item=(id,label,width=1)=>({schema:'stageplot-item@3',id,label,profiles:['external'],dimensions:{widthMeters:width,depthMeters:1},shapes:[{id:'body',type:'rect',x:0,y:0,width,height:1,fill:'#e1e9c8',stroke:'#52633c',strokeWidth:1}],collisionShapes:[]})
  const items=[item('kit','Drum kit',2),item('mic','Mic stand',.5),item('chair','Orchestra chair',.5)]
  for(const value of items)store.saveAsset('items',value.id,value,jimmy)
  const quick={id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',name:'Rehearsal plan',revision:1,deleted:0,updated:'2026-10-28T00:00:00Z',data:{schema:'stageplot-project@2',version:2,profile:'external',project:'Rehearsal plan',stage:{kind:'rectangle',name:'Rehearsal room',width:10,depth:5},collisionSettings:{equipment:true,zone:true,snapping:true},layerFolders:[],items:[]}}
  const quickPlots=[quick]
  const reader={id:'reader',name:'Reader',role:'user',empire:false};store.run('INSERT INTO users(id,email,name,role,password) VALUES(?,?,?,?,?)',reader.id,'reader@test.invalid','Reader','editor','')
  let currentUser=jimmy,rejectSave=false
  const routes=createEventRoutes(store)
  let signedIn=true
  const fixture={name:'event-browser-fixture',configureServer(server){server.middlewares.use(async(request,response,next)=>{
    const url=new URL(request.url,'http://localhost')
    if(url.pathname.startsWith('/api/')){
      const send=(status,data)=>{response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(data))}
      const body=async()=>{let text='';for await(const chunk of request)text+=chunk;return JSON.parse(text||'{}')}
      try{
        if(rejectSave&&request.method==='PUT'&&url.pathname.startsWith('/api/band-links/'))return send(503,{error:'Temporary test outage'})
        if(await routes({path:url.pathname,method:request.method,user:signedIn?currentUser:null,body,send}))return
        if(url.pathname==='/api/auth/session')return send(200,{user:signedIn?currentUser:null,studioUrl:'/equipment-fixture',appUrl:'/event-fixture'})
        if(url.pathname==='/api/projects'){if(request.method==='POST'){const input=await body(),saved={...quick,id:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',name:input.name,data:input.data,revision:1};quickPlots.push(saved);return send(201,saved)}return send(200,quickPlots)}
        const selectedQuick=quickPlots.find(project=>url.pathname==='/api/projects/'+project.id)
        if(selectedQuick){if(request.method==='PUT'){const input=await body();assert.equal(input.revision,selectedQuick.revision);selectedQuick.name=input.name;selectedQuick.data=input.data;selectedQuick.revision++;selectedQuick.updated=new Date().toISOString()}return send(200,selectedQuick)}
        if(url.pathname==='/api/items')return send(200,items)
        if(url.pathname==='/api/groups'||url.pathname==='/api/stages')return send(200,[])
        return send(404,{error:'Not found'})
      }catch(error){return send(error.status||500,{error:error.message})}
    }
    if(url.pathname!=='/event-fixture')return next()
    const html=`<!doctype html><html><body><div id="root"></div><script type="module">
      import {createElement as h} from 'react';import {createRoot} from 'react-dom/client';
      import {AccountProvider} from '/src/accounts.jsx';import App from '/src/events.jsx';import '/src/styles.css';
      createRoot(document.getElementById('root')).render(h(AccountProvider,null,h(App)));
    </script></body></html>`
    response.setHeader('Content-Type','text/html');response.end(await server.transformIndexHtml(request.url,html))
  })}}
  const server=await createServer({cacheDir:join(directory,'vite-cache'),configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react(),fixture],resolve:{alias:{'polygon-clipping':fileURLToPath(new URL('./svg-shape-studio/node_modules/polygon-clipping/dist/polygon-clipping.cjs.js',import.meta.url)),'fit-curve':fileURLToPath(new URL('./svg-shape-studio/node_modules/fit-curve/lib/fit-curve.js',import.meta.url))},dedupe:['react','react-dom']},logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','fit-curve','polygon-clipping']}})
  let child,socket
  try{
    await server.listen()
    const launched=await launchBrowser(browser,join(directory,'browser'))
    child=launched.child
    const port=launched.port
    const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json()
    socket=new WebSocket(target.webSocketDebuggerUrl);await once(socket,'open')
    const pending=new Map(),browserErrors=[];let id=0
    socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Page.javascriptDialogOpening')socket.send(JSON.stringify({id:++id,method:'Page.handleJavaScriptDialog',params:{accept:true}}));if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(new Error(message.error.message));else task?.resolve(message.result)}})
    const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}))})
    const evaluate=async expression=>{const value=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(value.exceptionDetails)throw new Error(value.exceptionDetails.exception?.description||value.exceptionDetails.text);return value.result.value}
    const waitFor=async expression=>{for(let attempt=0;attempt<160;attempt++){if(await evaluate(`Boolean(${expression})`))return;await delay(75)}throw new Error('Did not reach '+expression+'\n'+await evaluate('document.body.innerText.slice(-3000)')+'\n'+browserErrors.join('\n'))}
    const click=async label=>{await waitFor(`Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()===${JSON.stringify(label)}&&!button.disabled)`);await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}&&!button.disabled).click()`)}
    const capture=async name=>{if(!process.env.STAGEPLOT_CAPTURE_UI)return;const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'stageplot-'+name+'.png'),Buffer.from(screenshot.data,'base64'))}
    const fill=async(selector,text)=>{await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.focus();input.select()})()`);await call('Input.insertText',{text});await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})}
    const addEquipment=async label=>{await waitFor(`Array.from(document.querySelectorAll('.custom-tool')).some(button=>button.textContent.includes(${JSON.stringify(label)}))`);await evaluate(`Array.from(document.querySelectorAll('.custom-tool')).find(button=>button.textContent.includes(${JSON.stringify(label)})).click()`)}
    const dragPointer=async(from,to)=>{await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x,y:from.y});await call('Input.dispatchMouseEvent',{type:'mousePressed',x:from.x,y:from.y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:to.x,y:to.y,buttons:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:to.x,y:to.y,button:'left',clickCount:1})}

    await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false})
    const base='http://127.0.0.1:'+server.httpServer.address().port
    await call('Page.navigate',{url:base+'/event-fixture'})
    await waitFor("document.querySelector('.events-heading h1')?.textContent==='Your workspace'")
    assert.equal(await evaluate("document.body.textContent.includes('Quick plot')"),false)
    await click('+ Create')
    assert.equal(await evaluate("document.querySelectorAll('.workspace-create-options button').length"),4)
    await evaluate("Array.from(document.querySelectorAll('.workspace-create-options button')).find(button=>button.querySelector('b').textContent==='Festival').click()")
    await fill('.event-dialog input','Summer festival');await click('Save')
    await waitFor("document.querySelector('.events-heading h1')?.textContent==='Summer festival'")
    const festival=store.get('SELECT * FROM events WHERE name=?','Summer festival')
    await click('Build your first stage');await fill('.event-dialog input','Main stage');await click('Create stage and open editor')
    await waitFor("document.querySelector('.unified-canvas.stage-canvas')")
    await click('Rectangular zone');await addEquipment('Drum kit');await click('Rectangular zone')
    assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),1)
    assert.ok(await evaluate("document.querySelector('.palette').textContent.includes('Stage layers')&&document.querySelector('.palette').textContent.includes('Fixed Equipment')"))
    await evaluate("document.querySelector('.equipment-layers button').click()")
    await click('Duplicate equipment');assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),2)
    await evaluate("document.querySelector('[aria-label=\"Undo\"]').click()")
    assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),1,'one undo history covers equipment and stage changes')
    await evaluate("document.querySelector('.equipment-layers button').click()")
    const beforeMove=await evaluate("document.querySelector('.placed-equipment').getAttribute('transform')")
    const equipmentPoint=await evaluate("(()=>{const rect=document.querySelector('.placed-equipment > rect').getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()")
    await dragPointer(equipmentPoint,{x:equipmentPoint.x+45,y:equipmentPoint.y-20})
    assert.notEqual(await evaluate("document.querySelector('.placed-equipment').getAttribute('transform')"),beforeMove,'real pointer dragging moves equipment on the shared canvas')
    await evaluate("document.querySelector('[aria-label=\"Undo\"]').click()")
    assert.equal(await evaluate("document.querySelector('.placed-equipment').getAttribute('transform')"),beforeMove)
    await click('Available Equipment')
    await evaluate("document.querySelector('.stock-category').open=true")
    await evaluate("document.querySelector('[aria-label=\"Available: Orchestra chair\"]').click()");await fill('.stock-inspector input[type=number]','40')
    await click('Quicksave');await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    const stage=store.get('SELECT * FROM event_stages WHERE event_id=?',festival.id),savedStage=JSON.parse(stage.data)
    assert.equal(savedStage.zones.length,2,'stage editing can continue after placing equipment without changing screens')
    assert.equal(savedStage.fixedEquipment.length,1)
    assert.equal(savedStage.availableEquipment[0].quantity,40)
    await capture('unified-stage-canvas')
    await click('Back to event');await click('Registration link');await click('Enable registration')
    await waitFor("document.querySelector('.event-dialog input[readonly]')")
    const invitationUrl=await evaluate("document.querySelector('.event-dialog input[readonly]').value")
    await click('Close')
    signedIn=false
    await call('Page.navigate',{url:invitationUrl})
    await waitFor("document.querySelector('.invitation-form')")
    await fill('.invitation-form input','Blue band');await click('Create my layout')
    await waitFor("document.querySelector('.unified-canvas.visitor-canvas')")
    const blue=store.get('SELECT * FROM event_bands WHERE name=?','Blue band')
    const blueUrl=await evaluate('window.location.href')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.creation-toolbar')).display"),'none')
    assert.equal(await evaluate("document.querySelector('.stage-boundary-editor').style.display"),'none')
    assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),0)
    assert.equal(await evaluate("document.querySelector('.locked-stage-layers')"),null,'layout layers omit locked stage details')
    await fill('.layout-notes textarea','Lead vocal, one mic stand.');await addEquipment('Mic stand')
    assert.equal(await evaluate("document.querySelector('.layout-notes')"),null,'layout details hide while equipment is selected')
    await click('Save now');await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',blue.id).data).items.length,1)
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'m',code:'KeyM',windowsVirtualKeyCode:77})
    assert.equal(await evaluate("document.querySelector('.stage-move-mode')"),null,'guest keyboard shortcuts cannot activate stage editing')
    rejectSave=true
    await addEquipment('Orchestra chair');await click('Save now');await waitFor("document.querySelector('.canvas-save-error')")
    await call('Page.reload');await waitFor("document.querySelector('.canvas-recovery')")
    assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),1)
    rejectSave=false
    await click('Restore local work');await click('Save now');await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',blue.id).data).items.length,2)
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',blue.id).data).assetSnapshots.stage.zones.length,2)
    const canvasBounds=await evaluate("(()=>{const rect=document.querySelector('.canvas').getBoundingClientRect();return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}})()")
    await dragPointer({x:canvasBounds.left+5,y:canvasBounds.top+5},{x:canvasBounds.right-5,y:canvasBounds.bottom-5})
    await waitFor("document.querySelectorAll('.equipment-layers button.active').length===2")
    await click('Duplicate equipment')
    assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),4,'marquee-selected equipment duplicates as a set')
    await evaluate("document.querySelector('[aria-label=\"Undo\"]').click()")
    await click('Save now');await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),2)
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
    await click('Submit for review');await waitFor("document.querySelector('.layout-notes')?.textContent.includes('Submitted')")
    await capture('visitor-equipment-canvas')
    await click('Equipment list');await waitFor("document.querySelector('.equipment-list-dialog[open]')")
    assert.equal(await evaluate("document.querySelectorAll('.equipment-list-dialog tbody tr').length"),2)
    await evaluate("document.querySelector('[aria-label=\"Close equipment list\"]').click()")
    await evaluate('window.print=()=>{window.pdfRequested=true}')
    await click('Export PDF');await waitFor('window.pdfRequested')
    await call('Page.navigate',{url:invitationUrl})
    await click('Register another performance');await fill('.invitation-form input','Green band');await click('Create my layout')
    await waitFor("document.querySelector('.unified-canvas.visitor-canvas')")
    const green=store.get('SELECT * FROM event_bands WHERE name=?','Green band')
    assert.notEqual(green.guest_token,blue.guest_token)
    assert.equal(await evaluate("document.querySelectorAll('.placed-equipment').length"),0,'every entrant starts with their own equipment')
    await addEquipment('Orchestra chair');await click('Save now');await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',blue.id).data).items.length,2)
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',green.id).data).items.length,1)
    signedIn=true
    await call('Page.navigate',{url:base+'/event-fixture?event='+festival.id})
    await waitFor("document.querySelectorAll('.event-band-row').length===2")
    await evaluate("Array.from(document.querySelectorAll('.event-band-row')).find(row=>row.textContent.includes('Blue band')).querySelector('.band-main-actions button:last-child').click()")
    await fill('.event-dialog textarea','Ready for the festival');await click('Approve plot')
    await call('Page.navigate',{url:blueUrl});await waitFor("document.querySelector('.layout-notes')?.textContent.includes('Ready for the festival')")
    await call('Page.navigate',{url:base+'/event-fixture?event='+festival.id})
    await click('Share / save stage');await fill('.event-dialog input','Reusable main stage');await click('Save')
    await waitFor("document.querySelector('.event-dialog h2')?.textContent.includes('Share stage')")
    await fill('.event-dialog form input','reader@test.invalid');await click('Grant access')
    await waitFor("document.querySelector('.stage-access-row')?.textContent.includes('Reader')")
    const shared=store.get('SELECT * FROM spaces WHERE name=?','Reusable main stage')
    currentUser=reader
    await call('Page.navigate',{url:base+'/event-fixture?view=spaces'})
    await waitFor("document.querySelector('.event-stage-card')?.textContent.includes('Reusable main stage')")
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.event-stage-card button')).some(button=>button.textContent==='Edit stage')"),false)
    await click('Use stage')
    await evaluate("Array.from(document.querySelectorAll('.workspace-create-options button')).find(button=>button.querySelector('b').textContent==='Client production').click()")
    await fill('.event-dialog input','Visiting production');await click('Save')
    await waitFor("document.querySelector('.events-heading h1')?.textContent==='Visiting production'")
    const production=store.get('SELECT * FROM events WHERE owner_id=?',reader.id)
    assert.equal(store.get('SELECT COUNT(*) AS n FROM event_bands WHERE event_id=?',production.id).n,1)
    await click('Edit stage & equipment');await waitFor("document.querySelector('.unified-canvas.stage-canvas')")
    await click('Rectangular zone');await click('Quicksave')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(JSON.parse(store.get('SELECT data FROM spaces WHERE id=?',shared.id).data).zones.length,2,'editing the recipients copy leaves the original unchanged')
    currentUser=jimmy
    await call('Page.navigate',{url:base+'/event-fixture?view=spaces'})
    await click('Share stage')
    await waitFor("document.querySelector('.stage-access-row select')")
    await evaluate("(()=>{const select=document.querySelector('.stage-access-row select');select.value='edit';select.dispatchEvent(new Event('change',{bubbles:true}))})()")
    await waitFor("document.querySelector('.stage-access-row select')?.value==='edit'")
    currentUser=reader
    await call('Page.navigate',{url:base+'/event-fixture?space='+shared.id})
    await waitFor("document.querySelector('.unified-canvas.stage-canvas')")
    await click('Rectangular zone');await click('Quicksave');await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(JSON.parse(store.get('SELECT data FROM spaces WHERE id=?',shared.id).data).zones.length,3,'explicit editor grants allow collaboration on the original')
    currentUser=jimmy
    await call('Page.navigate',{url:base+'/event-fixture?event='+festival.id})
    await click('Registration link');await click('Disable registration');await click('Continue');await click('Close')
    signedIn=false
    await call('Page.navigate',{url:invitationUrl});await waitFor("document.querySelector('[role=alert]')?.textContent.includes('no longer available')")
    await call('Page.navigate',{url:blueUrl});await waitFor("document.querySelector('.unified-canvas.visitor-canvas')")
    assert.deepEqual(browserErrors,[])

  }finally{
    if(child&&child.exitCode===null&&child.signalCode===null){const closed=once(child,'close');if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:2147483647,method:'Browser.close'}));else child.kill();const fallback=setTimeout(()=>child.kill('SIGKILL'),3000);try{await closed}finally{clearTimeout(fallback)}}
    socket?.close();await server.close();store.db.close()
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-event-browser-'))
    await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100})
  }
})
