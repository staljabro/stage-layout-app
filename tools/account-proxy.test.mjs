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

test('both frontend proxies share account sessions and live SQLite backups preserve data',{timeout:30000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-proxy-'))
  const backend=spawn(process.execPath,[fileURLToPath(new URL('./library-server.mjs',import.meta.url))],{env:{...process.env,STAGEPLOT_LIBRARY_ROOT:directory,STAGEPLOT_LIBRARY_PORT:'0',STAGEPLOT_SETUP_TOKEN:'proxy-test-token'},stdio:['ignore','pipe','pipe'],windowsHide:true})
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
    const setup=await fetch(urls[0]+'/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json','X-Stageplot-Request':'1',Origin:urls[0]},body:JSON.stringify({name:'Proxy Owner',email:'proxy@example.com',password:'proxy-account-password',setupToken:'proxy-test-token'})})
    assert.equal(setup.status,201,await setup.text())
    const cookie=setup.headers.get('set-cookie')
    assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=Lax'));assert.ok(!cookie.includes('Domain='))
    const session=await (await fetch(urls[1]+'/api/auth/session',{headers:{Cookie:cookie.split(';')[0],Origin:urls[1]}})).json()
    assert.equal(session.user.role,'owner')
    const backup=spawn(process.execPath,[fileURLToPath(new URL('./backup-data.mjs',import.meta.url)),join(directory,'account-data','stageplot.sqlite'),join(directory,'backup.sqlite')],{stdio:['ignore','pipe','pipe'],windowsHide:true})
    let backupError='';backup.stderr.on('data',data=>backupError+=data)
    assert.equal((await once(backup,'exit'))[0],0,backupError)
    const copy=new DatabaseSync(join(directory,'backup.sqlite'),{readOnly:true})
    try{assert.equal(copy.prepare('SELECT email FROM users').get().email,'proxy@example.com')}finally{copy.close()}
  }finally {
    for(const server of frontends)await server.close()
    const exited=backend.exitCode===null?once(backend,'exit'):null;backend.kill();if(exited)await exited
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('stageplot-proxy-'))
    await rm(directory,{recursive:true,force:true})
  }
})
