import test from 'node:test'
import assert from 'node:assert/strict'
import { itemsCollide, nearestSnapOffset } from './geometry.js'

const rectangle = (id, xMeters, yMeters, rotation = 0) => ({
  id, xMeters, yMeters, rotation, widthMeters: 1, depthMeters: .5,
  collisionShapes: [{ type: 'rect', x: 0, y: 0, width: 1, height: .5 }],
})

test('equipment collision uses transformed collision geometry', () => {
  assert.equal(itemsCollide(rectangle(1, 1, 1), rectangle(2, 2.1, 1)), false)
  assert.equal(itemsCollide(rectangle(1, 1, 1), rectangle(2, 1.8, 1)), true)
  assert.equal(itemsCollide(rectangle(1, 1, 1, 90), rectangle(2, 1.8, 1)), false)
})

test('transparent bounding-box corners do not cause ellipse collisions', () => {
  const ellipse = (id, xMeters, yMeters) => ({
    id, xMeters, yMeters, widthMeters: 1, depthMeters: 1,
    collisionShapes: [{ type: 'ellipse', x: 0, y: 0, width: 1, height: 1 }],
  })
  assert.equal(itemsCollide(ellipse(1, 0, 0), ellipse(2, .9, .9)), false)
  assert.equal(itemsCollide(ellipse(1, 0, 0), ellipse(2, .7, .7)), true)
})

test('items may touch edges without being treated as overlapping',()=>{
  assert.equal(itemsCollide(rectangle(1,1,1),rectangle(2,2,1)),false)
})

test('corner snapping finds the closest transformed points within 30 cm',()=>{
  const snapping=(id,xMeters,yMeters,rotation=0)=>({...rectangle(id,xMeters,yMeters,rotation),snapPoints:[{x:0,y:0},{x:1,y:0},{x:1,y:.5},{x:0,y:.5}]})
  const nearby=nearestSnapOffset([snapping(1,1,1)],[snapping(2,2.2,1)],.3)
  assert.ok(nearby);assert.ok(Math.abs(nearby.dx-.2)<1e-9);assert.ok(Math.abs(nearby.dy)<1e-9)
  assert.equal(nearestSnapOffset([snapping(1,1,1)],[snapping(2,2.31,1)],.3),null)
  assert.ok(nearestSnapOffset([snapping(1,1,1,90)],[snapping(2,1.25,1.75)],.3))
})
