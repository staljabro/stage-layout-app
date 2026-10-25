// Loaded only into test subprocesses with node --import. Production always uses GitHub's fixed HTTPS endpoints.
const networkFetch=globalThis.fetch
const names={1:'owner',2:'admin',3:'contributor',4:'editor',5:'other'}
globalThis.fetch=async(input,options={})=>{
  const url=new URL(input)
  if(url.href==='https://github.com/login/oauth/access_token') {
    const data=new URLSearchParams(options.body)
    if(!data.get('client_secret')||data.get('code_verifier')?.length<43)throw new Error('OAuth exchange omitted secret or PKCE verifier')
    const code=data.get('code')
    return Response.json(code==='broken'?{error:'bad_verification_code'}:{access_token:'test-'+code})
  }
  if(url.origin==='https://api.github.com') {
    const code=String(options.headers?.Authorization || '').replace('Bearer test-','')
    const id=Number.parseInt(code,10),name=names[id] || 'member'+id
    if(url.pathname==='/user')return Response.json({id,login:code.endsWith('-renamed')?name+'-renamed':name,name})
    if(url.pathname==='/user/emails')return Response.json([{email:code.endsWith('-collision')?'owner@example.com':name+'@example.com',verified:!code.endsWith('-unverified'),primary:true}])
    throw new Error('Unexpected GitHub endpoint')
  }
  return networkFetch(input,options)
}
