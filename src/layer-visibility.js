export const equipmentVisible = item => item.visible !== false && item.equipmentGroup?.visible !== false && item.equipmentFolder?.visible !== false
export const stageAssetVisible = (asset, folders=[]) => asset.visible !== false && asset.editorGroupVisible !== false && !folders.some(folder=>(folder.assetIds||folder.zoneIds||[]).includes(asset.id)&&folder.visible===false)
export function placementMetadata(item) {
  const container=value=>value&&typeof value.id==='string'?{id:value.id.slice(0,100),name:String(value.name||'Layers').slice(0,100),visible:value.visible!==false,collapsed:value.collapsed===true}:undefined
  return {supplyOverride:['auto','venue','client'].includes(item.supplyOverride)?item.supplyOverride:item.useExternal?'client':'auto',labelOffset:Number.isFinite(item.labelOffset)?Math.max(-2,Math.min(2,item.labelOffset)):1,equipmentGroup:container(item.equipmentGroup),equipmentFolder:container(item.equipmentFolder)}
}
