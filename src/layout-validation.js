import {isItemInsideSpace,itemsCollide} from './geometry.js'
import {equipmentVisible} from './layer-visibility.js'
import {sampleStageBoundary} from './stage-geometry.js'
import {allocateStock,assignEquipmentSources} from './inventory.js'
import {placementBounds} from './layout-tools.js'

export function validateLayout({stage,items=[],fixedControls={},partVisibility={},library=[],organisationId=null,stageVersion=null,latestStageVersion=null}) {
  if(!stage?.boundary?.nodes?.length)return []
  const boundary=sampleStageBoundary(stage.boundary.nodes)
  const movedIds=new Set(Object.entries(fixedControls).filter(([,controls])=>controls?.$placement).map(([id])=>id))
  const layoutIds=new Set(items.map(item=>String(item.id)))
  const fixed=(stage.fixedEquipment||[]).map(item=>{const placement=fixedControls[item.id]?.$placement;return placement?{...item,...placement}:item})
  const movable=[...items,...fixed.filter(item=>movedIds.has(String(item.id)))].filter(item=>equipmentVisible(item)&&item.layerStack!=='roof')
  const outside=movable.filter(item=>!isItemInsideSpace(item,boundary))
  const visible=[...fixed,...items].filter(equipmentVisible),visibleBounds=visible.map(item=>placementBounds([item])),collisions=[]
  for(let left=0;left<visible.length;left++)for(let right=left+1;right<visible.length;right++){
    const a=visible[left],b=visible[right]
    if((a.layerStack==='roof')!==(b.layerStack==='roof')||a.collisionEnabled===false||b.collisionEnabled===false)continue
    if(!layoutIds.has(String(a.id))&&!layoutIds.has(String(b.id))&&!movedIds.has(String(a.id))&&!movedIds.has(String(b.id)))continue
    const aBounds=visibleBounds[left],bBounds=visibleBounds[right]
    if(aBounds.right<bBounds.x||bBounds.right<aBounds.x||aBounds.bottom<bBounds.y||bBounds.bottom<aBounds.y)continue
    if(itemsCollide(a,b))collisions.push([a.id,b.id])
  }
  const hiddenParts=Object.values(partVisibility).filter(value=>value===false).length
  const stock=new Map((stage.availableEquipment||[]).map(item=>[item.assetId,item.quantity])),trackStock=Boolean(organisationId||stock.size)
  const stockLibrary=library.map(item=>({...item,stockQuantity:stock.get(item.id)??(organisationId?item.stockQuantity??null:null)}))
  const sourced=assignEquipmentSources(items,stockLibrary,trackStock,fixed),allocation=allocateStock(sourced,stockLibrary,trackStock,fixed)
  const stockShortfalls=sourced.filter(item=>item.supplyOverride!=='client'&&allocation.external.has(item.id)).length+[...allocation.componentUsage.values()].reduce((total,value)=>total+value.external,0)
  const outdated=Number.isFinite(stageVersion)&&Number.isFinite(latestStageVersion)&&latestStageVersion>stageVersion
  return [
    outdated&&{code:'outdated-stage',count:latestStageVersion-stageVersion,message:`A newer source stage is available (version ${latestStageVersion}; this layout uses version ${stageVersion}).`},
    outside.length&&{code:'outside-stage',count:outside.length,message:`${outside.length} item${outside.length===1?' is':'s are'} outside the stage boundary.`},
    collisions.length&&{code:'equipment-collision',count:collisions.length,message:`${collisions.length} equipment collision${collisions.length===1?'':'s'} detected.`},
    movedIds.size&&{code:'moved-stage-assets',count:movedIds.size,message:`${movedIds.size} installed stage asset${movedIds.size===1?' has':'s have'} moved from the default position.`},
    hiddenParts&&{code:'hidden-stage-parts',count:hiddenParts,message:`${hiddenParts} optional stage part${hiddenParts===1?' is':'s are'} hidden.`},
    stockShortfalls&&{code:'stock-shortfall',count:stockShortfalls,message:`${stockShortfalls} equipment requirement${stockShortfalls===1?' needs':'s need'} external supply because tracked stock is unavailable.`},
  ].filter(Boolean)
}
