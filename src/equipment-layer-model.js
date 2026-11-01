export function equipmentFolders(items,folders=[]) {
  const result=new Map(folders.map(folder=>[folder.id,{...folder,itemIds:[]}]))
  for(const item of items){
    const canonical=folders.find(folder=>(folder.itemIds||[]).some(id=>String(id)===String(item.id)))
    const data=canonical||item.equipmentFolder
    if(!data?.id)continue
    if(!result.has(data.id))result.set(data.id,{...data,itemIds:[]})
    result.get(data.id).itemIds.push(item.id)
  }
  return [...result.values()]
}
export function syncEquipmentFolders(items,folders) {
  return items.map(item=>{const folder=folders.find(folder=>(folder.itemIds||[]).some(id=>String(id)===String(item.id)));return {...item,equipmentFolder:folder?{id:folder.id,name:folder.name,collapsed:folder.collapsed===true,visible:folder.visible!==false}:null}})
}
export function moveEquipmentLayers(items,folders,drag,target) {
  const allFolders=equipmentFolders(items,folders)
  if(drag.kind==='folder'&&target.kind==='folder'&&drag.id===target.id)return {items,folders:allFolders}
  const moving=new Set(drag.kind==='folder'?allFolders.find(folder=>folder.id===drag.id)?.itemIds||[]:drag.kind==='group'?items.filter(item=>item.equipmentGroup?.id===drag.id).map(item=>item.id):drag.ids||[drag.id])
  if(drag.kind==='folder'&&!moving.size){const targetFolder=allFolders.find(folder=>folder.id===target.id),indices=(targetFolder?.itemIds||[]).map(id=>items.findIndex(item=>item.id===id)),targetIndex=target.kind==='item'?items.findIndex(item=>item.id===target.id):indices.length?Math.max(...indices):targetFolder?.stackIndex??items.length;return {items,folders:allFolders.map(folder=>folder.id===drag.id?{...folder,stackIndex:targetIndex+(target.edge==='below'?-.25:.25)}:folder)}}
  const moved=items.filter(item=>moving.has(item.id)),remaining=items.filter(item=>!moving.has(item.id))
  if(target.kind==='item'&&moving.has(target.id))return {items,folders:allFolders}
  const targetItem=items.find(item=>item.id===target.id)
  const destination=drag.kind==='folder'?allFolders.find(folder=>folder.id===drag.id):target.kind==='folder'?allFolders.find(folder=>folder.id===target.id):target.kind==='item'?allFolders.find(folder=>folder.id===targetItem?.equipmentFolder?.id):null
  let targetIds=target.kind==='folder'?allFolders.find(folder=>folder.id===target.id)?.itemIds||[]:[target.id]
  targetIds=targetIds.filter(id=>!moving.has(id))
  let index=target.kind==='outside'?0:targetIds.length?Math.max(...targetIds.map(id=>remaining.findIndex(item=>item.id===id))):remaining.length
  if(target.kind!=='outside'&&target.edge!=='below')index+=1
  index=Math.max(0,Math.min(remaining.length,index))
  const updated=moved.map(item=>{
    const entireGroup=item.equipmentGroup&&items.filter(candidate=>candidate.equipmentGroup?.id===item.equipmentGroup.id).every(candidate=>moving.has(candidate.id))
    return {...item,equipmentFolder:destination?{...destination,itemIds:undefined}:null,equipmentGroup:drag.kind!=='item'||entireGroup?item.equipmentGroup:targetItem?.equipmentGroup||null}
  })
  remaining.splice(index,0,...updated)
  const nextFolders=allFolders.map(folder=>({...folder,itemIds:remaining.filter(item=>item.equipmentFolder?.id===folder.id).map(item=>item.id)}))
  if(drag.kind==='folder'&&target.kind==='folder'){
    // Folder blocks retain their membership while moving as one stack unit.
    const original=allFolders.find(folder=>folder.id===drag.id)
    for(const item of remaining)if(moving.has(item.id))item.equipmentFolder={...original,itemIds:undefined}
    for(const folder of nextFolders)folder.itemIds=remaining.filter(item=>item.equipmentFolder?.id===folder.id).map(item=>item.id)
  }
  return {items:remaining,folders:nextFolders}
}
