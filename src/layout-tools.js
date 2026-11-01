import { rotatedBounds } from './editor/rotation.js'

const boundsFor = item => rotatedBounds([{x:item.xMeters-item.widthMeters/2,y:item.yMeters-item.depthMeters/2,width:item.widthMeters,height:item.depthMeters,rotation:item.rotation||0}])
export const placementBounds = items => {
  const boxes=items.map(boundsFor)
  const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y)),right=Math.max(...boxes.map(box=>box.right)),bottom=Math.max(...boxes.map(box=>box.bottom))
  return {x,y,right,bottom,cx:(x+right)/2,cy:(y+bottom)/2}
}

export function equipmentRotationHandle(items,screenUnit=.01) {
  const angle=(items[0]?.rotation||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle)
  const local=items.map(item=>({...item,xMeters:item.xMeters*cos+item.yMeters*sin,yMeters:-item.xMeters*sin+item.yMeters*cos,rotation:(item.rotation||0)-angle*180/Math.PI}))
  const box=placementBounds(local),world=(x,y)=>({x:x*cos-y*sin,y:x*sin+y*cos})
  return {pivot:world(box.cx,box.cy),edge:world(box.cx,box.y),handle:world(box.cx,box.y-22*screenUnit)}
}

// A clear pointer destination takes precedence over the path from the last
// constrained position. This lets a drag catch up after going around an obstacle.
export function dragPlacement(items,dx,dy,isValid,directions=[]) {
  const target=items.map(item=>({...item,xMeters:item.xMeters+dx,yMeters:item.yMeters+dy}))
  return isValid(target)?target:slidePlacement(items,dx,dy,isValid,directions)
}

// Sweep to the contact point, then project the remaining motion onto obstacle edges.
// Every accepted step moves the complete selection, preserving relative positions.
export function slidePlacement(items,dx,dy,isValid,directions=[]) {
  const translate=(input,x,y)=>input.map(item=>({...item,xMeters:item.xMeters+x,yMeters:item.yMeters+y}))
  const sweep=(input,x,y)=>{
    const count=Math.max(1,Math.ceil(Math.hypot(x,y)/.02));let accepted=input
    for(let index=1;index<=count;index++){
      const candidate=translate(input,x*index/count,y*index/count)
      if(!isValid(candidate)){let low=(index-1)/count,high=index/count;for(let n=0;n<12;n++){const mid=(low+high)/2,next=translate(input,x*mid,y*mid);if(isValid(next)){low=mid;accepted=next}else high=mid}return accepted}
      accepted=candidate
    }
    return accepted
  }
  if(!isValid(items)){const target=translate(items,dx,dy);return isValid(target)?target:items}
  const target={x:items[0].xMeters+dx,y:items[0].yMeters+dy}
  let result=sweep(items,dx,dy)
  for(let iteration=0;iteration<3;iteration++){
    const remaining={x:target.x-result[0].xMeters,y:target.y-result[0].yMeters}
    let best=result,distance=Math.hypot(remaining.x,remaining.y)
    for(const vector of [{x:1,y:0},{x:0,y:1},...directions]){
      const length=Math.hypot(vector.x,vector.y);if(length<1e-6)continue
      const amount=(remaining.x*vector.x+remaining.y*vector.y)/(length*length)
      const next=sweep(result,vector.x*amount,vector.y*amount),error=Math.hypot(target.x-next[0].xMeters,target.y-next[0].yMeters)
      if(error<distance-1e-6){best=next;distance=error}
    }
    if(best===result)break
    result=best
  }
  return result
}

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
