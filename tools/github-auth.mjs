import {createHash} from 'node:crypto'
import {uid,token,digest,fail,roles,publicUser} from './account-store.mjs'

export function createGithubAuth(store,authCookies) {
  const {db,get,all,run,transaction}=store
  db.exec(`CREATE TABLE IF NOT EXISTS github_identities(github_id TEXT PRIMARY KEY,user_id TEXT UNIQUE NOT NULL REFERENCES users(id),login TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS github_requests(github_id TEXT PRIMARY KEY,login TEXT NOT NULL,email TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS github_oauth_states(hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,verifier TEXT NOT NULL,return_to TEXT NOT NULL,expires INTEGER NOT NULL);`)
  if(!get("SELECT value FROM settings WHERE key='github-auth-v1'"))transaction(()=>{
    run('DELETE FROM sessions')
    run("UPDATE users SET password='github-only'")
    run("INSERT INTO settings VALUES('github-auth-v1','true')")
  })
  const clientId=process.env.STAGEPLOT_GITHUB_CLIENT_ID,clientSecret=process.env.STAGEPLOT_GITHUB_CLIENT_SECRET
  let callback,app,studio
  try {
    callback=new URL(process.env.STAGEPLOT_GITHUB_CALLBACK_URL)
    app=new URL(process.env.STAGEPLOT_APP_URL || '/',callback)
    studio=new URL(process.env.STAGEPLOT_STUDIO_URL || app.href)
    for(const url of [callback,app,studio])if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('HTTPS is required outside localhost')
  }catch {callback=null}
  const configured=!!(clientId&&clientSecret&&callback)
  const ownerGithubId=process.env.STAGEPLOT_GITHUB_OWNER_ID || ''
  const requireOwner=user=>{if(user?.role!=='owner')fail(user?403:401,'Only the Owner can manage accounts')}
  const accounts=()=>all('SELECT users.*,github_identities.github_id,github_identities.login AS github_login FROM users LEFT JOIN github_identities ON users.id=github_identities.user_id ORDER BY email').map(publicUser)
  const attach=(githubId,userId,login)=>{
    const identity=get('SELECT * FROM github_identities WHERE github_id=? OR user_id=?',githubId,userId)
    if(identity && (identity.github_id!==githubId || identity.user_id!==userId))fail(409,'This GitHub identity or app account is already linked')
    run('INSERT INTO github_identities VALUES(?,?,?) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login',githubId,userId,login)
    run('DELETE FROM sessions WHERE user_id=?',userId)
  }
  const bindIdentity=identity=>transaction(()=>{
    const linked=get('SELECT users.* FROM github_identities JOIN users ON users.id=github_identities.user_id WHERE github_id=?',identity.id)
    if(linked){run('UPDATE github_identities SET login=? WHERE github_id=?',identity.login,identity.id);return linked.disabled?{status:'disabled'}:{account:linked}}
    if(identity.id===ownerGithubId && /^\d+$/.test(ownerGithubId)) {
      const owners=all("SELECT * FROM users WHERE role='owner' AND disabled=0")
      let owner=process.env.STAGEPLOT_OWNER_USER_ID ? get("SELECT * FROM users WHERE id=? AND role='owner' AND disabled=0",process.env.STAGEPLOT_OWNER_USER_ID) : owners.length===1?owners[0]:null
      if(owners.length && !owner)fail(409,'Set STAGEPLOT_OWNER_USER_ID to the existing Owner account to preserve')
      if(process.env.STAGEPLOT_OWNER_USER_ID && !owner)fail(409,'The configured Owner account was not found')
      if(!owner) {
        if(get('SELECT id FROM users WHERE email=?',identity.email))fail(409,'An existing account uses this email. Configure its Owner account explicitly')
        const id=uid();run('INSERT INTO users(id,email,name,role,password,disabled) VALUES(?,?,?,?,?,0)',id,identity.email,identity.name,'owner','github-only');run('UPDATE users SET empire=1 WHERE id=?',id)
        owner=get('SELECT * FROM users WHERE id=?',id)
      }
      run('UPDATE users SET empire=1 WHERE id=?',owner.id);owner={...owner,empire:1}
      attach(identity.id,owner.id,identity.login)
      run('DELETE FROM github_requests WHERE github_id=?',identity.id)
      return {account:owner}
    }
    const previous=get('SELECT * FROM github_requests WHERE github_id=?',identity.id)
    run("INSERT INTO github_requests VALUES(?,?,?,?,?,?) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login,email=excluded.email,name=excluded.name,updated=excluded.updated",identity.id,identity.login,identity.email,identity.name,previous?.status || 'pending',new Date().toISOString())
    return {status:previous?.status==='rejected'?'denied':'pending'}
  })
  const attempts=new Map()
  const requestGithub=async(url,options={})=>{
    let response
    try{response=await fetch(url,{...options,signal:AbortSignal.timeout(10000),redirect:'error'})}catch{fail(502,'GitHub could not be reached. Try again shortly')}
    if(!response.ok)fail(502,'GitHub sign-in could not be completed')
    return response.json()
  }
  const oauthCookie=authCookies.oauth
  return async({request,response,url,user,send,body,startSession})=>{
    const path=url.pathname,method=request.method
    if(path==='/api/auth/session'&&method==='GET') {
      const identity=user?get('SELECT * FROM github_identities WHERE user_id=?',user.id):null
      send(200,{appUrl:app?.href || null,studioUrl:studio?.href || null,user:user?{...user,githubId:identity?.github_id || null,githubLogin:identity?.login || null}:null,githubConfigured:configured,ownerConfigured:/^\d+$/.test(ownerGithubId)||!!get("SELECT users.id FROM github_identities JOIN users ON users.id=github_identities.user_id WHERE users.role='owner' AND users.disabled=0 LIMIT 1")});return true
    }
    if(path==='/api/auth/github/start'&&method==='POST') {
      if(!configured)fail(503,'GitHub sign-in has not been configured on this server')
      const key=request.socket.remoteAddress,now=Date.now(),attempt=attempts.get(key)
      if(attempt?.until>now&&attempt.count>=50)fail(429,'Too many sign-in attempts. Try again in 15 minutes')
      if(attempts.size>10000)attempts.clear()
      attempts.set(key,{count:attempt?.until>now?attempt.count+1:1,until:now+900000})
      const input=await body(request)
      let target
      try{target=new URL(input.returnTo || app.href)}catch{fail(400,'Invalid return address')}
      if(![app.origin,studio.origin].includes(target.origin)||target.username||target.password)fail(400,'Return address must belong to Stageplot or Studio')
      const state=token(),browser=token(),verifier=token()+token()
      run('DELETE FROM github_oauth_states WHERE expires<?',now)
      run('INSERT INTO github_oauth_states VALUES(?,?,?,?,?)',digest(state),digest(browser),verifier,target.href,now+600000)
      response.setHeader('Set-Cookie',oauthCookie(request,browser,600))
      const authorization=new URL('https://github.com/login/oauth/authorize')
      for(const [name,value] of Object.entries({client_id:clientId,redirect_uri:callback.href,scope:'read:user user:email',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))authorization.searchParams.set(name,value)
      send(200,{authorizationUrl:authorization.href});return true
    }
    if(path==='/api/auth/github/callback'&&method==='GET') {
      if(!configured)fail(503,'GitHub sign-in has not been configured')
      const state=url.searchParams.get('state') || '',browser=request.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('stageplot_oauth='))?.slice(16) || ''
      const saved=get('SELECT * FROM github_oauth_states WHERE hash=?',digest(state))
      if(!saved||saved.expires<Date.now()||saved.browser_hash!==digest(browser))fail(400,'Sign-in expired or did not match this browser. Start again')
      run('DELETE FROM github_oauth_states WHERE hash=?',digest(state))
      const previousSession=request.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('stageplot_session='))?.slice(18)
      if(previousSession)run('DELETE FROM sessions WHERE hash=?',digest(previousSession))
      response.setHeader('Set-Cookie',[oauthCookie(request,'',0),authCookies.session(request,'',0)])
      const target=new URL(saved.return_to)
      let status
      try {
        if(url.searchParams.has('error'))status='cancelled'
        else {
          const code=url.searchParams.get('code');if(!code)fail(400,'Missing GitHub authorization code')
          const exchange=await requestGithub('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,redirect_uri:callback.href,code,code_verifier:saved.verifier})})
          if(typeof exchange.access_token!=='string')fail(401,'GitHub authorization was not accepted')
          const headers={Authorization:'Bearer '+exchange.access_token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Stageplot'}
          const [profile,emails]=await Promise.all([requestGithub('https://api.github.com/user',{headers}),requestGithub('https://api.github.com/user/emails?per_page=100',{headers})])
          if(!Number.isSafeInteger(profile.id)||profile.id<=0||typeof profile.login!=='string')fail(401,'GitHub returned an invalid account')
          const email=Array.isArray(emails)?emails.find(e=>e.verified&&e.primary) || emails.find(e=>e.verified):null
          if(!email || typeof email.email!=='string')status='email-required'
          else {
            const result=bindIdentity({id:String(profile.id),login:profile.login,email:email.email.toLowerCase(),name:String(profile.name || profile.login).slice(0,100)})
            if(result.account){startSession(result.account);status='signed-in'}else status=result.status
          }
        }
      }catch {status='error'}
      target.searchParams.set('auth_result',status)
      response.writeHead(302,{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});response.end();return true
    }
    if(path==='/api/access-requests'&&method==='GET'){requireOwner(user);send(200,all('SELECT * FROM github_requests ORDER BY updated DESC'));return true}
    const approval=path.match(/^\/api\/access-requests\/(\d+)\/(approve|reject)$/)
    if(approval&&method==='POST') {
      requireOwner(user);const input=await body(request)
      const result=transaction(()=>{
        const pending=get('SELECT * FROM github_requests WHERE github_id=?',approval[1]);if(!pending)fail(404,'Access request not found')
        if(approval[2]==='reject'){run("UPDATE github_requests SET status='rejected' WHERE github_id=?",pending.github_id);return {status:'rejected'}}
        if(input.role==='owner')fail(409,'The Owner role is reserved for the configured GitHub identity')
        if(!roles.includes(input.role))fail(400,'Choose a valid role')
        let account=input.existingUserId?get('SELECT * FROM users WHERE id=?',input.existingUserId):null
        if(input.existingUserId&&!account)fail(404,'Existing account not found')
        if(account?.role==='owner')fail(409,'The Owner account cannot be changed')
        if(!account){if(get('SELECT id FROM users WHERE email=?',pending.email))fail(409,'Select the existing account to link; matching email never links accounts automatically');const id=uid();run('INSERT INTO users(id,email,name,role,password,disabled) VALUES(?,?,?,?,?,0)',id,pending.email,pending.name,input.role,'github-only');account=get('SELECT * FROM users WHERE id=?',id)}
        if(account.role==='owner'&&input.role!=='owner'&&!account.disabled&&get("SELECT count(*) AS n FROM users WHERE role='owner' AND disabled=0").n<=1)fail(409,'Keep at least one active Owner')
        attach(pending.github_id,account.id,pending.login)
        run('UPDATE users SET role=?,disabled=0 WHERE id=?',input.role,account.id)
        run('DELETE FROM github_requests WHERE github_id=?',pending.github_id)
        return publicUser(get('SELECT * FROM users WHERE id=?',account.id))
      });send(200,result);return true
    }
    if(path==='/api/users'&&method==='GET'){requireOwner(user);send(200,accounts());return true}
    return false
  }
}
