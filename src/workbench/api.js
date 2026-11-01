import {accountRequest} from '../account-api.js'
export const request=(path,method='GET',data)=>accountRequest('/workspace'+path,method,data)
export function link(params={}) {const url=new URL(window.location.href);url.search='';url.hash='';for(const [key,value] of Object.entries(params))if(value)url.searchParams.set(key,value);return url.href}
export const go=params=>window.location.assign(link(params))
export function returnLocation(candidate,fallback=link({view:'equipment'})) {try{const url=new URL(candidate);if(url.origin===window.location.origin&&url.pathname===window.location.pathname&&!url.username&&!url.password)return url.href}catch{/* Use the library when no valid return location exists. */}return fallback}
export const newId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('')
