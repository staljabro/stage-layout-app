import {wholeDegrees,wholeDegreesWithin} from './rotation-angle.js'

export function equipmentRotationParts(item,fallback) {
  const references=new Set()
  const visit=shape=>{if(shape.rotationPartId!=null)references.add(shape.rotationPartId);for(const child of shape.children||[])visit(child)}
  for(const shape of item.shapes||[])visit(shape)
  const own=Array.isArray(item.rotationParts)?item.rotationParts:Array.isArray(item.editor?.rotationParts)?item.editor.rotationParts:[]
  const parts=own.length?own:(fallback?.rotationParts||[]).filter(part=>references.has(part.id))
  return parts.filter(part=>part?.id!=null).map(part=>{
    const min=part.minRotation!=null&&Number.isFinite(Number(part.minRotation))?Math.ceil(Number(part.minRotation)):-360
    const max=part.maxRotation!=null&&Number.isFinite(Number(part.maxRotation))?Math.floor(Number(part.maxRotation)):360
    return {...part,name:part.name||part.label||String(part.id),minRotation:Math.min(min,max),maxRotation:Math.max(min,max),defaultRotation:wholeDegrees(part.defaultRotation??0)}
  })
}

export function fixedEquipmentControls(stage,saved={}) {
  const entries=[]
  for(const item of stage.fixedEquipment||[]){
    const controls={}
    for(const part of equipmentRotationParts(item)){
      const value=saved?.[item.id]?.[part.id]?.rotation
      if(Number.isFinite(value))controls[part.id]={rotation:wholeDegreesWithin(value,part.minRotation,part.maxRotation)}
    }
    if(Object.keys(controls).length)entries.push([item.id,controls])
  }
  return Object.fromEntries(entries)
}

export function applyFixedEquipmentControls(stage,saved={}) {
  const valid=fixedEquipmentControls(stage,saved)
  return {...stage,fixedEquipment:(stage.fixedEquipment||[]).map(item=>({...structuredClone(item),...(valid[item.id]?{controls:{...item.controls,...valid[item.id]}}:{})}))}
}
