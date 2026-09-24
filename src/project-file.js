import { customItemData, restoreCustomItem } from './custom-items.js';

export function stageSpace(stage, savedVisibility = {}) {
  const toggleable=[...(stage.zones||[]),...(stage.textItems||[])].filter(part=>part.toggleable).map(part=>String(part.id));
  return {stageId:stage.id,name:stage.label,width:stage.dimensions.widthMeters,depth:stage.dimensions.depthMeters,collisionBoundary:stage.collisionBoundary,boundary:stage.boundary,zones:stage.zones || [],textItems:stage.textItems || [],partVisibility:Object.fromEntries(toggleable.map(id=>[id,savedVisibility[id]!==false]))};
}
export function assetReference(item) {
  return item.assetId || (item.type?.startsWith('library:') ? item.type.slice(8) : null);
}
export function projectFile(project,space,items,preset='',collisionSettings={},layerFolders=[]) {
  const stageId=space?.stageId || (preset.startsWith('stage:') ? preset.slice(6) : null);
  return {schema:'stageplot-project@2',version:2,project,stage:space ? stageId ? {kind:'library',id:stageId,...(space.partVisibility&&Object.keys(space.partVisibility).length?{partVisibility:space.partVisibility}:{})} : {kind:'rectangle',name:space.name,width:space.width,depth:space.depth} : null,
    collisionSettings:{equipment:collisionSettings.equipment!==false,zone:collisionSettings.zone!==false,snapping:collisionSettings.snapping!==false},
    layerFolders:layerFolders.map(folder=>({id:folder.id,name:folder.name,collapsed:folder.collapsed===true,visible:folder.visible!==false,itemIds:folder.itemIds.filter(id=>items.some(item=>item.id===id))})),
    items:items.map(item=>({id:item.id,...(customItemData(item)?{custom:customItemData(item)}:{assetId:assetReference(item)}),xMeters:item.xMeters,yMeters:item.yMeters,rotation:item.rotation || 0,...(item.controls&&Object.keys(item.controls).length?{controls:item.controls}:{}),...(item.partVisibility&&Object.keys(item.partVisibility).length?{partVisibility:item.partVisibility}:{}),label:item.label,showLabel:item.showLabel===true,collisionEnabled:item.collisionEnabled!==false,visible:item.visible!==false}))};
}
export function resolveProject(data,equipment,stages,lockedStageId=null) {
  if(!data || !Array.isArray(data.items) || ![1,2].includes(data.version))throw new Error('Invalid project file');
  const legacyStage=data.version===1 && data.space?.boundary?.nodes ? stages.find(stage=>stage.label===data.space.name) : null;
  const stageRef=data.version===2 ? data.stage : data.space?.stageId ? {kind:'library',id:data.space.stageId} : data.space?.boundary?.nodes ? {kind:'library',id:legacyStage?.id || null} : data.space ? {kind:'rectangle',...data.space} : null;
  if(lockedStageId!==null && (stageRef?.kind!=='library' || stageRef.id!==lockedStageId))throw new Error('This link only allows its designated stage. Open this project from an unrestricted link.');
  let space=null,preset='';
  if(stageRef?.kind==='library') {
    const stage=stages.find(stage=>stage.id===stageRef.id);
    if(stage){space=stageSpace(stage,stageRef.partVisibility);preset='stage:'+stage.id;}
  } else if(stageRef?.kind==='rectangle') {
    if(!Number.isFinite(stageRef.width) || !Number.isFinite(stageRef.depth) || stageRef.width<=0 || stageRef.depth<=0)throw new Error('Invalid stage dimensions');
    space={name:stageRef.name || 'Custom Space',width:stageRef.width,depth:stageRef.depth};preset='custom';
  } else if(stageRef!==null && stageRef!==undefined)throw new Error('Invalid stage reference');
  const assets=new Map(equipment.map(asset=>[asset.id,asset]));
  const usedIds=new Set(),idMap=new Map();
  const items=data.items.flatMap((placement,index)=>{
    const xMeters=Number.isFinite(placement.xMeters)?placement.xMeters:data.version===1 && space ? (placement.x ?? 50)/100*space.width : NaN;
    const yMeters=Number.isFinite(placement.yMeters)?placement.yMeters:data.version===1 && space ? (placement.y ?? 50)/100*space.depth : NaN;
    if(!Number.isFinite(xMeters)||!Number.isFinite(yMeters))return [];
    let id=Number.isFinite(placement.id)&&!usedIds.has(placement.id)?placement.id:index+100;while(usedIds.has(id))id+=1;usedIds.add(id);idMap.set(placement.id,id);
    const custom=restoreCustomItem({...placement,xMeters,yMeters},id);
    if(custom)return [custom];
    const assetId=assetReference(placement),asset=assets.get(assetId);
    if(!asset)return [];
    const validParts=new Set((asset.rotationParts||[]).map(part=>part.id));
    const controls=Object.fromEntries(Object.entries(placement.controls||{}).filter(([id,value])=>validParts.has(id)&&Number.isFinite(value?.rotation)));
    const toggleableParts=new Set((asset.shapes||[]).filter(shape=>shape.toggleable).map(shape=>String(shape.id)));
    const partVisibility=Object.fromEntries([...toggleableParts].map(id=>[id,placement.partVisibility?.[id]!==false]));
    return [{...asset,id,assetId,type:'library:'+assetId,tone:'custom',widthMeters:asset.dimensions.widthMeters,depthMeters:asset.dimensions.depthMeters,xMeters,yMeters,rotation:Number.isFinite(placement.rotation)?placement.rotation:0,controls,partVisibility,label:typeof placement.label==='string'?placement.label:asset.label,showLabel:placement.showLabel===true,collisionEnabled:placement.collisionEnabled!==false,visible:placement.visible!==false}];
  });
  const layerFolders=(Array.isArray(data.layerFolders)?data.layerFolders:[]).map((folder,index)=>({id:typeof folder.id==='string'?folder.id:`folder-${index}`,name:typeof folder.name==='string'&&folder.name.trim()?folder.name:'Layer folder',collapsed:folder.collapsed===true,visible:folder.visible!==false,itemIds:[...new Set((Array.isArray(folder.itemIds)?folder.itemIds:[]).map(id=>idMap.get(id)).filter(id=>id!==undefined))]}));
  return {project:typeof data.project==='string'?data.project:'Untitled stageplot',space,preset,items,layerFolders,collisionSettings:{equipment:data.collisionSettings?.equipment!==false,zone:data.collisionSettings?.zone!==false,snapping:data.collisionSettings?.snapping!==false},dropped:data.items.length-items.length,missingStage:stageRef?.kind==='library' && !space};
}
