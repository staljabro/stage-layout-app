import {equipmentRotationParts,fixedEquipmentControls,applyFixedEquipmentControls} from './equipment-part-controls.js';
import {wholeDegrees} from './rotation-angle.js';
import {syncEquipmentFolders} from './equipment-layer-model.js';
import {placementMetadata} from './layer-visibility.js';
import { stageText, stageZone } from './zone-groups.js';
import {normaliseStagePartVisibility} from './stage-part-visibility.js';
import { customItemData, restoreCustomItem } from './custom-items.js';
import {componentState,hydrateEquipmentComponents} from './equipment-components.js';

export function stageSpace(stage, savedVisibility = {},savedFixedControls={}) {
  const zones=(stage.zones||[]).map(stageZone);
  const textItems=(stage.textItems||[]).map(stageText);
  return {availableEquipment:structuredClone(stage.availableEquipment||[]),fixedEquipment:applyFixedEquipmentControls(stage,savedFixedControls).fixedEquipment,fixedEquipmentControls:fixedEquipmentControls(stage,savedFixedControls),assetSnapshot:stage,stageId:stage.id,name:stage.label,width:stage.dimensions.widthMeters,depth:stage.dimensions.depthMeters,collisionBoundary:stage.collisionBoundary,boundary:stage.boundary,zones,textItems,curtains:stage.curtains||[],partVisibility:normaliseStagePartVisibility(stage,savedVisibility)};
}
export function assetReference(item) {
  return item.assetId || (item.type?.startsWith('library:') ? item.type.slice(8) : null);
}
export function projectFile(project,space,items,preset='',collisionSettings={},layerFolders=[],layoutGraphics=[]) {
  const stageId=space?.stageId || (preset.startsWith('stage:') ? preset.slice(6) : null);
  return {schema:'stageplot-project@2',version:2,project,stage:space ? stageId ? {kind:'library',id:stageId,...(Object.keys(space.fixedEquipmentControls||{}).length?{fixedEquipmentControls:space.fixedEquipmentControls}:{}),...(space.partVisibility&&Object.keys(space.partVisibility).length?{partVisibility:space.partVisibility}:{})} : {kind:'rectangle',name:space.name,width:space.width,depth:space.depth} : null,
    collisionSettings:{equipment:collisionSettings.equipment!==false,zone:collisionSettings.zone!==false,snapping:collisionSettings.snapping!==false},
    layerFolders:layerFolders.map(folder=>({id:folder.id,name:folder.name,...(Number.isFinite(folder.stackIndex)?{stackIndex:folder.stackIndex}:{}),collapsed:folder.collapsed===true,visible:folder.visible!==false,itemIds:folder.itemIds.filter(id=>items.some(item=>item.id===id))})),
    layoutGraphics:layoutGraphics.map(graphic=>structuredClone(graphic)),
    items:items.map(item=>({id:item.id,...placementMetadata(item),...(item.supply?{supply:item.supply}:{}),...(customItemData(item)?{custom:customItemData(item)}:{assetId:assetReference(item)}),xMeters:item.xMeters,yMeters:item.yMeters,rotation:wholeDegrees(item.rotation),...(item.controls&&Object.keys(item.controls).length?{controls:item.controls}:{}),...(item.partVisibility&&Object.keys(item.partVisibility).length?{partVisibility:item.partVisibility}:{}),...(Object.keys(componentState(item.components,item.componentState)).length?{componentState:componentState(item.components,item.componentState)}:{}),...(item.baseComponentEnabled===false?{baseComponentEnabled:false}:{}),label:item.label,showLabel:item.showLabel===true,collisionEnabled:item.collisionEnabled!==false,visible:item.visible!==false,useExternal:item.useExternal===true}))};
}
export function resolveProject(data,equipment,stages,lockedStageId=null) {
  if(!data || !Array.isArray(data.items) || ![1,2].includes(data.version))throw new Error('Invalid project file');
  const legacyStage=data.version===1 && data.space?.boundary?.nodes ? stages.find(stage=>stage.label===data.space.name) : null;
  const stageRef=data.version===2 ? data.stage : data.space?.stageId ? {kind:'library',id:data.space.stageId} : data.space?.boundary?.nodes ? {kind:'library',id:legacyStage?.id || null} : data.space ? {kind:'rectangle',...data.space} : null;
  if(lockedStageId!==null && (stageRef?.kind!=='library' || stageRef.id!==lockedStageId))throw new Error('This link only allows its designated stage. Open this project from an unrestricted link.');
  let space=null,preset='';
  if(stageRef?.kind==='library') {
    const snapshot=data.assetSnapshots?.stage;
    const stage=(lockedStageId===null && snapshot?.id===stageRef.id ? snapshot : null) || stages.find(stage=>stage.id===stageRef.id);
    if(stage){space=stageSpace(stage,stageRef.partVisibility,stageRef.fixedEquipmentControls);preset='stage:'+stage.id;}
  } else if(stageRef?.kind==='rectangle') {
    if(!Number.isFinite(stageRef.width) || !Number.isFinite(stageRef.depth) || stageRef.width<=0 || stageRef.depth<=0)throw new Error('Invalid stage dimensions');
    space={name:stageRef.name || 'Custom Space',width:stageRef.width,depth:stageRef.depth};preset='custom';
  } else if(stageRef!==null && stageRef!==undefined)throw new Error('Invalid stage reference');
  const assets=new Map(equipment.map(asset=>[asset.id,asset]));
  for(const snapshot of data.assetSnapshots?.equipment || [])if(snapshot?.id && Array.isArray(snapshot.shapes) && snapshot.dimensions?.widthMeters>0 && snapshot.dimensions?.depthMeters>0)assets.set(snapshot.id,{...snapshot,rotationParts:equipmentRotationParts(snapshot,assets.get(snapshot.id)),stockQuantity:assets.get(snapshot.id)?.stockQuantity ?? null});
  const usedIds=new Set(),idMap=new Map();
  const items=data.items.flatMap((placement,index)=>{
    const xMeters=Number.isFinite(placement.xMeters)?placement.xMeters:data.version===1 && space ? (placement.x ?? 50)/100*space.width : NaN;
    const yMeters=Number.isFinite(placement.yMeters)?placement.yMeters:data.version===1 && space ? (placement.y ?? 50)/100*space.depth : NaN;
    if(!Number.isFinite(xMeters)||!Number.isFinite(yMeters))return [];
    let id=Number.isFinite(placement.id)&&!usedIds.has(placement.id)?placement.id:index+100;while(usedIds.has(id))id+=1;usedIds.add(id);idMap.set(placement.id,id);
    const custom=restoreCustomItem({...placement,xMeters,yMeters},id);
    if(custom)return [custom];
    const assetId=assetReference(placement),sourceAsset=assets.get(assetId),asset=sourceAsset?hydrateEquipmentComponents(sourceAsset,[...assets.values()]):null;
    if(!asset)return [];
    const rotationParts=equipmentRotationParts(asset),validParts=new Set(rotationParts.map(part=>part.id));
    const controls=Object.fromEntries(Object.entries(placement.controls||{}).filter(([id,value])=>validParts.has(id)&&Number.isFinite(value?.rotation)).map(([id,value])=>[id,{...value,rotation:wholeDegrees(value.rotation)}]));
    const toggleableParts=new Set((asset.shapes||[]).filter(shape=>shape.toggleable).map(shape=>String(shape.id)));
    const partVisibility=Object.fromEntries([...toggleableParts].map(id=>[id,placement.partVisibility?.[id]!==false]));
    return [{...asset,rotationParts,...placementMetadata(placement),componentState:componentState(asset.components,placement.componentState),baseComponentEnabled:placement.baseComponentEnabled!==false,id,assetId,type:'library:'+assetId,tone:'custom',supply:placement.supply==='venue'?'venue':'client',widthMeters:asset.dimensions.widthMeters,depthMeters:asset.dimensions.depthMeters,xMeters,yMeters,rotation:wholeDegrees(placement.rotation),controls,partVisibility,label:typeof placement.label==='string'?placement.label:asset.label,showLabel:placement.showLabel===true,collisionEnabled:placement.collisionEnabled!==false,visible:placement.visible!==false,useExternal:placement.useExternal===true}];
  });
  const layerFolders=(Array.isArray(data.layerFolders)?data.layerFolders:[]).map((folder,index)=>({id:typeof folder.id==='string'?folder.id:`folder-${index}`,name:typeof folder.name==='string'&&folder.name.trim()?folder.name:'Layer folder',...(Number.isFinite(folder.stackIndex)?{stackIndex:folder.stackIndex}:{}),collapsed:folder.collapsed===true,visible:folder.visible!==false,itemIds:[...new Set((Array.isArray(folder.itemIds)?folder.itemIds:[]).map(id=>idMap.get(id)).filter(id=>id!==undefined))]}));
  return {project:typeof data.project==='string'?data.project:'Untitled stageplot',space,preset,items:syncEquipmentFolders(items,layerFolders.length?layerFolders:items.flatMap(item=>item.equipmentFolder?[{...item.equipmentFolder,itemIds:items.filter(candidate=>candidate.equipmentFolder?.id===item.equipmentFolder.id).map(candidate=>candidate.id)}]:[])),layoutGraphics:Array.isArray(data.layoutGraphics)?data.layoutGraphics:[],layerFolders,collisionSettings:{equipment:data.collisionSettings?.equipment!==false,zone:data.collisionSettings?.zone!==false,snapping:data.collisionSettings?.snapping!==false},dropped:data.items.length-items.length,missingStage:stageRef?.kind==='library' && !space};
}
