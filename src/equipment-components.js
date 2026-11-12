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
    const source=typeof entry==='object'?entry:{}
    return [{id,label:label.trim().slice(0,200),category:typeof source.category==='string'&&source.category.trim()?source.category.trim().slice(0,100):'General',...(typeof source.assetId==='string'&&source.assetId?{assetId:source.assetId}:{}),quantity:Number.isSafeInteger(source.quantity)&&source.quantity>0?Math.min(100,source.quantity):1,x:Number.isFinite(source.x)?source.x:0,y:Number.isFinite(source.y)?source.y:0,zOrder:Number.isFinite(source.zOrder)?source.zOrder:index,...(Number.isFinite(source.stackOrder)?{stackOrder:source.stackOrder}:{}),...(source.equipment&&typeof source.equipment==='object'?{equipment:source.equipment}:{})}]
  })
}

export function componentState(components,value={}) {
  return Object.fromEntries(normaliseComponents(components).map(component=>{
    const state=value?.[component.id]
    return [component.id,{enabled:state?.enabled!==false,...(['venue','client'].includes(state?.supply)?{supply:state.supply}:{}),...(typeof state?.note==='string'&&state.note.trim()?{note:state.note.slice(0,2000)}:{})}]
  }))
}

export function enabledComponents(item) {
  const state=componentState(item?.components,item?.componentState)
  return normaliseComponents(item?.components).flatMap(component=>state[component.id].enabled?[{...component,...(state[component.id].supply?{supply:state[component.id].supply}:{}),note:state[component.id].note||''}]:[])
}

export function hydrateEquipmentComponents(item,library=[],trail=new Set()) {
  if(!item||trail.has(item.id))return item
  const assets=new Map(library.map(asset=>[asset.id,asset])),nextTrail=new Set(trail);nextTrail.add(item.id)
  return {...item,components:normaliseComponents(item.components).map(component=>{
    if(!component.assetId)return component
    const target=assets.get(component.assetId)||component.equipment
    return target?{...component,label:target.label||component.label,equipment:hydrateEquipmentComponents(target,library,nextTrail)}:component
  })}
}
