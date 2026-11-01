import {validImageDataUrl} from './image-layer.js'

export const validOrganisationLogo=value=>validImageDataUrl(value)&&value.length<=2_000_000

export async function prepareOrganisationLogo(file) {
  if(file.size>12_000_000)throw new Error('Choose an image smaller than 12 MB.')
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Unable to read this image.'));reader.readAsDataURL(file)})
  if(!validImageDataUrl(dataUrl))throw new Error('Choose a PNG, JPEG, WebP, GIF or AVIF image.')
  const image=new Image();image.src=dataUrl;await image.decode()
  const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
  const context=canvas.getContext('2d');if(!context)throw new Error('Unable to prepare this logo.')
  context.imageSmoothingQuality='high';context.drawImage(image,0,0,canvas.width,canvas.height)
  const result=canvas.toDataURL('image/png')
  if(!validOrganisationLogo(result))throw new Error('This image is too large to use as a logo.')
  return result
}
