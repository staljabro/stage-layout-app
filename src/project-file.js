export function stageSpace(stage) {
  return {stageId:stage.id,name:stage.label,width:stage.dimensions.widthMeters,depth:stage.dimensions.depthMeters,collisionBoundary:stage.collisionBoundary,boundary:stage.boundary,zones:stage.zones || [],textItems:stage.textItems || []};
}
export function assetReference(item) {
  return item.assetId || (item.type?.startsWith('library:') ? item.type.slice(8) : null);
}
export function projectFile(project,space,items,preset='') {
  const stageId=space?.stageId || (preset.startsWith('stage:') ? preset.slice(6) : null);
  return {schema:'stageplot-project@2',version:2,project,stage:space ? stageId ? {kind:'library',id:stageId} : {kind:'rectangle',name:space.name,width:space.width,depth:space.depth} : null,
    items:items.map(item=>({id:item.id,assetId:assetReference(item),xMeters:item.xMeters,yMeters:item.yMeters,rotation:item.rotation || 0,label:item.label,showLabel:item.showLabel===true}))};
}
export function resolveProject(data,equipment,stages,lockedStageId=null) {
  if(!data || !Array.isArray(data.items) || ![1,2].includes(data.version))throw new Error('Invalid project file');
  const legacyStage=data.version===1 && data.space?.boundary?.nodes ? stages.find(stage=>stage.label===data.space.name) : null;
  const stageRef=data.version===2 ? data.stage : data.space?.stageId ? {kind:'library',id:data.space.stageId} : data.space?.boundary?.nodes ? {kind:'library',id:legacyStage?.id || null} : data.space ? {kind:'rectangle',...data.space} : null;
  if(lockedStageId!==null && (stageRef?.kind!=='library' || stageRef.id!==lockedStageId))throw new Error('This link only allows its designated stage. Open this project from an unrestricted link.');
  let space=null,preset='';
  if(stageRef?.kind==='library') {
    const stage=stages.find(stage=>stage.id===stageRef.id);
    if(stage){space=stageSpace(stage);preset='stage:'+stage.id;}
  } else if(stageRef?.kind==='rectangle') {
    if(!Number.isFinite(stageRef.width) || !Number.isFinite(stageRef.depth) || stageRef.width<=0 || stageRef.depth<=0)throw new Error('Invalid stage dimensions');
    space={name:stageRef.name || 'Custom Space',width:stageRef.width,depth:stageRef.depth};preset='custom';
  } else if(stageRef!==null && stageRef!==undefined)throw new Error('Invalid stage reference');
  const assets=new Map(equipment.map(asset=>[asset.id,asset]));
  const items=data.items.flatMap((placement,index)=>{
    const assetId=assetReference(placement),asset=assets.get(assetId);
    if(!asset)return [];
    const xMeters=Number.isFinite(placement.xMeters)?placement.xMeters:data.version===1 && space ? (placement.x ?? 50)/100*space.width : NaN;
    const yMeters=Number.isFinite(placement.yMeters)?placement.yMeters:data.version===1 && space ? (placement.y ?? 50)/100*space.depth : NaN;
    if(!Number.isFinite(xMeters)||!Number.isFinite(yMeters))return [];
    return [{...asset,id:index+100,assetId,type:'library:'+assetId,tone:'custom',widthMeters:asset.dimensions.widthMeters,depthMeters:asset.dimensions.depthMeters,xMeters,yMeters,rotation:Number.isFinite(placement.rotation)?placement.rotation:0,label:typeof placement.label==='string'?placement.label:asset.label,showLabel:placement.showLabel===true}];
  });
  return {project:typeof data.project==='string'?data.project:'Untitled stageplot',space,preset,items,dropped:data.items.length-items.length,missingStage:stageRef?.kind==='library' && !space};
}
