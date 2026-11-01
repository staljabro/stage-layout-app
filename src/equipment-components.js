const MAX_COMPONENTS=100

export function normaliseComponents(value=[]) {
  if(!Array.isArray(value))return []
  const used=new Set()
  return value.slice(0,MAX_COMPONENTS).flatMap((entry,index)=>{
    const label=typeof entry==='string'?entry:entry?.label
    if(typeof label!=='string'||!label.trim())return []
    let id=typeof entry==='object'&&typeof entry.id==='string'&&entry.id.trim()?entry.id.trim():`component-${index+1}`
    while(used.has(id))id+='-copy'
    used.add(id)
    return [{id,label:label.trim().slice(0,200)}]
  })
}

export function componentState(components,value={}) {
  return Object.fromEntries(normaliseComponents(components).map(component=>{
    const state=value?.[component.id]
    return [component.id,{enabled:state?.enabled!==false,...(typeof state?.note==='string'&&state.note.trim()?{note:state.note.slice(0,2000)}:{})}]
  }))
}

export function enabledComponents(item) {
  const state=componentState(item?.components,item?.componentState)
  return normaliseComponents(item?.components).flatMap(component=>state[component.id].enabled?[{...component,note:state[component.id].note||''}]:[])
}
