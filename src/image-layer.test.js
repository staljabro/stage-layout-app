import test from 'node:test'
import assert from 'node:assert/strict'
import {normaliseCrop,validImageDataUrl,imagePixelSize,imageBounds,resizeCroppedImage} from './image-layer.js'
import {rotatedBounds} from './editor/rotation.js'

test('equipment image layers accept safe raster data and constrain crop edges',()=>{
  assert.equal(validImageDataUrl('data:image/png;base64,iVBORw0KGgo='),true)
  assert.equal(validImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='),false)
  const crop=normaliseCrop({left:.8,right:.8,top:-1,bottom:2})
  assert.equal(crop.left,.8);assert.ok(Math.abs(crop.right-.19)<1e-9);assert.equal(crop.top,0);assert.equal(crop.bottom,.95)
})

test('saved image resolution follows centimetres and stays constant when edges are cropped',()=>{
  assert.deepEqual(imagePixelSize({width:1,height:1}),{width:100,height:100})
  assert.deepEqual(imagePixelSize({width:.07,height:.14}),{width:7,height:14})
  assert.deepEqual(imagePixelSize({width:1,height:.5,crop:{left:.25,right:.25}}),{width:100,height:50})
  assert.deepEqual(imagePixelSize({width:2,height:1},{x:.5,y:2}),{width:100,height:200})
  assert.deepEqual(imagePixelSize({width:.001,height:.001}),{width:1,height:1})
})

test('crop edges move inward while full image size, scale and rotated position remain fixed',()=>{
  const image={type:'image',x:3,y:4,width:2,height:1,crop:{left:.25,right:.25,top:.1,bottom:.2}}
  const bounds=imageBounds(image)
  assert.deepEqual(bounds,{x:.5,y:.1,width:1,height:.7})
  assert.deepEqual(rotatedBounds([image]),{x:3.5,y:4.1,right:4.5,bottom:4.8})
  const rotated=rotatedBounds([{...image,rotation:90}])
  for(const [key,value] of Object.entries({x:3.7,y:4,right:4.4,bottom:5}))assert.ok(Math.abs(rotated[key]-value)<1e-9)
})

test('resizing cropped corners keeps the opposite visible corner anchored, including rotation',()=>{
  for(const rotation of [0,90,37])for(const handle of ['resize-nw','resize-ne','resize-sw','resize-se']){
    const original={type:'image',x:3,y:4,width:2,height:1,rotation,crop:{left:.25,right:.25,top:.1,bottom:.2}}
    const resized=resizeCroppedImage(original,handle,.1,.07),west=handle.endsWith('nw')||handle.endsWith('sw'),north=handle.endsWith('nw')||handle.endsWith('ne')
    const anchor=shape=>{const bounds=imageBounds(shape),x=bounds.x+(west?bounds.width:0)-shape.width/2,y=bounds.y+(north?bounds.height:0)-shape.height/2,angle=rotation*Math.PI/180;return {x:shape.x+shape.width/2+x*Math.cos(angle)-y*Math.sin(angle),y:shape.y+shape.height/2+x*Math.sin(angle)+y*Math.cos(angle)}}
    const before=anchor(original),after=anchor(resized)
    assert.ok(Math.abs(before.x-after.x)<1e-9);assert.ok(Math.abs(before.y-after.y)<1e-9)
    assert.ok(Math.abs(imageBounds(resized).width-(1+(west?-.1:.1)))<1e-9)
    assert.deepEqual(resized.crop,original.crop)
  }
})
