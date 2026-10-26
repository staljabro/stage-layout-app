export function assetSnapshot(asset, id=asset.id) {
  const copy={...asset,id}
  for(const key of ['editor','shareToken','shareEquipmentIds','ownerId','deleted','proposedReplacementId','assetSnapshot','xMeters','yMeters','widthMeters','depthMeters','type','tone','assetId','controls','partVisibility','useExternal','supply','collisionEnabled','visible','showLabel'])delete copy[key]
  return copy
}
export function pinProject(data,space,items) {
  const equipment=new Map()
  for(const item of items)if(item.assetId)equipment.set(item.assetId,assetSnapshot(item,item.assetId))
  return {...data,assetSnapshots:{equipment:[...equipment.values()],stage:space?.assetSnapshot ? assetSnapshot(space.assetSnapshot) : null}}
}
