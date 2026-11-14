const changedNumber=(left,right)=>Number(left||0)!==Number(right||0)

const itemMap=items=>new Map((items||[]).map(item=>[String(item.id),item]))

function equipmentChanges(previous=[],current=[]) {
  const before=itemMap(previous),after=itemMap(current)
  let added=0,removed=0,moved=0
  for(const [id,item] of after){
    const original=before.get(id)
    if(!original){added++;continue}
    if(changedNumber(original.xMeters,item.xMeters)||changedNumber(original.yMeters,item.yMeters)||changedNumber(original.rotation,item.rotation))moved++
  }
  for(const id of before.keys())if(!after.has(id))removed++
  return {added,removed,moved}
}

const placement=controls=>controls?.$placement
const samePlacement=(left,right)=>left===right||Boolean(left&&right&&!changedNumber(left.xMeters,right.xMeters)&&!changedNumber(left.yMeters,right.yMeters))

function installedAssetChanges(previous={},current={}) {
  const ids=new Set([...Object.keys(previous||{}),...Object.keys(current||{})])
  let count=0
  for(const id of ids)if(!samePlacement(placement(previous?.[id]),placement(current?.[id])))count++
  return count
}

function visibilityChanges(previous={},current={}) {
  const ids=new Set([...Object.keys(previous||{}),...Object.keys(current||{})])
  let count=0
  for(const id of ids)if((previous?.[id]!==false)!==(current?.[id]!==false))count++
  return count
}

export function summariseLayoutChanges(previous={},current={}) {
  const equipment=equipmentChanges(previous.layoutEquipment,current.layoutEquipment)
  const installed=installedAssetChanges(previous.layoutFixedControls,current.layoutFixedControls)
  const visibility=visibilityChanges(previous.stagePartVisibility,current.stagePartVisibility)
  const changes=[]
  if(equipment.added)changes.push({code:'equipment-added',count:equipment.added,message:`${equipment.added} equipment item${equipment.added===1?'':'s'} added`})
  if(equipment.removed)changes.push({code:'equipment-removed',count:equipment.removed,message:`${equipment.removed} equipment item${equipment.removed===1?'':'s'} removed`})
  if(equipment.moved)changes.push({code:'equipment-moved',count:equipment.moved,message:`${equipment.moved} equipment item${equipment.moved===1?'':'s'} repositioned`})
  if(installed)changes.push({code:'stage-assets-positioned',count:installed,message:`${installed} installed stage asset${installed===1?'':'s'} repositioned`})
  if(visibility)changes.push({code:'visibility-changed',count:visibility,message:`${visibility} stage visibility setting${visibility===1?'':'s'} changed`})
  if((previous.layoutNotes||'')!==(current.layoutNotes||''))changes.push({code:'notes-changed',count:1,message:'Layout notes changed'})
  if(previous.stageVersion!=null&&current.stageVersion!=null&&previous.stageVersion!==current.stageVersion)changes.push({code:'source-stage-updated',count:current.stageVersion,message:`Source stage updated to version ${current.stageVersion}`})
  return changes
}

export function layoutRevisionState(snapshot={}) {
  const data=snapshot?.data||{}
  return {layoutEquipment:data.items||[],layoutFixedControls:data.stage?.fixedEquipmentControls||{},stagePartVisibility:data.stage?.partVisibility||{},layoutNotes:snapshot?.notes||'',stageVersion:snapshot?.stageVersion}
}
