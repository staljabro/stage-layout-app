export function zoneGroupIds(zones, id) {
  const zone=zones.find(zone=>zone.id===id)
  return zone?.editorGroupId ? zones.filter(candidate=>candidate.editorGroupId===zone.editorGroupId).map(candidate=>candidate.id) : [id]
}

export function stageZone(zone) {
  return zone.editorGroupId && zone.editorGroupToggleable
    ? {...zone,toggleable:true,toggleName:zone.editorGroupName || 'Zone group'}
    : zone
}

export function copyZoneGroups(copies, nextId) {
  const groups=new Map()
  return copies.map(copy=>{
    if (!copy.editorGroupId) return copy
    if (!groups.has(copy.editorGroupId)) groups.set(copy.editorGroupId,nextId())
    return {...copy,editorGroupId:groups.get(copy.editorGroupId)}
  })
}
