import { rotatedBounds } from '../tools/svg-shape-studio/src/rotation.js'

const boundsFor = item => rotatedBounds([{x:item.xMeters-item.widthMeters/2,y:item.yMeters-item.depthMeters/2,width:item.widthMeters,height:item.depthMeters,rotation:item.rotation||0}])

export function alignItems(items, mode) {
  if (items.length < 2) return items
  const bounds=items.map(item=>[item,boundsFor(item)])
  const target=mode==='left'?Math.min(...bounds.map(([,box])=>box.x)):mode==='right'?Math.max(...bounds.map(([,box])=>box.right)):mode==='top'?Math.min(...bounds.map(([,box])=>box.y)):mode==='bottom'?Math.max(...bounds.map(([,box])=>box.bottom)):mode==='hcentre'?(Math.min(...bounds.map(([,box])=>box.x))+Math.max(...bounds.map(([,box])=>box.right)))/2:(Math.min(...bounds.map(([,box])=>box.y))+Math.max(...bounds.map(([,box])=>box.bottom)))/2
  return bounds.map(([item,box])=>{
    const current=mode==='left'?box.x:mode==='right'?box.right:mode==='top'?box.y:mode==='bottom'?box.bottom:mode==='hcentre'?(box.x+box.right)/2:(box.y+box.bottom)/2
    return mode==='left'||mode==='right'||mode==='hcentre'?{...item,xMeters:item.xMeters+target-current}:{...item,yMeters:item.yMeters+target-current}
  })
}

export function distributeItems(items, axis) {
  if (items.length < 3) return items
  const key=axis==='horizontal'?'xMeters':'yMeters'
  const ordered=[...items].sort((a,b)=>a[key]-b[key])
  const first=ordered[0][key],last=ordered.at(-1)[key],step=(last-first)/(ordered.length-1)
  const positions=new Map(ordered.map((item,index)=>[item.id,first+step*index]))
  return items.map(item=>({...item,[key]:positions.get(item.id)}))
}
