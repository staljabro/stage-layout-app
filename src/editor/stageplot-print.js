import {useEffect} from 'react'

// Keep the live canvas for printing, including fonts, images and visible artwork
// beyond the stage boundary. Paper dimensions are supplied by the print dialog.
export function useStageplotPrint(canvasRef,enabled) {
  useEffect(()=>{
    if(!enabled)return
    let original=null
    const restore=()=>{if(original){original.svg.setAttribute('viewBox',original.viewBox);original=null}}
    const prepare=()=>{
      restore()
      const svg=canvasRef.current
      if(!svg)return
      const viewBox=svg.getAttribute('viewBox'),base=svg.viewBox.baseVal,bounds=svg.getBBox()
      const x=Math.min(base.x,bounds.x),y=Math.min(base.y,bounds.y),right=Math.max(base.x+base.width,bounds.x+bounds.width),bottom=Math.max(base.y+base.height,bounds.y+bounds.height)
      const padding=Math.max(right-x,bottom-y)*.015
      original={svg,viewBox}
      svg.setAttribute('viewBox',[x-padding,y-padding,right-x+padding*2,bottom-y+padding*2].join(' '))
    }
    window.addEventListener('beforeprint',prepare)
    window.addEventListener('afterprint',restore)
    return()=>{window.removeEventListener('beforeprint',prepare);window.removeEventListener('afterprint',restore);restore()}
  },[canvasRef,enabled])
}
