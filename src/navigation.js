const views=new Set(['home','events','productions','spaces'])
export function workspaceRoute(search='') {
  const params=new URLSearchParams(search)
  if(params.has('join'))return {screen:'invitation',token:params.get('join')}
  if(params.has('stageShare'))return {screen:'stage-share',token:params.get('stageShare')}
  if(params.has('band')||params.has('plot'))return {screen:'layout',guestToken:params.get('band'),plotId:params.get('plot')}
  if(params.has('eventStage')||params.has('space'))return {screen:'stage',stageId:params.get('eventStage')||params.get('space'),reusable:params.has('space'),mode:['equipment','stock'].includes(params.get('mode'))?params.get('mode'):'outline'}
  return {screen:'workspace',eventId:params.get('event'),view:views.has(params.get('view'))?params.get('view'):'home'}
}
export function workspaceUrl(params={},base=window.location.href) {
  const url=new URL(base);url.search='';url.hash=''
  for(const [key,value] of Object.entries(params))if(value!==null&&value!==undefined&&value!=='')url.searchParams.set(key,value)
  return url.href
}
export function studioLink(studioUrl,returnTo,section='library') {
  const url=new URL(studioUrl,returnTo);url.searchParams.set('returnTo',returnTo);url.searchParams.set('section',section);return url.href
}
export function studioReturn(appUrl,currentUrl) {
  const fallback=new URL(appUrl,currentUrl),candidate=new URL(currentUrl).searchParams.get('returnTo')
  try {const target=new URL(candidate);if(target.origin===fallback.origin&&target.pathname===fallback.pathname&&!target.username&&!target.password)return target.href}catch{/* Use the configured workspace when no valid return location is supplied. */}
  return fallback.href
}
