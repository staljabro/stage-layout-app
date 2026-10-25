export function createAuthCookies(env=process.env) {
  const domain=(env.STAGEPLOT_COOKIE_DOMAIN || '').trim().replace(/^\./,'').toLowerCase()
  if(domain && (!domain.includes('.') || !domain.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || domain.length>253 || /^\d+(?:\.\d+){3}$/.test(domain)))throw new Error('STAGEPLOT_COOKIE_DOMAIN must be a parent hostname, without a protocol, port or path')
  if(domain)for(const key of ['STAGEPLOT_APP_URL','STAGEPLOT_STUDIO_URL','STAGEPLOT_GITHUB_CALLBACK_URL']) {
    if(!env[key])continue
    const hostname=new URL(env[key]).hostname.toLowerCase()
    if(hostname!==domain && !hostname.endsWith('.'+domain))throw new Error(`${key} must belong to STAGEPLOT_COOKIE_DOMAIN`)
  }
  const cookie=(request,name,path,value,age)=>`${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${age}${domain?'; Domain='+domain:''}${domain || env.STAGEPLOT_SECURE_COOKIE==='true' || env.STAGEPLOT_GITHUB_CALLBACK_URL?.startsWith('https://') || request.headers['x-forwarded-proto']==='https' ? '; Secure':''}`
  return {
    session:(request,value,age)=>cookie(request,'stageplot_session','/',value,age),
    oauth:(request,value,age)=>cookie(request,'stageplot_oauth','/api/auth/github',value,age),
  }
}
