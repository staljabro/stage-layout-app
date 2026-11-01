import {wholeDegrees} from './rotation-angle.js'
import {stageAssetVisible} from './layer-visibility.js'

// Metres. The phase and spacing stay fixed when the line length changes.
export const CURTAIN_AMPLITUDE=.05
export const CURTAIN_WAVELENGTH=.4
export const CURTAIN_DEFAULT_THICKNESS=.02
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback
export function normaliseCurtain(value={}) {
  return {...value,type:'curtain',x:finite(value.x,0),y:finite(value.y,0),length:Math.max(.01,Math.min(1000,finite(value.length,4))),rotation:wholeDegrees(finite(value.rotation,0)),color:/^#[\da-f]{6}$/i.test(value.color)?value.color:'#000000',thickness:Math.max(1,Math.min(200,Math.round(finite(value.thickness,CURTAIN_DEFAULT_THICKNESS)*1000)))/1000,opacity:Math.max(0,Math.min(1,finite(value.opacity,1))),collisionEnabled:value.collisionEnabled!==false}
}
export const stageLineAssets=stage=>[...(stage.editor?.dimensionLines||[]),...(stage.curtains||[]).map(normaliseCurtain)]
export function curtainPoints(value) {
  const {length}=normaliseCurtain(value),step=CURTAIN_WAVELENGTH/32,count=Math.ceil(length/step)
  return Array.from({length:count+1},(_,index)=>{const x=Math.min(index*step,length);return {x,y:CURTAIN_AMPLITUDE*Math.sin(x*2*Math.PI/CURTAIN_WAVELENGTH)}})
}
export const curtainPath=value=>curtainPoints(value).map((point,index)=>`${index?'L':'M'} ${point.x} ${point.y}`).join(' ')
export function curtainCollisionLine(value) {
  const line=normaliseCurtain(value),angle=line.rotation*Math.PI/180
  return [{x:line.x,y:line.y},{x:line.x+line.length*Math.cos(angle),y:line.y+line.length*Math.sin(angle)}]
}
export const curtainCollisionLines=stage=>(stage.curtains||[]).filter(line=>line.collisionEnabled!==false&&stageAssetVisible(line,stage.layerFolders)).map(curtainCollisionLine)
export function stageLineBounds(line) {
  const angle=(line.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),padding=line.type==='curtain'?CURTAIN_AMPLITUDE+normaliseCurtain(line).thickness/2:.08
  const corners=[[0,-padding],[0,padding],[line.length,-padding],[line.length,padding]].map(([x,y])=>({x:line.x+x*c-y*s,y:line.y+x*s+y*c}))
  return {x:Math.min(...corners.map(point=>point.x)),y:Math.min(...corners.map(point=>point.y)),right:Math.max(...corners.map(point=>point.x)),bottom:Math.max(...corners.map(point=>point.y))}
}
export function resizeCurtain(line,end,point) {
  const angle=(line.rotation||0)*Math.PI/180,fixed=end==='end'?{x:line.x,y:line.y}:{x:line.x+line.length*Math.cos(angle),y:line.y+line.length*Math.sin(angle)}
  const dx=end==='end'?point.x-fixed.x:fixed.x-point.x,dy=end==='end'?point.y-fixed.y:fixed.y-point.y
  const rotation=wholeDegrees(Math.atan2(dy,dx)*180/Math.PI),length=Math.max(.01,Math.min(1000,Math.hypot(dx,dy))),nextAngle=rotation*Math.PI/180
  return {...line,rotation,length,x:end==='end'?fixed.x:fixed.x-length*Math.cos(nextAngle),y:end==='end'?fixed.y:fixed.y-length*Math.sin(nextAngle)}
}
