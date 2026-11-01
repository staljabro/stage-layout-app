import {imageBounds,normaliseCrop,validImageDataUrl} from './image-layer.js'
export function ImageLayerArtwork({shape}) {
  const crop=normaliseCrop(shape.crop),bounds=imageBounds(shape),viewWidth=1-crop.left-crop.right,viewHeight=1-crop.top-crop.bottom
  if(!validImageDataUrl(shape.dataUrl))return null
  return <svg x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} style={{width:bounds.width,height:bounds.height,overflow:'hidden'}} viewBox={`${crop.left} ${crop.top} ${viewWidth} ${viewHeight}`} preserveAspectRatio="none" overflow="hidden" opacity={shape.opacity??1} pointerEvents="none"><image href={shape.dataUrl} width="1" height="1" preserveAspectRatio="none"/></svg>
}
