import {wholeDegrees} from '../rotation-angle.js'
import {normaliseComponents} from '../equipment-components.js'
export function normaliseLayerCollision(layer) {
  return {...layer,...(layer.rotation!==undefined?{rotation:wholeDegrees(layer.rotation)}:{}),collision:layer.collisionOnly===true||layer.collision===true,...(layer.children?{children:layer.children.map(normaliseLayerCollision)}:{})}
}
export function equipmentSession(data) {
  const artwork=data.editor?.layers?.length?data.editor.layers:(data.shapes||[]).map((shape,index)=>({...shape,id:index+1,name:shape.name||`Layer ${index+1}`,collision:false}))
  const collisions=data.editor?.layers?.length?[]:(data.collisionShapes||[]).map((shape,index)=>{
    if(shape.type==='polygon'&&shape.points?.length){const x=Math.min(...shape.points.map(point=>point.x)),y=Math.min(...shape.points.map(point=>point.y));return {id:artwork.length+index+1,name:'Collision',type:'vector',x,y,width:Math.max(...shape.points.map(point=>point.x))-x,height:Math.max(...shape.points.map(point=>point.y))-y,nodes:shape.points.map(point=>({x:point.x-x,y:point.y-y,curveMode:'line'})),collision:true,collisionOnly:true}}
    return {...shape,id:artwork.length+index+1,name:'Collision',collision:true,collisionOnly:true}
  })
  return {documentMode:'item',shapeName:data.label,realWidth:data.dimensions.widthMeters,realDepth:data.dimensions.depthMeters,items:[...artwork,...collisions].map(normaliseLayerCollision),itemFolders:data.editor?.layerFolders||[],rotationParts:data.rotationParts||[],components:normaliseComponents(data.components),cornerSnapping:!!data.snapPoints?.length,referenceImages:data.editor?.referenceImages||[],groupId:data.groupId||'',activeLibraryId:data.id,draftAssetId:data.id,advancedShapeRole:null}
}
