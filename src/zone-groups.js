export function stageGroupIds(assets, id) {
  const asset=assets.find(candidate=>candidate.id===id)
  return asset?.editorGroupId ? assets.filter(candidate=>candidate.editorGroupId===asset.editorGroupId).map(candidate=>candidate.id) : [id]
}

export const zoneGroupIds = stageGroupIds

export function stageZone(zone) {
  return zone.editorGroupId && zone.editorGroupToggleable
    ? {...zone,toggleable:true,toggleName:zone.editorGroupName || 'Zone group'}
    : zone
}

export function stageText(item) {
  return item.editorGroupId && item.editorGroupToggleable
    ? {...item,toggleable:true,toggleName:item.editorGroupName || 'Stage group'}
    : item
}

export function copyZoneGroups(copies, nextId) {
  const groups=new Map()
  return copies.map(copy=>{
    if (!copy.editorGroupId) return copy
    if (!groups.has(copy.editorGroupId)) groups.set(copy.editorGroupId,nextId())
    return {...copy,editorGroupId:groups.get(copy.editorGroupId)}
  })
}

export const copyStageGroups = copyZoneGroups
