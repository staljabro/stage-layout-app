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

export function fittedImageSize(pixelWidth,pixelHeight,canvasWidth,canvasHeight) {
  const scale=Math.min(canvasWidth*.8/pixelWidth,canvasHeight*.8/pixelHeight)
  return {width:pixelWidth*scale,height:pixelHeight*scale}
}

export function resizeImageDimension(shape,axis,value) {
  const next={...shape,[axis]:Math.max(.01,value)}
  if(shape.lockAspect!==false){const ratio=shape.aspectRatio||shape.width/shape.height;if(axis==='width')next.height=next.width/ratio;else next.width=next.height*ratio}
  return next
}

export function cropImageEdge(shape,edge,dx,dy) {
  const crop=normaliseCrop(shape.crop),opposite={left:'right',right:'left',top:'bottom',bottom:'top'}[edge]
  const delta=edge==='left'?dx/shape.width:edge==='right'?-dx/shape.width:edge==='top'?dy/shape.height:-dy/shape.height
  return {...shape,crop:normaliseCrop({...crop,[edge]:Math.max(0,Math.min(.95,.99-crop[opposite],crop[edge]+delta))})}
}

export const stageImages=stage=>(stage.images??stage.editor?.referenceImages??(stage.editor?.referenceImage?[stage.editor.referenceImage]:[])).map(image=>({...image,type:'image',rotation:image.rotation||0,lockAspect:image.lockAspect!==false,crop:normaliseCrop(image.crop)}))

export const identityTransform={a:1,b:0,c:0,d:1,e:0,f:0}
export function composeImageTransform(parent,local) {
  const {a,b,c,d,e,f}=parent
  return {a:a*local.a+c*local.b,b:b*local.a+d*local.b,c:a*local.c+c*local.d,d:b*local.c+d*local.d,e:a*local.e+c*local.f+e,f:b*local.e+d*local.f+f}
}
export function imageTransform(shape) {
  const angle=(shape.rotation||0)*Math.PI/180,a=Math.cos(angle),b=Math.sin(angle),w=shape.width/2,h=shape.height/2
  return {a,b,c:-b,d:a,e:(shape.x||0)+w-a*w+b*h,f:(shape.y||0)+h-b*w-a*h}
}

// Clip in canvas coordinates while retaining local coordinates for rasterising.
export function imageSavePlan(shape,canvas,parent=identityTransform) {
  const box=imageBounds(shape),matrix=composeImageTransform(parent,imageTransform(shape))
  let polygon=[[box.x,box.y],[box.x+box.width,box.y],[box.x+box.width,box.y+box.height],[box.x,box.y+box.height]].map(([lx,ly])=>({lx,ly,x:matrix.a*lx+matrix.c*ly+matrix.e,y:matrix.b*lx+matrix.d*ly+matrix.f}))
  if(canvas)for(const [axis,limit,direction] of [['x',0,1],['x',canvas.width,-1],['y',0,1],['y',canvas.height,-1]]){
    const input=polygon;polygon=[]
    for(let i=0;i<input.length;i++){
      const p=input[i],q=input[(i+1)%input.length],insideP=(p[axis]-limit)*direction>=-1e-10,insideQ=(q[axis]-limit)*direction>=-1e-10
      if(insideP)polygon.push(p)
      if(insideP!==insideQ){const t=(limit-p[axis])/(q[axis]-p[axis]);polygon.push(Object.fromEntries(['x','y','lx','ly'].map(key=>[key,p[key]+(q[key]-p[key])*t])))}
    }
  }
  if(polygon.length<3)return null
  const x=Math.min(...polygon.map(p=>p.lx)),y=Math.min(...polygon.map(p=>p.ly)),width=Math.max(...polygon.map(p=>p.lx))-x,height=Math.max(...polygon.map(p=>p.ly))-y
  const area=Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.lx*q.ly-q.lx*p.ly},0))/2
  if(width<1e-9||height<1e-9||area<1e-12)return null
  const centre={x:x+width/2-shape.width/2,y:y+height/2-shape.height/2},angle=(shape.rotation||0)*Math.PI/180
  const baked={...shape,x:(shape.x||0)+shape.width/2+centre.x*Math.cos(angle)-centre.y*Math.sin(angle)-width/2,y:(shape.y||0)+shape.height/2+centre.x*Math.sin(angle)+centre.y*Math.cos(angle)-height/2,width,height,aspectRatio:width/height,crop:{left:0,right:0,top:0,bottom:0}}
  return {polygon,bounds:{x,y,width,height},baked,rectangular:Math.abs(area-width*height)<1e-9,trimmed:Math.abs(x)>1e-9||Math.abs(y)>1e-9||Math.abs(width-shape.width)>1e-9||Math.abs(height-shape.height)>1e-9||Math.abs(area-width*height)>1e-9}
}

// Full-frame target resolution before save-time cropping and canvas clipping.
export function imagePixelSize(shape,scale={x:1,y:1}) {
  return {width:Math.max(1,Math.round(shape.width*scale.x*100)),height:Math.max(1,Math.round(shape.height*scale.y*100))}
}

export function resizeCroppedImage(shape,handle,dx,dy,snap=value=>value) {
  const west=handle.endsWith('nw')||handle.endsWith('sw'),north=handle.endsWith('nw')||handle.endsWith('ne')
  let width=Math.max(.01,snap(shape.width+(west?-dx:dx))),height=Math.max(.01,snap(shape.height+(north?-dy:dy)))
  if(shape.lockAspect!==false){const axis=Math.abs(width/shape.width-1)>=Math.abs(height/shape.height-1)?'width':'height';({width,height}=resizeImageDimension(shape,axis,axis==='width'?width:height))}
  const angle=(shape.rotation||0)*Math.PI/180,ax=(west?1:-1)*(shape.width-width)/2,ay=(north?1:-1)*(shape.height-height)/2
  return {...shape,width,height,x:shape.x+(shape.width-width)/2+ax*Math.cos(angle)-ay*Math.sin(angle),y:shape.y+(shape.height-height)/2+ax*Math.sin(angle)+ay*Math.cos(angle)}
}
