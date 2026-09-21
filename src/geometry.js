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

export function footprintPoints(item, samples = 32) {
  const width = item.widthMeters ?? 1
  const depth = item.depthMeters ?? 1
  const shapes = item.collisionShapes?.length ? item.collisionShapes : [{ type: 'rect', x: 0, y: 0, width, height: depth }]
  const itemRotation = (item.rotation ?? 0) * Math.PI / 180

  return shapes.flatMap((shape) => {
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

export function isItemInsideSpace(item, boundary) {
  return footprintPoints(item).every((point) => pointInPolygon(point, boundary))
}

export function rectangleBoundary(width, depth) {
  return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }]
}
