const imagePattern=/^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/=\r\n]+$/i
export const validImageDataUrl=value=>typeof value==='string'&&value.length<=16_000_000&&imagePattern.test(value)
export function normaliseCrop(value={}) {
  const crop=Object.fromEntries(['left','right','top','bottom'].map(key=>[key,Math.max(0,Math.min(.95,Number(value?.[key])||0))]))
  if(crop.left+crop.right>=.99)crop.right=Math.max(0,.99-crop.left)
  if(crop.top+crop.bottom>=.99)crop.bottom=Math.max(0,.99-crop.top)
  return crop
}

export function imageBounds(shape) {
  const crop=normaliseCrop(shape.crop)
  return {x:shape.width*crop.left,y:shape.height*crop.top,width:shape.width*(1-crop.left-crop.right),height:shape.height*(1-crop.top-crop.bottom)}
}

// Resolution follows the full image's physical size; cropping only hides edges.
export function imagePixelSize(shape,scale={x:1,y:1}) {
  return {width:Math.max(1,Math.round(shape.width*scale.x*100)),height:Math.max(1,Math.round(shape.height*scale.y*100))}
}

export function resizeCroppedImage(shape,handle,dx,dy,snap=value=>value) {
  const crop=normaliseCrop(shape.crop),bounds=imageBounds(shape),west=handle.endsWith('nw')||handle.endsWith('sw'),north=handle.endsWith('nw')||handle.endsWith('ne')
  const width=Math.max(.01,snap(shape.width+(west?-dx:dx)/(1-crop.left-crop.right))),height=Math.max(.01,snap(shape.height+(north?-dy:dy)/(1-crop.top-crop.bottom)))
  const next={...shape,width,height},nextBounds=imageBounds(next),angle=(shape.rotation||0)*Math.PI/180
  const anchor=(item,box)=>({x:box.x+(west?box.width:0)-item.width/2,y:box.y+(north?box.height:0)-item.height/2})
  const before=anchor(shape,bounds),after=anchor(next,nextBounds),ax=before.x-after.x,ay=before.y-after.y
  return {...next,x:shape.x+(shape.width-width)/2+ax*Math.cos(angle)-ay*Math.sin(angle),y:shape.y+(shape.height-height)/2+ax*Math.sin(angle)+ay*Math.cos(angle)}
}
