import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {existsSync} from 'node:fs'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import {openStore} from './account-store.mjs'
import {createEventRoutes} from './event-routes.mjs'

const browser=[process.env.STAGEPLOT_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(path=>path&&existsSync(path))
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))

test('festival, theatre and twenty-group eisteddfod workflows use independent layouts and reusable venue spaces',{skip:!browser,timeout:90000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-event-browser-')),store=await openStore(directory)
  const jimmy={id:'jimmy',name:'Jimmy',role:'editor',empire:false}
  store.run('INSERT INTO users VALUES(?,?,?,?,?,0,0,?)',jimmy.id,'jimmy@test.invalid','Jimmy','editor','','')
  const item=(id,label,width=1)=>({schema:'stageplot-item@3',id,label,profiles:['external'],dimensions:{widthMeters:width,depthMeters:1},shapes:[{id:'body',type:'rect',x:0,y:0,width,height:1,fill:'#e1e9c8',stroke:'#52633c',strokeWidth:1}],collisionShapes:[]})
  const items=[item('kit','Drum kit',2),item('mic','Mic stand',.5),item('chair','Orchestra chair',.5)]
  for(const value of items)store.saveAsset('items',value.id,value,jimmy)
  const routes=createEventRoutes(store)
  let signedIn=true
  const fixture={name:'event-browser-fixture',configureServer(server){server.middlewares.use(async(request,response,next)=>{
    const url=new URL(request.url,'http://localhost')
    if(url.pathname.startsWith('/api/')){
      const send=(status,data)=>{response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(data))}
      const body=async()=>{let text='';for await(const chunk of request)text+=chunk;return JSON.parse(text||'{}')}
      try{
        if(await routes({path:url.pathname,method:request.method,user:signedIn?jimmy:null,body,send}))return
        if(url.pathname==='/api/auth/session')return send(200,{user:signedIn?jimmy:null,studioUrl:'/equipment-fixture',appUrl:'/event-fixture'})
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
    child=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+join(directory,'browser'),'about:blank'],{stdio:'ignore',windowsHide:true})
    let port
    for(let attempt=0;attempt<100;attempt++){try{port=(await readFile(join(directory,'browser','DevToolsActivePort'),'utf8')).split('\n')[0];break}catch{await delay(100)}}
    assert.ok(port,'Headless browser started')
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
    const select=async(label,value)=>evaluate(`(()=>{const input=Array.from(document.querySelectorAll('label')).find(label=>label.textContent.startsWith(${JSON.stringify(label)})).querySelector('select');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    const addEquipment=async label=>{await waitFor(`Array.from(document.querySelectorAll('.custom-tool')).some(button=>button.textContent.includes(${JSON.stringify(label)}))`);await evaluate(`Array.from(document.querySelectorAll('.custom-tool')).find(button=>button.textContent.includes(${JSON.stringify(label)})).click()`)}
    await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false})
    const base='http://127.0.0.1:'+server.httpServer.address().port
    await call('Page.navigate',{url:base+'/event-fixture'})
    await click('Create your first event');await fill('.event-dialog input','Summer festival');await click('Save')
    await waitFor("document.querySelector('.events-heading h1')?.textContent==='Summer festival'")
    await click('Build your first stage');await fill('.event-dialog input','Main stage');await click('Create stage and edit outline')
    await waitFor("document.querySelector('.stage-setup-editor .app')")
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.stage-setup-editor .app > main')).display"),'grid')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.stage-setup-editor .canvas')).stroke"),'none','planner SVG defaults must not bleed into stage authoring')
    await capture('stage-setup')
    await click('Rectangular zone');await click('Save stage version')
    await waitFor("document.querySelector('.toast')?.textContent==='Stage version saved'")
    await click('Back to event');await click('House equipment')
    await waitFor("Array.from(document.querySelectorAll('.custom-tool')).some(button=>button.textContent.includes('Drum kit'))")
    await evaluate("Array.from(document.querySelectorAll('.custom-tool')).find(button=>button.textContent.includes('Drum kit')).click()")
    await click('Save now')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    await click('Back to event')
    for(const name of ['The Satellites','Paper Tigers']){await click('+ Add band');await fill('.event-dialog input',name);await click('Save');await waitFor("!document.querySelector('.event-dialog')")}
    const bands=store.all('SELECT * FROM event_bands ORDER BY name')
    await capture('event-overview')
    assert.equal(bands.length,2)
    const satellites=bands.find(band=>band.name==='The Satellites'),tigers=bands.find(band=>band.name==='Paper Tigers')
    assert.equal(JSON.parse(satellites.data).assetSnapshots.stage.fixedEquipment.length,1)
    signedIn=false
    await call('Page.navigate',{url:base+'/event-fixture?band='+satellites.guest_token})
    await waitFor("document.querySelector('.house-equipment-list')?.textContent.includes('Drum kit')")
    assert.equal(await evaluate("document.querySelectorAll('.placed-item').length"),0)
    await delay(1400)
    assert.equal(store.get('SELECT revision FROM event_bands WHERE id=?',satellites.id).revision,1,'opening a plot does not save or change its status')
    await evaluate("Array.from(document.querySelectorAll('.custom-tool')).find(button=>button.textContent.includes('Mic stand')).click()")
    await fill('.workspace-context textarea','Lead vocal, one mic stand please.')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',satellites.id).data).items.length,1)
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',tigers.id).data).items.length,0)
    await click('Submit for review')
    await waitFor("document.querySelector('.workspace-context')?.textContent.includes('Submitted')")
    await capture('band-plot')
    await evaluate('window.print=()=>{window.pdfRequested=true}')
    await click('Export PDF');await waitFor('window.pdfRequested')
    signedIn=true
    await call('Page.navigate',{url:base+'/event-fixture?event='+satellites.event_id})
    await waitFor("document.querySelector('.band-status.submitted')")
    await evaluate("Array.from(document.querySelectorAll('.event-band-row')).find(row=>row.textContent.includes('The Satellites')).querySelector('.band-main-actions button:last-child').click()")
    await fill('.event-dialog textarea','Approved. See you on stage!');await click('Approve plot')
    await waitFor("document.querySelector('.band-status.approved')")
    signedIn=false
    await call('Page.navigate',{url:base+'/event-fixture?band='+satellites.guest_token})
    await waitFor("document.querySelector('.review-note')?.textContent.includes('Approved. See you on stage!')")
    assert.equal(await evaluate("document.querySelectorAll('.placed-item').length"),1)
    const current=store.get('SELECT * FROM event_bands WHERE id=?',satellites.id)
    await routes({path:'/api/event-bands/'+satellites.id+'/review',method:'POST',user:jimmy,body:async()=>({revision:current.revision,status:'changes_requested',note:'Please add a monitor.'}),send:()=>{}})
    await fill('.workspace-context textarea','Local work saved after resolving a conflict.')
    await waitFor("document.querySelector('.workspace-save-error')?.textContent.includes('updated in another window')")
    assert.equal(store.get('SELECT notes FROM event_bands WHERE id=?',satellites.id).notes,'Lead vocal, one mic stand please.')
    assert.equal(await evaluate("document.querySelector('.workspace-context textarea').value"),'Local work saved after resolving a conflict.')
    await click('Reload latest')
    await waitFor("document.querySelector('.workspace-recovery')")
    await click('Restore local work')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(store.get('SELECT notes FROM event_bands WHERE id=?',satellites.id).notes,'Local work saved after resolving a conflict.')

    signedIn=true
    await call('Page.navigate',{url:base+'/event-fixture?view=spaces'})
    await click('Create your first space')
    await fill('.event-dialog input','Main auditorium')
    await fill('.event-dialog form > label:nth-child(2) input','Empire Theatre')
    await click('Create space and edit outline')
    await waitFor("document.querySelector('.stage-setup-editor .title')?.value==='Main auditorium'")
    await click('Save stage version')
    await waitFor("document.querySelector('.toast')?.textContent==='Stage version saved'")
    await click('Back to Spaces')
    await click('Fixed equipment');await addEquipment('Drum kit');await click('Save now')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    await click('Back to Spaces');await click('Available equipment')
    await waitFor("document.querySelector('.venue-equipment-form')")
    await select('Equipment','chair');await click('Add equipment')
    await fill('.venue-stock-row input','40');await click('Save available equipment')
    await waitFor("document.querySelector('.event-notice')?.textContent.includes('Available equipment saved')")
    const space=store.get('SELECT * FROM spaces WHERE name=?','Main auditorium')
    assert.equal(JSON.parse(space.data).availableEquipment[0].quantity,40)
    await click('Back to Spaces')
    await waitFor("document.querySelector('.workspace-tabs a[href=\"?view=productions\"]')")
    await evaluate("document.querySelector('.workspace-tabs a[href=\"?view=productions\"]').click()")
    await click('Create your first production');await fill('.event-dialog input','Hamlet')
    await fill('.event-dialog form > label:nth-child(2) input','Northside Players')
    await select('Space',space.id);await click('Save')
    await waitFor("document.querySelector('.events-heading h1')?.textContent==='Hamlet'")
    await capture('production')
    await click('Open production layout')
    await waitFor("document.querySelector('.workspace-context')?.textContent.includes('PRODUCTION NOTES')")
    assert.ok(await evaluate("document.querySelector('.house-equipment-list').textContent.includes('Drum kit')"))
    await addEquipment('Orchestra chair');await addEquipment('Orchestra chair')
    await select('EQUIPMENT SOURCE','client')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    const production=store.get("SELECT * FROM events WHERE name='Hamlet'")
    const clientPlot=store.get('SELECT * FROM event_bands WHERE event_id=?',production.id)
    assert.deepEqual(JSON.parse(clientPlot.data).items.map(item=>item.supply),['venue','client'])
    await click('Equipment list')
    await waitFor("document.querySelector('.equipment-list-dialog[open]')")
    assert.ok(await evaluate("document.querySelector('.equipment-list-dialog').textContent.includes('Client supplied')"))
    assert.ok(await evaluate("document.querySelector('.equipment-list-dialog').textContent.includes('Venue')"))
    await evaluate("document.querySelector('[aria-label=\"Close equipment list\"]').click()")
    await click('Back to production')
    await waitFor("document.querySelector('.workspace-tabs a[href=\"?view=events\"]')")
    await evaluate("document.querySelector('.workspace-tabs a[href=\"?view=events\"]').click()")
    await click('+ Create event');await fill('.event-dialog input','Regional eisteddfod')
    await select('Event type','eisteddfod');await select('Reusable space',space.id);await click('Save')
    await waitFor("document.querySelector('.events-heading h1')?.textContent==='Regional eisteddfod'")
    await click('+ Add group');await fill('.event-dialog input','Group 01');await click('Save')
    await waitFor("document.querySelectorAll('.event-band-row').length===1")
    await click('Open plot');await addEquipment('Orchestra chair')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    await click('Back to event')
    const eisteddfod=store.get("SELECT * FROM events WHERE name='Regional eisteddfod'")
    const firstGroup=store.get('SELECT * FROM event_bands WHERE event_id=?',eisteddfod.id)
    await click('+ Add groups')
    await fill('.event-dialog textarea',Array.from({length:19},(_,index)=>'Group '+String(index+2).padStart(2,'0')).join('\n'))
    await select('Starting layout',firstGroup.id);await click('Save')
    await waitFor("document.querySelectorAll('.event-band-row').length===20")
    assert.equal(store.get('SELECT count(*) AS n FROM event_stages WHERE event_id=?',eisteddfod.id).n,1)
    await capture('eisteddfod')
    const group20=store.get('SELECT * FROM event_bands WHERE event_id=? AND name=?',eisteddfod.id,'Group 20')
    await evaluate("Array.from(document.querySelectorAll('.event-band-row')).find(row=>row.textContent.includes('Group 20')).querySelector('summary').click()")
    await evaluate("Array.from(document.querySelector('.event-band-row details[open]').querySelectorAll('button')).find(button=>button.textContent==='Move earlier').click()")
    await waitFor("document.querySelectorAll('.event-band-row')[18]?.textContent.includes('Group 20')")
    const group02=store.get('SELECT * FROM event_bands WHERE event_id=? AND name=?',eisteddfod.id,'Group 02')
    signedIn=false
    await call('Page.navigate',{url:base+'/event-fixture?band='+group02.guest_token})
    await waitFor("document.querySelector('.workspace-context')?.textContent.includes('GROUP NOTES')")
    assert.equal(await evaluate("document.querySelectorAll('.placed-item').length"),1)
    await addEquipment('Orchestra chair')
    await waitFor("document.querySelector('.workspace-save-state')?.textContent==='Saved'")
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',group02.id).data).items.length,2)
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',firstGroup.id).data).items.length,1)
    assert.equal(JSON.parse(store.get('SELECT data FROM event_bands WHERE id=?',group20.id).data).items.length,1)
    assert.ok(await evaluate("document.querySelector('.venue-availability').textContent.includes('2 / 40')"))
    assert.deepEqual(browserErrors,[])
  }finally{
    if(child&&child.exitCode===null&&child.signalCode===null){const closed=once(child,'close');if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:2147483647,method:'Browser.close'}));else child.kill();const fallback=setTimeout(()=>child.kill('SIGKILL'),3000);try{await closed}finally{clearTimeout(fallback)}}
    socket?.close();await server.close();store.db.close()
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-event-browser-'))
    await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100})
  }
})
