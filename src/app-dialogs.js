let nextId=0
let queue=[]
const listeners=new Set()
export const subscribeDialogs=listener=>{listeners.add(listener);return()=>listeners.delete(listener)}
export const currentDialog=()=>queue[0]||null
const notify=()=>{for(const listener of listeners)listener()}
const request=(kind,message,initial='')=>new Promise(resolve=>{queue=[...queue,{id:++nextId,kind,message:String(message),initial:String(initial),resolve}];notify()})
export function finishDialog(id,value){if(queue[0]?.id!==id)return;const current=queue[0];queue=queue.slice(1);current.resolve(value);notify()}
export const appConfirm=message=>request('confirm',message)
export const appPrompt=(message,initial='')=>request('prompt',message,initial)
export const appAlert=message=>request('alert',message)
export const appPreview=(title,html)=>request('preview',title,html)
