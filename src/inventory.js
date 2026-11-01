import { assetReference } from './project-file.js'
import {enabledComponents} from './equipment-components.js'

export const stockQuantity = item => Number.isSafeInteger(item?.stockQuantity) && item.stockQuantity >= 0 ? item.stockQuantity : null

// Placement IDs increase on insertion; draw-stack reordering must not reallocate stock.
export function allocateStock(items, library, trackStock = true, lockedItems = []) {
  if (!trackStock) return {external:new Set(),remaining:new Map(library.map(asset=>[asset.id,null]))}
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
  return { external, lockedExternal, remaining: new Map(library.map(asset => [asset.id, stockQuantity(asset) === null ? null : Math.max(0, stockQuantity(asset)-(used.get(asset.id)||0))])) }
}

export function assignEquipmentSources(items,library,trackStock=true,lockedItems=[]) {
  const prepared=items.map(item=>{
    const supplyOverride=['auto','venue','client'].includes(item.supplyOverride)?item.supplyOverride:item.useExternal?'client':'auto'
    return {...item,supplyOverride,useExternal:supplyOverride==='client'}
  })
  const allocation=allocateStock(prepared,library,trackStock,lockedItems)
  return prepared.map(item=>({...item,supply:item.supplyOverride==='client'?'client':item.supplyOverride==='venue'?'venue':trackStock&&assetReference(item)&&!allocation.external.has(item.id)?'venue':'client'}))
}

export function equipmentRows(items, library, allocation = allocateStock(items, library), trackStock = true, supplyTracking = false) {
  const assets = new Map(library.map(asset => [asset.id, asset]))
  const rows = new Map()
  for (const item of items) {
    const id = assetReference(item)
    if (!id && item.customType !== 'staging') continue
    const name = id ? assets.get(id)?.label || item.label || 'Equipment' : `${item.label || 'Stage deck'} (${item.widthMeters} × ${item.depthMeters} m, ${item.heightMm || 0} mm high)`
    const source = supplyTracking ? item.supply==='venue'?'Venue':'Client supplied' : !trackStock ? '' : allocation.external.has(item.id) ? 'External' : id ? 'Stock' : 'Stage deck'
    const key = JSON.stringify([id || name, source])
    if (!rows.has(key)) rows.set(key, {key, name, source, quantity:0,components:new Map()})
    const row=rows.get(key);row.quantity++
    for(const component of enabledComponents(item)){
      const componentKey=JSON.stringify([component.id,component.note||''])
      if(!row.components.has(componentKey))row.components.set(componentKey,{key:key+':'+componentKey,kind:'component',name:component.label,note:component.note||'',source:'',quantity:0})
      row.components.get(componentKey).quantity++
    }
  }
  return [...rows.values()].sort((a,b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source)).flatMap(({components,...row})=>[row,...components.values()])
}

export function equipmentCsv(rows, trackStock = true) {
  const cell = value => '"'+String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""')+'"'
  return '\uFEFF'+[trackStock ? ['Equipment','Source','Quantity'] : ['Equipment','Quantity'],...rows.map(row=>{const name=(row.kind==='component'?'  '+row.name:row.name)+(row.note?' — '+row.note:'');return trackStock ? [name,row.source,row.quantity] : [name,row.quantity]})].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
