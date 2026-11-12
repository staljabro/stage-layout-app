import { assetReference } from './project-file.js'
import {enabledComponents} from './equipment-components.js'

export const stockQuantity = item => Number.isSafeInteger(item?.stockQuantity) && item.stockQuantity >= 0 ? item.stockQuantity : null

// Placement IDs increase on insertion; draw-stack reordering must not reallocate stock.
export function allocateStock(items, library, trackStock = true, lockedItems = []) {
  if (!trackStock) return {external:new Set(),componentUsage:new Map(),remaining:new Map(library.map(asset=>[asset.id,null]))}
  const assets = new Map(library.map(asset => [asset.id, asset]))
  const used = new Map(), external = new Set(), lockedExternal = new Set()
  for(const item of lockedItems){const id=assetReference(item);if(!id)continue;const quantity=stockQuantity(assets.get(id)||item),count=used.get(id)||0;if(item.useExternal||quantity!==null&&count>=quantity)lockedExternal.add(item.id);else used.set(id,count+1)}
  for (const item of [...items].sort((a,b) => Number(b.locked===true||b.editorLocked===true)-Number(a.locked===true||a.editorLocked===true)||Number(a.id)-Number(b.id))) {
    const id = assetReference(item)
    if (!id) continue
    const quantity = stockQuantity(assets.get(id) || item)
    const count = used.get(id) || 0
    if (item.useExternal || (quantity !== null && count >= quantity)) external.add(item.id)
    else used.set(id, count+1)
  }
  const componentUsage=new Map()
  for(const item of items)for(const component of enabledComponents(item).filter(component=>component.assetId)){
    const required=component.quantity||1,quantity=stockQuantity(assets.get(component.assetId)||component.equipment),count=used.get(component.assetId)||0,stock=component.supply==='client'?0:quantity===null?required:Math.max(0,Math.min(required,quantity-count)),outside=component.supply==='client'?required:quantity===null?0:required-stock
    used.set(component.assetId,count+stock);const totals=componentUsage.get(component.assetId)||{stock:0,external:0};totals.stock+=stock;totals.external+=outside;componentUsage.set(component.assetId,totals)
  }
  return { external, lockedExternal,componentUsage, remaining: new Map(library.map(asset => [asset.id, stockQuantity(asset) === null ? null : Math.max(0, stockQuantity(asset)-(used.get(asset.id)||0))])) }
}

export function assignEquipmentSources(items,library,trackStock=true,lockedItems=[]) {
  const prepared=items.map(item=>{
    const supplyOverride=['auto','venue','client'].includes(item.supplyOverride)?item.supplyOverride:item.useExternal?'client':'auto'
    return {...item,supplyOverride,useExternal:supplyOverride==='client'}
  })
  const allocation=allocateStock(prepared,library,trackStock,lockedItems)
  return prepared.map(item=>({...item,supply:item.supplyOverride==='client'?'client':item.supplyOverride==='venue'?'venue':trackStock&&assetReference(item)&&!allocation.external.has(item.id)?'venue':'client'}))
}

export function equipmentRows(items, library, allocation = allocateStock(items, library), trackStock = true, supplyTracking = false, stageItems = [], componentCategory = null) {
  const assets = new Map(library.map(asset => [asset.id, asset]))
  const rows = new Map(),components=new Map()
  for (const item of items) {
    const id = assetReference(item)
    if (!id && item.customType !== 'staging') continue
    const name = id ? assets.get(id)?.label || item.label || 'Equipment' : `${item.label || 'Stage deck'} (${item.widthMeters} × ${item.depthMeters} m, ${item.heightMm || 0} mm high)`
    const source = supplyTracking ? item.supply==='venue'?'Venue':'Client supplied' : !trackStock ? '' : allocation.external.has(item.id) ? 'External' : id ? 'Stock' : 'Stage deck'
    const key = JSON.stringify([id || name, source])
    if (!rows.has(key)) rows.set(key, {key,name,source,category:assets.get(id)?.groupLabel||assets.get(id)?.groupName||assets.get(id)?.groupId||'Equipment',...((assets.get(id)||item).showAsComponent===true?{showAsComponent:true,componentQuantity:0}:{}),quantity:0})
    const row=rows.get(key);row.quantity++;if(row.showAsComponent&&item.baseComponentEnabled!==false)row.componentQuantity++
    for(const component of enabledComponents(item)){
      const category=componentCategory||component.category||'General',componentKey=JSON.stringify([category,component.assetId||component.label,component.note||'',component.supply||'venue']),quantity=component.quantity||1,target=component.assetId?assets.get(component.assetId)||component.equipment:null,source=component.supply==='client'?(supplyTracking?'Client supplied':'Client'):component.supply==='venue'?(supplyTracking?'Venue':'Venue'):''
      if(!components.has(componentKey))components.set(componentKey,{key:'component:'+componentKey,kind:'component',assetId:component.assetId,category,name:target?.label||component.label,note:component.note||'',source,quantity:0})
      components.get(componentKey).quantity+=quantity
    }
  }
  for(const item of stageItems)for(const component of enabledComponents(item)){
    const category='Stage Equipment',componentKey=JSON.stringify([category,component.assetId||component.label,component.note||'']),quantity=component.quantity||1,target=component.assetId?assets.get(component.assetId)||component.equipment:null
    if(!components.has(componentKey))components.set(componentKey,{key:'component:'+componentKey,kind:'component',assetId:component.assetId,category,name:target?.label||component.label,note:component.note||'',source:trackStock?'Stage':'',quantity:0})
    components.get(componentKey).quantity+=quantity
  }
  for(const component of components.values())if(component.assetId&&trackStock&&!component.source){const quantity=stockQuantity(assets.get(component.assetId)||component.equipment),usage=allocation.componentUsage?.get(component.assetId);component.source=quantity===null?'Untracked':usage?.external?'External':'Stock'}
  return [...rows.values()].sort((a,b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source)).concat([...components.values()].sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)))
}

export function equipmentCsv(rows, trackStock = true) {
  const cell = value => '"'+String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""')+'"'
  return '\uFEFF'+[trackStock ? ['Equipment','Source','Quantity'] : ['Equipment','Quantity'],...rows.map(row=>{const name=(row.kind==='component'?'  '+row.name:row.name)+(row.note?' — '+row.note:'');return trackStock ? [name,row.source,row.quantity] : [name,row.quantity]})].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
