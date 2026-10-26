import { rotatedBounds } from '../tools/svg-shape-studio/src/rotation.js'

const boundsFor = item => rotatedBounds([{x:item.xMeters-item.widthMeters/2,y:item.yMeters-item.depthMeters/2,width:item.widthMeters,height:item.depthMeters,rotation:item.rotation||0}])

export function availablePlacement(item,space,isValid) {
  if(isValid(item))return item
  // Prefer the requested location, then search nearby before scanning the stage.
  for(let ring=1;ring<=32;ring++)for(let direction=0;direction<16;direction++){
    const angle=direction*Math.PI/8,radius=ring*.25
    const candidate={...item,xMeters:item.xMeters+Math.cos(angle)*radius,yMeters:item.yMeters+Math.sin(angle)*radius}
    if(isValid(candidate))return candidate
  }
  for(let row=0;row<=24;row++)for(let column=0;column<=24;column++){
    const candidate={...item,xMeters:item.widthMeters/2+(space.width-item.widthMeters)*column/24,yMeters:item.depthMeters/2+(space.depth-item.depthMeters)*row/24}
    if(isValid(candidate))return candidate
  }
  return null
}

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
