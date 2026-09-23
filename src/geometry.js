// Geometry is stored in metres. Artwork bounds and collision footprints are
// deliberately separate: transparent SVG corners must never block placement.

export function pointInPolygon(point, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

export function collisionPolygons(item, samples = 32) {
  const width = item.widthMeters ?? 1
  const depth = item.depthMeters ?? 1
  const shapes = item.collisionShapes?.length ? item.collisionShapes : [{ type: 'rect', x: 0, y: 0, width, height: depth }]
  const itemRotation = (item.rotation ?? 0) * Math.PI / 180

  return shapes.map((shape) => {
    let points
    if (shape.type === 'ellipse' || shape.type === 'circle') {
      points = Array.from({ length: samples }, (_, index) => {
        const angle = index / samples * Math.PI * 2
        return { x: .5 + Math.cos(angle) * .5, y: .5 + Math.sin(angle) * .5 }
      })
    } else if (shape.type === 'polygon' && shape.points?.length >= 3) points = shape.points
    else points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]

    const shapeRotation = (shape.rotation ?? 0) * Math.PI / 180
    return points.map((point) => {
      let normalizedX
      let normalizedY
      if (shape.type === 'polygon') {
        normalizedX = point.x
        normalizedY = point.y
      } else {
        const px = (point.x - .5) * shape.width
        const py = (point.y - .5) * shape.height
        normalizedX = shape.x + shape.width / 2 + px * Math.cos(shapeRotation) - py * Math.sin(shapeRotation)
        normalizedY = shape.y + shape.height / 2 + px * Math.sin(shapeRotation) + py * Math.cos(shapeRotation)
      }
      const part=item.rotationParts?.find(candidate=>candidate.id===shape.rotationPartId)
      if(part){const angle=((item.controls?.[part.id]?.rotation??part.defaultRotation??0)*Math.PI)/180,dx=normalizedX-part.pivotX,dy=normalizedY-part.pivotY;normalizedX=part.pivotX+dx*Math.cos(angle)-dy*Math.sin(angle);normalizedY=part.pivotY+dx*Math.sin(angle)+dy*Math.cos(angle)}
      const localX = normalizedX - width / 2
      const localY = normalizedY - depth / 2
      return {
        x: item.xMeters + localX * Math.cos(itemRotation) - localY * Math.sin(itemRotation),
        y: item.yMeters + localX * Math.sin(itemRotation) + localY * Math.cos(itemRotation),
      }
    })
  })
}

export function footprintPoints(item, samples = 32) {
  return collisionPolygons(item, samples).flat()
}

export function isItemInsideSpace(item, boundary) {
  return footprintPoints(item).every((point) => pointInPolygon(point, boundary))
}

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
const pointOnSegment = (point, a, b) => Math.abs(cross(a, b, point)) < 1e-9
  && point.x >= Math.min(a.x, b.x) - 1e-9 && point.x <= Math.max(a.x, b.x) + 1e-9
  && point.y >= Math.min(a.y, b.y) - 1e-9 && point.y <= Math.max(a.y, b.y) + 1e-9
export function polygonsIntersect(first, second) {
  const onBoundary=(point,polygon)=>polygon.some((start,index)=>pointOnSegment(point,start,polygon[(index+1)%polygon.length]))
  const strictlyInside=(point,polygon)=>pointInPolygon(point,polygon)&&!onBoundary(point,polygon)
  const probes=polygon=>[...polygon,...polygon.map((point,index)=>({x:(point.x+polygon[(index+1)%polygon.length].x)/2,y:(point.y+polygon[(index+1)%polygon.length].y)/2})),{x:polygon.reduce((sum,point)=>sum+point.x,0)/polygon.length,y:polygon.reduce((sum,point)=>sum+point.y,0)/polygon.length}]
  if(probes(first).some(point=>strictlyInside(point,second))||probes(second).some(point=>strictlyInside(point,first)))return true
  return first.some((point,index) => second.some((other,otherIndex) => {
    const next=first[(index+1)%first.length],otherNext=second[(otherIndex+1)%second.length]
    const a=cross(point,next,other),b=cross(point,next,otherNext),c=cross(other,otherNext,point),d=cross(other,otherNext,next)
    return ((a>1e-9&&b< -1e-9)||(a< -1e-9&&b>1e-9))&&((c>1e-9&&d< -1e-9)||(c< -1e-9&&d>1e-9))
  }))
}

export function itemsCollide(first, second) {
  return collisionPolygons(first).some(firstPolygon => collisionPolygons(second).some(secondPolygon => polygonsIntersect(firstPolygon, secondPolygon)))
}

export function itemSnapPoints(item) {
  const rotation=(item.rotation||0)*Math.PI/180,width=item.widthMeters??1,depth=item.depthMeters??1
  return (item.snapPoints||[]).map(point=>{
    const x=point.x-width/2,y=point.y-depth/2
    return {x:item.xMeters+x*Math.cos(rotation)-y*Math.sin(rotation),y:item.yMeters+x*Math.sin(rotation)+y*Math.cos(rotation)}
  })
}

export function nearestSnapOffset(moving,stationary,radius=.3) {
  let nearest=null
  const fixed=stationary.flatMap(itemSnapPoints)
  for(const point of moving.flatMap(itemSnapPoints))for(const target of fixed){const dx=target.x-point.x,dy=target.y-point.y,distance=Math.hypot(dx,dy);if(distance<=radius&&(!nearest||distance<nearest.distance))nearest={dx,dy,distance}}
  return nearest
}

export function rectangleBoundary(width, depth) {
  return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }]
}
