export function folderForItem(folders,itemId){return folders.find(folder=>folder.itemIds.includes(itemId))}

export function layerRows(items,folders){
  const rows=[],shown=new Set()
  for(const item of [...items].reverse()){
    const folder=folderForItem(folders,item.id)
    if(!folder)rows.push({type:'item',item})
    else if(!shown.has(folder.id)){shown.add(folder.id);rows.push({type:'folder',folder,items:[...items].reverse().filter(candidate=>folder.itemIds.includes(candidate.id))})}
  }
  for(const folder of folders)if(!shown.has(folder.id))rows.push({type:'folder',folder,items:[]})
  return rows
}

export function putItemInFolder(items,folders,itemId,folderId){
  const target=folders.find(folder=>folder.id===folderId)
  if(!target)return {items,folders}
  const memberIds=new Set(target.itemIds.filter(id=>id!==itemId)),moving=items.find(item=>item.id===itemId)
  if(!moving)return {items,folders}
  const members=items.filter(item=>memberIds.has(item.id)),positions=items.map((item,index)=>memberIds.has(item.id)?index:null).filter(index=>index!==null)
  const remaining=items.filter(item=>item.id!==itemId&&!memberIds.has(item.id))
  const originalAnchor=positions.length?Math.min(...positions):items.findIndex(item=>item.id===itemId)
  const removedBefore=items.slice(0,originalAnchor).filter(item=>item.id===itemId||memberIds.has(item.id)).length
  const anchor=Math.max(0,originalAnchor-removedBefore)
  remaining.splice(anchor,0,...members,moving)
  return {items:remaining,folders:folders.map(folder=>({...folder,itemIds:folder.id===folderId?[...members.map(item=>item.id),itemId]:folder.itemIds.filter(id=>id!==itemId)}))}
}

export function removeItemFromFolders(folders,itemId){return folders.map(folder=>({...folder,itemIds:folder.itemIds.filter(id=>id!==itemId)}))}

export function moveFolderBlock(items,folders,folderId,targetItemId){
  const folder=folders.find(candidate=>candidate.id===folderId),targetIndex=items.findIndex(item=>item.id===targetItemId)
  if(!folder||targetIndex<0)return items
  const ids=new Set(folder.itemIds),block=items.filter(item=>ids.has(item.id))
  if(!block.length||ids.has(targetItemId))return items
  const remaining=items.filter(item=>!ids.has(item.id)),target=remaining.findIndex(item=>item.id===targetItemId)
  remaining.splice(Math.max(0,target),0,...block)
  return remaining
}
