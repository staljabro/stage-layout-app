import {validImageDataUrl,imageSavePlan,identityTransform,composeImageTransform,imageTransform,stageImages} from './image-layer.js'

function imagePreparation(canvas) {
  const decoded=new Map(),resized=new Map()
  const clipKey=(shape,parent)=>JSON.stringify([canvas?.width,canvas?.height,shape.x||0,shape.y||0,shape.width,shape.height,shape.rotation||0,...['a','b','c','d','e','f'].map(key=>parent[key]),...['left','right','top','bottom'].map(key=>shape.crop?.[key]||0)].map(value=>typeof value==='number'?Number(value.toFixed(9)):value))
  const load=dataUrl=>{
    if(!decoded.has(dataUrl))decoded.set(dataUrl,new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('An image could not be read. Replace it before saving.'));image.src=dataUrl
    }))
    return decoded.get(dataUrl)
  }
  const prepare=async(shape,parent=identityTransform)=>{
    if(!validImageDataUrl(shape.dataUrl))return shape
    const plan=imageSavePlan(shape,canvas,parent)
    if(!plan)return null
    const image=await load(shape.dataUrl),{bounds,baked,polygon}=plan
    const scale={x:Math.hypot(parent.a,parent.b),y:Math.hypot(parent.c,parent.d)}
    const width=Math.max(1,Math.min(Math.round(bounds.width*scale.x*100),Math.round(image.naturalWidth*bounds.width/shape.width)))
    const height=Math.max(1,Math.min(Math.round(bounds.height*scale.y*100),Math.round(image.naturalHeight*bounds.height/shape.height)))
    if((!plan.trimmed||shape.savedCanvasClip===clipKey(shape,parent))&&width===image.naturalWidth&&height===image.naturalHeight)return shape
    const key=JSON.stringify([shape.dataUrl,shape.width,shape.height,bounds,polygon.map(p=>[p.lx,p.ly]),width,height])
    if(!resized.has(key))resized.set(key,new Promise((resolve,reject)=>{
      const target=document.createElement('canvas');target.width=width;target.height=height
      const context=target.getContext('2d');if(!context){reject(new Error('Unable to prepare images. Please try saving again.'));return}
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high'
      context.setTransform(width/bounds.width,0,0,height/bounds.height,-bounds.x*width/bounds.width,-bounds.y*height/bounds.height)
      context.beginPath();polygon.forEach((p,index)=>index?context.lineTo(p.lx,p.ly):context.moveTo(p.lx,p.ly));context.closePath();context.clip()
      context.drawImage(image,0,0,shape.width,shape.height)
      const type=shape.dataUrl.startsWith('data:image/jpeg;')&&plan.rectangular?'image/jpeg':'image/png'
      target.toBlob(blob=>{
        if(!blob){reject(new Error('Unable to save an image. Please try again.'));return}
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Unable to save a prepared image.'));reader.readAsDataURL(blob)
      },type,.9)
    }))
    return {...baked,...(canvas?{savedCanvasClip:clipKey(baked,parent)}:{}),dataUrl:await resized.get(key)}
  }
  const layers=async(entries=[],parent=identityTransform)=>{
    const result=[]
    for(const entry of entries){
      if(entry.type==='compound'&&entry.children){
        const transform=composeImageTransform(composeImageTransform(parent,imageTransform(entry)),{a:entry.width/entry.artworkWidth,b:0,c:0,d:entry.height/entry.artworkHeight,e:0,f:0})
        result.push({...entry,children:await layers(entry.children,transform)})
      }else{const value=entry.type==='image'?await prepare(entry,parent):entry;if(value)result.push(value)}
    }
    return result
  }
  return {layers,prepare}
}
const canvasSize=document=>document.dimensions?{width:document.dimensions.widthMeters,height:document.dimensions.depthMeters}:undefined

export async function prepareEquipmentImages(equipment) {
  const {layers,prepare}=imagePreparation(canvasSize(equipment)),result={...equipment,shapes:await layers(equipment.shapes)}
  if(equipment.editor){
    result.editor={...equipment.editor}
    if(equipment.editor.layers)result.editor.layers=await layers(equipment.editor.layers)
    if(equipment.editor.referenceImages)result.editor.referenceImages=(await Promise.all(equipment.editor.referenceImages.map(image=>prepare(image)))).filter(Boolean)
  }
  return result
}

export async function prepareStageImages(stage) {
  const {layers}=imagePreparation(canvasSize(stage))
  const images=await layers(stageImages(stage)),editor={...stage.editor};delete editor.referenceImages;delete editor.referenceImage
  return {...stage,images,editor}
}
