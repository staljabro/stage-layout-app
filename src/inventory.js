import { assetReference } from './project-file.js'

export const stockQuantity = item => Number.isSafeInteger(item?.stockQuantity) && item.stockQuantity >= 0 ? item.stockQuantity : null

// Placement IDs increase on insertion; draw-stack reordering must not reallocate stock.
export function allocateStock(items, library) {
  const assets = new Map(library.map(asset => [asset.id, asset]))
  const used = new Map(), external = new Set()
  for (const item of [...items].sort((a,b) => a.id-b.id)) {
    const id = assetReference(item)
    if (!id) continue
    const quantity = stockQuantity(assets.get(id) || item)
    const count = used.get(id) || 0
    if (item.useExternal || (quantity !== null && count >= quantity)) external.add(item.id)
    else used.set(id, count+1)
  }
  return { external, remaining: new Map(library.map(asset => [asset.id, stockQuantity(asset) === null ? null : Math.max(0, stockQuantity(asset)-(used.get(asset.id)||0))])) }
}

export function equipmentRows(items, library, allocation = allocateStock(items, library)) {
  const assets = new Map(library.map(asset => [asset.id, asset]))
  const rows = new Map()
  for (const item of items) {
    const id = assetReference(item)
    if (!id && item.customType !== 'staging') continue
    const name = id ? assets.get(id)?.label || item.label || 'Equipment' : `${item.label || 'Custom staging'} (${item.widthMeters} × ${item.depthMeters} m, ${item.heightMm || 0} mm high)`
    const source = allocation.external.has(item.id) ? 'External' : id ? 'Stock' : 'Custom staging'
    const key = JSON.stringify([id || name, source])
    if (!rows.has(key)) rows.set(key, {key, name, source, quantity:0})
    rows.get(key).quantity++
  }
  return [...rows.values()].sort((a,b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

export function equipmentCsv(rows) {
  const cell = value => '"'+String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""')+'"'
  return '\uFEFF'+[['Equipment','Source','Quantity'],...rows.map(row=>[row.name,row.source,row.quantity])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
