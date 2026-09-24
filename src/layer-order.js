export function belongsToStagingGroup(item, groups = []) {
  const group=groups.find(candidate=>candidate.id===item.groupId)
  return item.customType==='staging' || item.groupId==='staging' || group?.label?.trim().toLowerCase()==='staging'
}

export function insertAtDefaultLayer(items,item,groups = []) {
  return belongsToStagingGroup(item,groups)?[item,...items]:[...items,item]
}
