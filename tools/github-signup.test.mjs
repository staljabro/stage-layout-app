import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

test('GitHub signup creates a User session immediately even before an Owner is configured',{timeout:15000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-signup-'))
  const child=spawn(process.execPath,['--import',new URL('./test-support/github-provider.mjs',import.meta.url).href,fileURLToPath(new URL('./library-server.mjs',import.meta.url))],{env:{...process.env,STAGEPLOT_LIBRARY_ROOT:directory,STAGEPLOT_LIBRARY_PORT:'0',STAGEPLOT_GITHUB_CLIENT_ID:'client',STAGEPLOT_GITHUB_CLIENT_SECRET:'secret',STAGEPLOT_GITHUB_OWNER_ID:'',STAGEPLOT_OWNER_USER_ID:'',STAGEPLOT_GITHUB_CALLBACK_URL:'http://127.0.0.1:5173/api/auth/github/callback',STAGEPLOT_APP_URL:'http://127.0.0.1:5173/',STAGEPLOT_STUDIO_URL:''},stdio:['ignore','pipe','pipe'],windowsHide:true})
  let errors='';child.stderr.on('data',value=>errors+=value)
  try{
    const base=await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',value=>{output+=value;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match)resolve(match[0])});child.once('error',reject);child.once('exit',code=>reject(new Error('API exited '+code+' '+errors)))})
    const login=async code=>{
      const start=await fetch(base+'/api/auth/github/start',{method:'POST',headers:{'Content-Type':'application/json','X-Stageplot-Request':'1'},body:JSON.stringify({returnTo:'http://127.0.0.1:5173/'})})
      const state=new URL((await start.json()).authorizationUrl).searchParams.get('state'),cookie=start.headers.getSetCookie()[0].split(';')[0]
      const callback=await fetch(base+'/api/auth/github/callback?code='+code+'&state='+state,{redirect:'manual',headers:{Cookie:cookie}})
      assert.equal(new URL(callback.headers.get('Location')).searchParams.get('auth_result'),'signed-in')
      const session=callback.headers.getSetCookie().findLast(value=>value.startsWith('stageplot_session='))
      assert.ok(session)
      return (await(await fetch(base+'/api/auth/session',{headers:{Cookie:session.split(';')[0]}})).json()).user
    }
    const first=await login('7');assert.equal(first.role,'user');assert.equal(first.githubId,'7')
    const renamed=await login('7-renamed');assert.equal(renamed.id,first.id);assert.equal(renamed.role,'user');assert.equal(renamed.githubLogin,'member7-renamed')
    const second=await login('8');assert.equal(second.role,'user');assert.notEqual(second.id,first.id)
  }finally{if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited}assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true})}
})
