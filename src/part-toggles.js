export function toggleableParts(item) {
  const parts = new Map()
  for (const shape of item.shapes || []) {
    if (!shape.toggleable) continue
    const name = shape.toggleName || shape.name || 'Item part'
    if (!parts.has(name)) parts.set(name, { name, ids: [] })
    parts.get(name).ids.push(shape.id)
  }
  return [...parts.values()]
}

export function sharedParts(items) {
  return items.length ? toggleableParts(items[0]).filter(part => items.every(item => toggleableParts(item).some(candidate => candidate.name === part.name))) : []
}

export function partState(items, name) {
  const values = items.flatMap(item => toggleableParts(item).filter(part => part.name === name).flatMap(part => part.ids.map(id => item.partVisibility?.[id] !== false)))
  return values.every(Boolean) ? true : values.every(value => !value) ? false : 'mixed'
}

export function setPart(item, name, value) {
  const ids = toggleableParts(item).find(part => part.name === name)?.ids || []
  return { ...item, partVisibility: { ...item.partVisibility, ...Object.fromEntries(ids.map(id => [id, value])) } }
}
