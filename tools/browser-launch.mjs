import {spawn} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'

const running=child=>child?.pid&&child.exitCode===null&&child.signalCode===null
async function waitForExit(child,timeout) {
  if(!running(child))return true
  return new Promise(resolve=>{
    const done=()=>{clearTimeout(timer);child.removeListener('exit',done);resolve(!running(child))}
    const timer=setTimeout(done,timeout)
    child.once('exit',done)
  })
}

export async function stopBrowser(child,socket) {
  try {
    if(!running(child))return
    if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:2147483647,method:'Browser.close'}))
    else child.kill()
    if(!await waitForExit(child,3000)){
      child.kill('SIGKILL')
      if(!await waitForExit(child,3000))throw new Error('Headless browser did not exit after SIGKILL')
    }
  }finally{
    // Chromium descendants can retain stderr after the main process exits.
    // Waiting for ChildProcess "close" can therefore hang indefinitely.
    child?.stderr?.destroy()
    socket?.close()
  }
}

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
    await stopBrowser(child)
    throw new Error(`Could not start headless browser ${browser}: ${error.message}\n${stderr||'(no browser stderr)'}`,{cause:error})
  }
}
