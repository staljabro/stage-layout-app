import test from 'node:test'
import assert from 'node:assert/strict'
import { controlsKeepingWorldOrientation, normalizeDegrees } from './rotation-controls.js'

test('control-rotating an item preserves every articulated part world angle',()=>{
  const item={rotation:30,rotationParts:[{id:'top',defaultRotation:5},{id:'arm',defaultRotation:0}],controls:{top:{rotation:20},arm:{rotation:-15}}}
  const controls=controlsKeepingWorldOrientation(item,75)
  assert.equal(75+controls.top.rotation,30+20)
  assert.equal(75+controls.arm.rotation,30-15)
})

test('compensated part angles normalize without changing orientation',()=>{
  assert.equal(normalizeDegrees(-370),-10)
  const item={rotation:170,rotationParts:[{id:'part'}],controls:{part:{rotation:170}}}
  const rotation=controlsKeepingWorldOrientation(item,-170).part.rotation
  assert.equal(normalizeDegrees(-170+rotation),normalizeDegrees(170+170))
})
