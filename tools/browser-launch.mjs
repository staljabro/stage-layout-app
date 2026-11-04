import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'

export async function launchBrowser(browser,profile,{timeout=30000}={}) {
  const child=spawn(browser,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true})
  let stderr='',launchError
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-12000)})
  child.on('error',error=>{launchError=error})
  const deadline=Date.now()+timeout
  try {
    while(Date.now()<deadline){
      if(launchError)throw launchError
      if(child.exitCode!==null||child.signalCode!==null)throw new Error(`Browser exited with code ${child.exitCode}, signal ${child.signalCode}`)
      try {
        const port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0].trim()
        if(/^\d+$/.test(port))return {child,port}
      }catch(error){if(error.code!=='ENOENT')throw error}
      await delay(100)
    }
    throw new Error(`Timed out after ${timeout}ms waiting for DevToolsActivePort`)
  }catch(error){
    if(child.pid&&child.exitCode===null&&child.signalCode===null){
      const closed=once(child,'close');child.kill('SIGKILL');await closed
    }
    throw new Error(`Could not start headless browser ${browser}: ${error.message}\n${stderr||'(no browser stderr)'}`,{cause:error})
  }
}
