export const API_BASE = (import.meta.env.VITE_LIBRARY_API_URL || '/api').replace(/\/$/,'')
export const apiFetch = (url, options={}) => globalThis.fetch(url,{...options,credentials:'include',headers:{...options.headers,...(options.method && options.method!=='GET' ? {'X-Stageplot-Request':'1'} : {})}})
export async function accountRequest(path, method='GET', data) {
  const response=await apiFetch(API_BASE+path,{method,...(data!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error || 'Request failed')
  return result
}
