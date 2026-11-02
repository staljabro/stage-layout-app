import test from 'node:test'
import assert from 'node:assert/strict'
import {normaliseCrop,validImageDataUrl,imagePixelSize,imageBounds,resizeCroppedImage,fittedImageSize,resizeImageDimension,imageSavePlan,composeImageTransform,imageTransform,identityTransform} from './image-layer.js'
import {rotatedBounds} from './editor/rotation.js'

test('equipment image layers accept safe raster data and constrain crop edges',()=>{
  assert.equal(validImageDataUrl('data:image/png;base64,iVBORw0KGgo='),true)
  assert.equal(validImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='),false)
  const crop=normaliseCrop({left:.8,right:.8,top:-1,bottom:2})
  assert.equal(crop.left,.8);assert.ok(Math.abs(crop.right-.19)<1e-9);assert.equal(crop.top,0);assert.equal(crop.bottom,.95)
})

test('saved image resolution targets one pixel per 2 mm before trimming, including scaled artwork',()=>{
  assert.deepEqual(imagePixelSize({width:1,height:1}),{width:500,height:500})
  assert.deepEqual(imagePixelSize({width:.07,height:.14}),{width:35,height:70})
  assert.deepEqual(imagePixelSize({width:1,height:.5,crop:{left:.25,right:.25}}),{width:500,height:250})
  assert.deepEqual(imagePixelSize({width:2,height:1},{x:.5,y:2}),{width:500,height:1000})
  assert.deepEqual(imagePixelSize({width:.001,height:.001}),{width:1,height:1})
})

test('crop edges move inward while full image size, scale and rotated position remain fixed',()=>{
  const image={type:'image',x:3,y:4,width:2,height:1,crop:{left:.25,right:.25,top:.1,bottom:.2}}
  const bounds=imageBounds(image)
  assert.deepEqual(bounds,{x:.5,y:.1,width:1,height:.7})
  assert.deepEqual(rotatedBounds([image]),{x:3,y:4,right:5,bottom:5})
  const rotated=rotatedBounds([{...image,rotation:90}])
  for(const [key,value] of Object.entries({x:3.5,y:3.5,right:4.5,bottom:5.5}))assert.ok(Math.abs(rotated[key]-value)<1e-9)
})

test('image resizing uses the full frame and anchors the opposite corner, including rotation',()=>{
  for(const rotation of [0,90,37])for(const handle of ['resize-nw','resize-ne','resize-sw','resize-se']){
    const original={type:'image',x:3,y:4,width:2,height:1,rotation,lockAspect:false,crop:{left:.25,right:.25,top:.1,bottom:.2}}
    const resized=resizeCroppedImage(original,handle,.1,.07),west=handle.endsWith('nw')||handle.endsWith('sw'),north=handle.endsWith('nw')||handle.endsWith('ne')
    const anchor=shape=>{const bounds={x:0,y:0,width:shape.width,height:shape.height},x=bounds.x+(west?bounds.width:0)-shape.width/2,y=bounds.y+(north?bounds.height:0)-shape.height/2,angle=rotation*Math.PI/180;return {x:shape.x+shape.width/2+x*Math.cos(angle)-y*Math.sin(angle),y:shape.y+shape.height/2+x*Math.sin(angle)+y*Math.cos(angle)}}
    const before=anchor(original),after=anchor(resized)
    assert.ok(Math.abs(before.x-after.x)<1e-9);assert.ok(Math.abs(before.y-after.y)<1e-9)
    assert.ok(Math.abs(resized.width-(2+(west?-.1:.1)))<1e-9)
    assert.deepEqual(resized.crop,original.crop)
  }
})


test('image placement fits both canvas dimensions without changing the original aspect ratio',()=>{
  assert.deepEqual(fittedImageSize(500,1000,1,1),{width:.4,height:.8})
  assert.deepEqual(fittedImageSize(1000,250,10,2),{width:6.4,height:1.6})
  const image={x:0,y:0,width:2,height:1,rotation:0,crop:{left:.2}}
  assert.equal(resizeImageDimension(image,'width',4).height,2)
  assert.equal(resizeCroppedImage(image,'resize-se',1,.2).width/resizeCroppedImage(image,'resize-se',1,.2).height,2)
  assert.equal(resizeImageDimension({...image,lockAspect:false},'height',3).width,2)
})

test('saving clips images to the canvas and bakes crop geometry without changing visible placement',()=>{
  const image={type:'image',x:-.4,y:.2,width:2,height:1,rotation:0,crop:{left:.1,right:.1}},before=structuredClone(image)
  const plan=imageSavePlan(image,{width:1,height:1})
  assert.equal(plan.trimmed,true)
  assert.ok(Math.abs(plan.baked.x)<1e-9)
  assert.ok(Math.abs(plan.baked.width-1)<1e-9)
  assert.ok(Math.abs(plan.baked.height-.8)<1e-9)
  assert.deepEqual(plan.baked.crop,{left:0,right:0,top:0,bottom:0})
  assert.ok(plan.polygon.every(p=>p.x>=-1e-9&&p.x<=1+1e-9&&p.y>=-1e-9&&p.y<=1+1e-9))
  assert.equal(imageSavePlan({...image,x:5},{width:1,height:1}),null)
  assert.deepEqual(image,before)
})

test('rotated images and images inside transformed artwork clip in canvas coordinates',()=>{
  const image={x:-.2,y:.3,width:1,height:.4,rotation:37}
  const parent=composeImageTransform(identityTransform,imageTransform({x:.1,y:.1,width:1,height:1,rotation:12}))
  const plan=imageSavePlan(image,{width:1,height:1},parent)
  assert.ok(plan.trimmed)
  assert.ok(plan.polygon.every(p=>p.x>=-1e-9&&p.x<=1+1e-9&&p.y>=-1e-9&&p.y<=1+1e-9))
  const a=composeImageTransform(parent,imageTransform(image)),b=composeImageTransform(parent,imageTransform(plan.baked))
  for(const point of plan.polygon){
    const x=point.lx-plan.bounds.x,y=point.ly-plan.bounds.y
    assert.ok(Math.abs((b.a*x+b.c*y+b.e)-(a.a*point.lx+a.c*point.ly+a.e))<1e-9)
    assert.ok(Math.abs((b.b*x+b.d*y+b.f)-(a.b*point.lx+a.d*point.ly+a.f))<1e-9)
  }
})
