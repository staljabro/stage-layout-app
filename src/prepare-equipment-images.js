import {imagePixelSize,validImageDataUrl} from './image-layer.js'

// Keep crop coordinates and layer geometry unchanged; replace only embedded data.
export async function prepareEquipmentImages(equipment) {
  const decoded=new Map(),resized=new Map()
  const load=dataUrl=>{
    if(!decoded.has(dataUrl))decoded.set(dataUrl,new Promise((resolve,reject)=>{
      const image=new Image()
      image.onload=()=>resolve(image)
      image.onerror=()=>reject(new Error('An equipment image could not be read. Replace it before saving.'))
      image.src=dataUrl
    }))
    return decoded.get(dataUrl)
  }
  const resize=async(shape,scale)=>{
    if(!validImageDataUrl(shape.dataUrl))return shape
    const target=imagePixelSize(shape,scale),image=await load(shape.dataUrl)
    const width=Math.min(image.naturalWidth,target.width),height=Math.min(image.naturalHeight,target.height)
    if(width===image.naturalWidth&&height===image.naturalHeight)return shape
    const key=JSON.stringify([shape.dataUrl,width,height])
    if(!resized.has(key))resized.set(key,new Promise((resolve,reject)=>{
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
      const context=canvas.getContext('2d')
      if(!context){reject(new Error('Unable to resize equipment images. Please try saving again.'));return}
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high'
      context.drawImage(image,0,0,width,height)
      const type=shape.dataUrl.startsWith('data:image/jpeg;')?'image/jpeg':'image/png'
      canvas.toBlob(blob=>{
        if(!blob){reject(new Error('Unable to resize an equipment image. Please try saving again.'));return}
        const reader=new FileReader()
        reader.onload=()=>resolve(reader.result)
        reader.onerror=()=>reject(new Error('Unable to save a resized equipment image.'))
        reader.readAsDataURL(blob)
      },type,.9)
    }))
    return {...shape,dataUrl:await resized.get(key)}
  }
  const layers=async(entries=[],scale={x:1,y:1})=>{
    const result=[]
    for(const entry of entries){
      if(entry.type==='compound'&&entry.children)result.push({...entry,children:await layers(entry.children,{x:scale.x*entry.width/entry.artworkWidth,y:scale.y*entry.height/entry.artworkHeight})})
      else result.push(entry.type==='image'?await resize(entry,scale):entry)
    }
    return result
  }
  const result={...equipment,shapes:await layers(equipment.shapes)}
  if(equipment.editor){
    result.editor={...equipment.editor}
    if(equipment.editor.layers)result.editor.layers=await layers(equipment.editor.layers)
    if(equipment.editor.referenceImages){
      result.editor.referenceImages=[]
      for(const image of equipment.editor.referenceImages)result.editor.referenceImages.push(await resize(image,{x:1,y:1}))
    }
  }
  return result
}
