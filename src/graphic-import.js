const RASTER_TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif'])
export const GRAPHIC_ACCEPT='image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml,.svg'
export const isGraphicFile=file=>Boolean(file&&(RASTER_TYPES.has(file.type)||file.type==='image/svg+xml'||/\.svg$/i.test(file.name||'')))
const read=(file,method)=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The graphic could not be read.'));reader[method](file)})
const unsafeUrl=value=>{const text=String(value||'').trim();return text&&text[0]!=='#'&&!/^data:image\/(?:png|jpeg|webp|gif|avif);base64,/i.test(text)}
export function sanitizeSvg(source) {
  if(typeof source!=='string'||source.length>2_000_000)throw new Error('SVG files must be smaller than 2 MB.')
  const document=new DOMParser().parseFromString(source,'image/svg+xml'),root=document.documentElement
  if(root.nodeName.toLowerCase()!=='svg'||document.querySelector('parsererror'))throw new Error('This is not a valid SVG file.')
  document.querySelectorAll('script,foreignObject,iframe,object,embed,audio,video').forEach(node=>node.remove())
  for(const element of document.querySelectorAll('*'))for(const attribute of [...element.attributes]){
    const name=attribute.name.toLowerCase(),value=attribute.value
    if(name.startsWith('on')||name==='style'&&/url\s*\(|@import|expression\s*\(/i.test(value)||(name==='href'||name==='xlink:href')&&unsafeUrl(value))element.removeAttribute(attribute.name)
  }
  root.removeAttribute('xmlns:xlink');root.setAttribute('xmlns','http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(root)
}
const base64=text=>btoa(unescape(encodeURIComponent(text)))
const dimensions=svg=>{const view=(svg.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number),width=parseFloat(svg.getAttribute('width')),height=parseFloat(svg.getAttribute('height'));if(view.length===4&&view.every(Number.isFinite)&&view[2]>0&&view[3]>0)return {width:view[2],height:view[3]};if(width>0&&height>0)return {width,height};throw new Error('The SVG needs a positive viewBox or width and height.')}
const imageSize=dataUrl=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('The graphic could not be decoded.'));image.src=dataUrl})
export async function importGraphic(file,{canvasWidth,canvasHeight,point,id,zOrder=0}={}) {
  if(!isGraphicFile(file))throw new Error('Choose a PNG, JPEG, WebP, GIF, AVIF or SVG graphic.')
  if(file.size>12_000_000)throw new Error('Graphics must be smaller than 12 MB.')
  const svg=file.type==='image/svg+xml'||/\.svg$/i.test(file.name||''),clean=svg?sanitizeSvg(await read(file,'readAsText')):null
  const dataUrl=svg?'data:image/svg+xml;base64,'+base64(clean):await read(file,'readAsDataURL')
  const size=svg?dimensions(new DOMParser().parseFromString(clean,'image/svg+xml').documentElement):await imageSize(dataUrl)
  const scale=Math.min(canvasWidth*.8/size.width,canvasHeight*.8/size.height),width=size.width*scale,height=size.height*scale
  return {id,type:'image',name:file.name||'Graphic',dataUrl,mediaType:svg?'image/svg+xml':file.type,x:point?point.x-width/2:(canvasWidth-width)/2,y:point?point.y-height/2:(canvasHeight-height)/2,width,height,aspectRatio:size.width/size.height,lockAspect:true,rotation:0,opacity:1,crop:{left:0,right:0,top:0,bottom:0},collision:false,editorVisible:true,zOrder}
}
export const hasGraphicFiles=transfer=>[...(transfer?.files||[])].some(isGraphicFile)
