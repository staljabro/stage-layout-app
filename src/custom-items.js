import {wholeDegrees} from './rotation-angle.js'
import {textLayout} from './text-layout.js'
import {placementMetadata} from './layer-visibility.js'
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback
const deckSize=value=>Math.max(.1,Math.round(value*10)/10)

export function stagingSnapPoints(widthMeters, depthMeters) {
  const width = deckSize(widthMeters)
  const depth = deckSize(depthMeters)
  const axis=length=>[...Array.from({length:Math.floor(length)+1},(_,index)=>index),...(Number.isInteger(length)?[]:[length])]
  const points = []
  for (const y of axis(depth)) {
    for (const x of axis(width)) points.push({ x, y })
  }
  return points
}

export function customStagingItem(values = {}) {
  const widthMeters = deckSize(finite(values.widthMeters, 1))
  const depthMeters = deckSize(finite(values.depthMeters, 1))
  return {
    ...values,
    customType: 'staging',
    label: !values.label || values.label==='Custom staging - Prostage' ? 'Stage deck' : values.label,
    widthMeters,
    depthMeters,
    heightMm: Math.max(0, Math.round(finite(values.heightMm, 200))),
    showHeight: values.showHeight !== false,
    fill: values.fill || '#d6d2c5',
    fillOpacity: finite(values.fillOpacity, 1),
    line: values.line || '#25261f',
    lineOpacity: finite(values.lineOpacity, 1),
    sublineColor: values.sublineColor || '#85837c',
    textColor: values.textColor || '#25261f',
    textOpacity: finite(values.textOpacity, 1),
    collisionEnabled: values.collisionEnabled === true,
    collisionShapes: [{ type: 'rect', x: 0, y: 0, width: widthMeters, height: depthMeters }],
    snapPoints: stagingSnapPoints(widthMeters, depthMeters),
  }
}

export function customDrapesItem(values = {}) {
  const widthMeters=Math.max(.1,finite(values.widthMeters,4)),thickness=Math.max(.001,Math.min(.2,finite(values.thickness,.02)))
  const depthMeters=Math.max(.2,thickness+.1)
  return {...values,customType:'drapes',label:values.label||'Drapes',widthMeters,depthMeters,thickness,color:/^#[\da-f]{6}$/i.test(values.color)?values.color:'#000000',opacity:Math.max(0,Math.min(1,finite(values.opacity,1))),collisionEnabled:values.collisionEnabled!==false,collisionShapes:[{type:'rect',x:0,y:(depthMeters-thickness)/2,width:widthMeters,height:thickness}],snapPoints:[{x:0,y:depthMeters/2},{x:widthMeters,y:depthMeters/2}]}
}

export function customTextItem(values = {}) {
  const item={
    ...values,
    customType: 'text',
    label: values.label || 'Custom Text',
    text: typeof values.text === 'string' ? values.text : 'Custom Text',
    fontSize: Math.max(.01, finite(values.fontSize, .3)),
    bold: values.bold === true,
    italic: values.italic === true,
    fill: values.fill || '#25261f',
    lineSpacing: finite(values.lineSpacing,1.2),
    textAlign: 'left',
    collisionEnabled: values.collisionEnabled === true,
    collisionShapes: [],
    snapPoints: [],
  }
  const measured=textLayout(item)
  return {...item,widthMeters:measured.width+item.fontSize*.2,depthMeters:measured.height+item.fontSize*.2}
}

export function customItemData(item) {
  if (item.customType === 'staging') return {
    type: 'staging', widthMeters: item.widthMeters, depthMeters: item.depthMeters,
    heightMm: item.heightMm, showHeight: item.showHeight !== false,
    fill: item.fill, fillOpacity: item.fillOpacity, line: item.line,
    lineOpacity: item.lineOpacity, sublineColor: item.sublineColor, textColor: item.textColor, textOpacity:item.textOpacity,
  }
  if (item.customType === 'text') return {
    type: 'text', text: item.text, fontSize: item.fontSize, bold: item.bold === true,
    italic: item.italic === true, fill: item.fill, lineSpacing:item.lineSpacing,
    widthMeters: item.widthMeters, depthMeters: item.depthMeters,
  }
  if(item.customType==='drapes')return {type:'drapes',widthMeters:item.widthMeters,thickness:item.thickness,color:item.color,opacity:item.opacity}
  return null
}

export function restoreCustomItem(placement, id) {
  const common = {
    ...placementMetadata(placement),
    id, supply:'client', xMeters: placement.xMeters, yMeters: placement.yMeters,
    rotation: wholeDegrees(placement.rotation),
    label: typeof placement.label === 'string' ? placement.label : undefined,
    showLabel: placement.showLabel === true, visible: placement.visible !== false,
    collisionEnabled: placement.collisionEnabled === true,
  }
  if (placement.custom?.type === 'staging') return customStagingItem({ ...placement.custom, ...common })
  if (placement.custom?.type === 'text') return customTextItem({ ...placement.custom, ...common })
  if (placement.custom?.type === 'drapes') return customDrapesItem({ ...placement.custom, ...common })
  return null
}
