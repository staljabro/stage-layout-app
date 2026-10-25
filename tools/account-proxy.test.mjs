import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {DatabaseSync} from 'node:sqlite'
import {request as requestHttp} from 'node:http'

// Send the Host header exactly as the production reverse proxy does.
const proxyFetch=(url,options={})=>new Promise((resolve,reject)=>{
  const request=requestHttp(url,{method:options.method || 'GET',headers:options.headers},message=>{
    const chunks=[]
    message.on('data',chunk=>chunks.push(chunk))
    message.on('error',reject)
    message.on('end',()=>{
      const headers=[]
      for(let i=0;i<message.rawHeaders.length;i+=2)headers.push([message.rawHeaders[i],message.rawHeaders[i+1]])
      resolve(new Response(Buffer.concat(chunks),{status:message.statusCode,headers}))
    })
  })
  request.on('error',reject)
  request.end(options.body)
})

test('Studio login, planner callback and Studio logout share the configured parent domain',{timeout:15000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-domains-'))
  const planner='https://stageplot.braithwaite.work',studio='https://stageplotstudio.braithwaite.work'
  const backend=spawn(process.execPath,['--import',new URL('./test-support/github-provider.mjs',import.meta.url).href,fileURLToPath(new URL('./library-server.mjs',import.meta.url))],{env:{...process.env,STAGEPLOT_LIBRARY_ROOT:directory,STAGEPLOT_LIBRARY_PORT:'0',STAGEPLOT_GITHUB_CLIENT_ID:'test-client',STAGEPLOT_GITHUB_CLIENT_SECRET:'test-secret',STAGEPLOT_GITHUB_OWNER_ID:'1',STAGEPLOT_GITHUB_CALLBACK_URL:planner+'/api/auth/github/callback',STAGEPLOT_APP_URL:planner+'/',STAGEPLOT_STUDIO_URL:studio+'/',STAGEPLOT_COOKIE_DOMAIN:'braithwaite.work'},stdio:['ignore','pipe','pipe'],windowsHide:true})
  let errors='';backend.stderr.on('data',data=>errors+=data)
  try {
    const target=await new Promise((resolve,reject)=>{let output='';backend.stdout.on('data',data=>{output+=data;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match)resolve(match[0])});backend.once('error',reject);backend.once('exit',code=>reject(new Error(`API exited ${code}: ${errors}`)))})
    const studioHeaders={Host:new URL(studio).host,Origin:studio,'X-Forwarded-Proto':'https'}
    const start=await proxyFetch(target+'/api/auth/github/start',{method:'POST',headers:{...studioHeaders,'Content-Type':'application/json','X-Stageplot-Request':'1'},body:JSON.stringify({returnTo:studio+'/'})})
    assert.equal(start.status,200,await start.clone().text())
    const state=new URL((await start.json()).authorizationUrl).searchParams.get('state')
    const oauth=start.headers.getSetCookie()[0]
    assert.ok(oauth.includes('; Domain=braithwaite.work; Secure'))
    const callback=await proxyFetch(target+'/api/auth/github/callback?code=1&state='+state,{headers:{Host:new URL(planner).host,'X-Forwarded-Proto':'https',Cookie:oauth.split(';')[0]}})
    assert.equal(callback.status,302)
    assert.equal(new URL(callback.headers.get('location')).origin,studio)
    const issued=callback.headers.getSetCookie()
    assert.ok(issued.every(cookie=>cookie.includes('; Domain=braithwaite.work; Secure')))
    assert.ok(issued.some(cookie=>cookie.startsWith('stageplot_oauth=;')&&cookie.includes('Max-Age=0')))
    assert.ok(issued.some(cookie=>cookie.startsWith('stageplot_session=;')&&cookie.includes('Max-Age=0')))
    const session=issued.findLast(cookie=>cookie.startsWith('stageplot_session='))
    const authenticated=await proxyFetch(target+'/api/auth/session',{headers:{...studioHeaders,Cookie:session.split(';')[0]}})
    assert.equal((await authenticated.json()).user.role,'owner')
    const logout=await proxyFetch(target+'/api/auth/logout',{method:'POST',headers:{...studioHeaders,'X-Stageplot-Request':'1',Cookie:session.split(';')[0]}})
    assert.equal(logout.status,200)
    const expired=logout.headers.getSetCookie()[0]
    assert.ok(expired.startsWith('stageplot_session=; Path=/;'))
    assert.ok(expired.includes('Max-Age=0; Domain=braithwaite.work; Secure'))
    const after=await proxyFetch(target+'/api/auth/session',{headers:{Host:new URL(planner).host,Cookie:session.split(';')[0]}})
    assert.equal((await after.json()).user,null,'Studio logout revokes the same session in the planner')
  } finally {
    const exited=backend.exitCode===null?once(backend,'exit'):null;backend.kill();if(exited)await exited
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-domains-'))
    await rm(directory,{recursive:true,force:true})
  }
})

test('both frontend proxies share account sessions and live SQLite backups preserve data',{timeout:30000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-proxy-'))
  const backend=spawn(process.execPath,['--import',new URL('./test-support/github-provider.mjs',import.meta.url).href,fileURLToPath(new URL('./library-server.mjs',import.meta.url))],{env:{...process.env,STAGEPLOT_LIBRARY_ROOT:directory,STAGEPLOT_LIBRARY_PORT:'0',STAGEPLOT_GITHUB_CLIENT_ID:'test-client',STAGEPLOT_GITHUB_CLIENT_SECRET:'test-secret',STAGEPLOT_GITHUB_OWNER_ID:'1',STAGEPLOT_GITHUB_CALLBACK_URL:'http://127.0.0.1:5173/api/auth/github/callback'},stdio:['ignore','pipe','pipe'],windowsHide:true})
  const frontends=[]
  let errors='';backend.stderr.on('data',data=>errors+=data)
  try {
    const target=await new Promise((resolve,reject)=>{let output='';backend.stdout.on('data',data=>{output+=data;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match)resolve(match[0])});backend.once('error',reject);backend.once('exit',code=>reject(new Error(`API exited ${code}: ${errors}`)))})
    const root=fileURLToPath(new URL('../',import.meta.url))
    for(const folder of [root,join(root,'tools','svg-shape-studio')]) {
      const server=await createServer({root:folder,configFile:join(folder,'vite.config.js'),logLevel:'silent',server:{host:'127.0.0.1',port:0,strictPort:true,hmr:false,watch:null,proxy:{'/api':{target,changeOrigin:false}}},optimizeDeps:{noDiscovery:true,include:[]}})
      frontends.push(server);await server.listen()
    }
    const urls=frontends.map(server=>'http://127.0.0.1:'+server.httpServer.address().port)
    for(const url of urls){assert.equal((await fetch(url+'/')).status,200);assert.equal((await fetch(url+'/src/main.jsx')).status,200)}
    const start=await fetch(urls[0]+'/api/auth/github/start',{method:'POST',headers:{'Content-Type':'application/json','X-Stageplot-Request':'1',Origin:urls[0]},body:JSON.stringify({returnTo:'http://127.0.0.1:5173/'})})
    assert.equal(start.status,200,await start.clone().text())
    const state=new URL((await start.json()).authorizationUrl).searchParams.get('state')
    const result=await fetch(urls[0]+'/api/auth/github/callback?code=1&state='+state,{redirect:'manual',headers:{Cookie:start.headers.getSetCookie()[0].split(';')[0]}})
    assert.equal(result.status,302,await result.text())
    const cookie=result.headers.getSetCookie().findLast(value=>value.startsWith('stageplot_session='))
    assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=Lax'));assert.ok(!cookie.includes('Domain='))
    const session=await (await fetch(urls[1]+'/api/auth/session',{headers:{Cookie:cookie.split(';')[0],Origin:urls[1]}})).json()
    assert.equal(session.user.role,'owner')
    const backup=spawn(process.execPath,[fileURLToPath(new URL('./backup-data.mjs',import.meta.url)),join(directory,'account-data','stageplot.sqlite'),join(directory,'backup.sqlite')],{stdio:['ignore','pipe','pipe'],windowsHide:true})
    let backupError='';backup.stderr.on('data',data=>backupError+=data)
    assert.equal((await once(backup,'exit'))[0],0,backupError)
    const copy=new DatabaseSync(join(directory,'backup.sqlite'),{readOnly:true})
    try{assert.equal(copy.prepare('SELECT email FROM users').get().email,'owner@example.com')}finally{copy.close()}
  }finally {
    for(const server of frontends)await server.close()
    const exited=backend.exitCode===null?once(backend,'exit'):null;backend.kill();if(exited)await exited
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-proxy-'))
    await rm(directory,{recursive:true,force:true})
  }
})
