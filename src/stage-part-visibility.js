import {stageImages} from './image-layer.js'
import {stageZone,stageText} from './zone-groups.js'
import {normaliseCurtain} from './stage-curtain.js'

export function stageParts(stage) {
  return [...(stage.zones||[]).map(stageZone),...(stage.textItems||[]).map(stageText),...stageImages(stage).map(stageText),...(stage.curtains||[]).map(item=>stageText(normaliseCurtain(item)))]
}

export function normaliseStagePartVisibility(stage,saved={}) {
  const parts=Object.fromEntries(stageParts(stage).filter(part=>part.toggleable).map(part=>[String(part.id),saved?.[part.id]!==false]))
  const hasRoof=stageParts(stage).some(part=>part.layerStack==='roof')||(stage.fixedEquipment||[]).some(item=>item.layerStack==='roof')
  const dimensions=(stage.editor?.dimensionLines||[]).length?{dimensions:saved?.dimensions!==false}:{}
  return hasRoof?{roof:saved?.roof!==false,...dimensions,...parts}:{...dimensions,...parts}
}

export function stagePartVisible(part,visibility={}) {
  return !(part.layerStack==='roof'&&visibility?.roof===false)&&!((part.type!=='curtain'&&Number.isFinite(part.length))&&visibility?.dimensions===false)&&(!stageText(part).toggleable||visibility?.[part.id]!==false)
}

// Keep source visibility and folder/group overrides intact. Layout choices can
// hide optional parts, but never reveal layers hidden by the stage author.
export function applyStagePartVisibility(stage,visibility={}) {
  const apply=part=>({...part,visible:part.visible!==false&&stagePartVisible(part,visibility)})
  return {...stage,zones:(stage.zones||[]).map(apply),textItems:(stage.textItems||[]).map(apply),images:stageImages(stage).map(apply),curtains:(stage.curtains||[]).map(apply),fixedEquipment:(stage.fixedEquipment||[]).map(apply)}
}

export function stagePartGroups(stage) {
  const groups=new Map()
  if(stageParts(stage).some(part=>part.layerStack==='roof')||(stage.fixedEquipment||[]).some(item=>item.layerStack==='roof'))groups.set('roof',{id:'roof',name:'Overhead Layers',ids:['roof']})
  if((stage.editor?.dimensionLines||[]).length)groups.set('dimensions',{id:'dimensions',name:'Dimensions',ids:['dimensions']})
  for(const part of stageParts(stage).filter(part=>part.toggleable)){
    const grouped=part.editorGroupId&&part.editorGroupToggleable
    const key=grouped?'group:'+part.editorGroupId:'part:'+part.id
    if(!groups.has(key))groups.set(key,{id:key,name:part.toggleName||part.name||part.text||(part.type==='curtain'?'Curtain':'Stage part'),ids:[]})
    groups.get(key).ids.push(String(part.id))
  }
  return [...groups.values()]
}
