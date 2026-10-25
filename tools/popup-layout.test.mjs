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

test('account, project, submission and history popups keep their layout in both apps',{skip:!browser,timeout:60000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-popups-'))
  const stage={schema:'stageplot-stage@1',id:'test-stage',label:'Test stage',profiles:['external'],dimensions:{widthMeters:10,depthMeters:5},boundary:{nodes:[{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:0,y:5}]},collisionBoundary:[],zones:[],revision:1}
  const item={schema:'stageplot-item@3',id:'test-chair',label:'Test chair',profiles:['external'],dimensions:{widthMeters:1,depthMeters:1},shapes:[],collisionShapes:[],editor:{layers:[]},revision:1,ownerId:null}
  const fixture={name:'popup-layout-fixture',configureServer(server){server.middlewares.use(async(request,response,next)=>{
    const url=new URL(request.url,'http://localhost')
    if(url.pathname.startsWith('/api/')) {
      const data=url.pathname==='/api/auth/session'?{user:{id:'owner',name:'Test Owner',email:'owner@example.test',role:'owner'},githubConfigured:true,ownerConfigured:true}:
        url.pathname==='/api/items'?[item]:url.pathname==='/api/stages'?[stage]:url.pathname.endsWith('/history')?[{revision:1,created:new Date().toISOString(),data:item}]:
        url.pathname==='/api/users'?[{id:'owner',name:'Test Owner',email:'owner@example.test',role:'owner'}]:
        url.pathname==='/api/access-requests'?[{github_id:'42',login:'test-user',name:'Test user',email:'user@example.test',status:'pending'}]:
        url.pathname==='/api/projects'?Array.from({length:20},(_,id)=>({id:String(id),name:'Saved show '+id,revision:1,updated:new Date().toISOString()})):[]
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
  const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,plugins:[react(),fixture],resolve:{alias:{'polygon-clipping':fileURLToPath(new URL('./svg-shape-studio/node_modules/polygon-clipping/dist/polygon-clipping.cjs.js',import.meta.url)),'fit-curve':fileURLToPath(new URL('./svg-shape-studio/node_modules/fit-curve/lib/fit-curve.js',import.meta.url))},dedupe:['react','react-dom']},logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','fit-curve','polygon-clipping']}})
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
    const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value}
    const waitFor=async expression=>{for(let attempt=0;attempt<150;attempt++){if(await evaluate(`Boolean(${expression})`))return;await delay(100)}throw new Error('Browser did not reach expected state: '+expression+'\n'+browserErrors.join('\n'))}
    const click=async text=>{await waitFor(`Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()===${JSON.stringify(text)})`);await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(text)}).click()`)}
    const modal=()=>evaluate(`(()=>{const dialog=document.querySelector('.account-dialog'),header=dialog.querySelector('header'),button=header.querySelector('button'),rect=dialog.getBoundingClientRect();return {inBody:dialog.parentElement.parentElement===document.body,color:getComputedStyle(header).color,background:getComputedStyle(button).backgroundColor,headerHeight:header.getBoundingClientRect().height,width:rect.width,top:rect.top,bottom:rect.bottom,viewport:innerHeight,scrollable:dialog.scrollHeight>dialog.clientHeight,formDisplay:dialog.querySelector('form')?getComputedStyle(dialog.querySelector('form')).display:null,topmost:!!document.elementFromPoint(rect.left+rect.width/2,rect.top+20)?.closest('.account-dialog')}})()`)
    await call('Runtime.enable')
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false})
    const base='http://127.0.0.1:'+server.httpServer.address().port
    await call('Page.navigate',{url:base+'/planner-fixture'})
    await waitFor(`document.querySelector('.stage-picker-backdrop') && document.querySelector('.top-actions button')`)
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
    await click('My projects')
    await waitFor(`document.querySelectorAll('.account-row').length===20`)
    layout=await modal()
    assert.equal(layout.scrollable,true)
    assert.ok(layout.top>=0 && layout.bottom<=layout.viewport,'long project list must stay inside the viewport')
    await call('Page.navigate',{url:base+'/studio-fixture'})
    await click('Submissions & recovery')
    await waitFor(`document.querySelector('.account-dialog')`)
    layout=await modal()
    assert.equal(layout.inBody,true,'toolbar dialogs must render outside the toolbar')
    assert.equal(layout.color,'rgb(48, 49, 44)')
    assert.equal(layout.background,'rgb(255, 255, 255)')
    assert.ok(layout.headerHeight<70,'dialog header must not inherit the Studio topbar height')
    await click('Close')
    await click('Library')
    await waitFor(`document.querySelector('.equipment-management-modal')`)
    await click('History')
    await waitFor(`document.querySelector('.account-dialog')`)
    assert.equal((await modal()).inBody,true,'history popup must escape the library popup clipping and styles')
    await click('Close')
    await evaluate(`document.querySelector('.equipment-management-modal .modal-header button').click()`)
    await click('Test Owner · owner')
    await click('Manage users & access requests')
    await waitFor(`document.querySelector('.account-access-request')`)
    assert.equal((await modal()).formDisplay,'grid')
    await call('Emulation.setDeviceMetricsOverride',{width:480,height:640,deviceScaleFactor:1,mobile:false})
    layout=await modal()
    assert.ok(layout.width<=456 && layout.top>=0 && layout.bottom<=640,'account popup must fit a narrow viewport')
  }finally {
    socket?.close()
    if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited}
    await server.close()
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-popups-'))
    await rm(directory,{recursive:true,force:true})
  }
})
