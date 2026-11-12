import {sanitizeSvg} from './graphic-import.js'
const number=(value,fallback=0)=>Number.isFinite(parseFloat(value))?parseFloat(value):fallback
const colour=(element,name,fallback)=>{const value=getComputedStyle(element)[name]||element.getAttribute(name);return !value||value==='none'?name==='fill'?'none':fallback:value}
const point=(matrix,x,y,scale)=>{const result=new DOMPoint(x,y).matrixTransform(matrix);return {x:result.x/scale,y:result.y/scale,curveMode:'line'}}
export async function svgEquipmentFromFile(file,{pixelsPerMetre=100}={}) {
  if(!file||(!/\.svg$/i.test(file.name||'')&&file.type!=='image/svg+xml'))throw new Error('Choose an SVG file.')
  if(file.size>2_000_000)throw new Error('SVG files must be smaller than 2 MB.')
  const source=await file.text(),clean=sanitizeSvg(source),parsed=new DOMParser().parseFromString(clean,'image/svg+xml'),sourceRoot=parsed.documentElement
  const view=(sourceRoot.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number),rawWidth=number(sourceRoot.getAttribute('width')),rawHeight=number(sourceRoot.getAttribute('height'))
  const width=view.length===4&&view.every(Number.isFinite)?view[2]:rawWidth,height=view.length===4&&view.every(Number.isFinite)?view[3]:rawHeight
  if(!(width>0&&height>0))throw new Error('The SVG needs a positive viewBox or width and height.')
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-100000px;top:0;width:1px;height:1px;visibility:hidden';host.innerHTML=clean;document.body.append(host)
  try{
    const root=host.querySelector('svg');root.setAttribute('width',String(width));root.setAttribute('height',String(height))
    const elements=[...root.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')],layers=[]
    for(const [index,element] of elements.entries()){
      const matrix=element.getCTM()||new DOMMatrix(),tag=element.tagName.toLowerCase();let nodes=[],open=['line','polyline'].includes(tag)
      if(tag==='rect'){const x=number(element.getAttribute('x')),y=number(element.getAttribute('y')),w=number(element.getAttribute('width')),h=number(element.getAttribute('height'));nodes=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>point(matrix,a,b,pixelsPerMetre))}
      else if(tag==='circle'||tag==='ellipse'){const cx=number(element.getAttribute('cx')),cy=number(element.getAttribute('cy')),rx=tag==='circle'?number(element.getAttribute('r')):number(element.getAttribute('rx')),ry=tag==='circle'?rx:number(element.getAttribute('ry'));nodes=Array.from({length:48},(_,i)=>point(matrix,cx+Math.cos(i*Math.PI*2/48)*rx,cy+Math.sin(i*Math.PI*2/48)*ry,pixelsPerMetre))}
      else if(tag==='line')nodes=[point(matrix,number(element.getAttribute('x1')),number(element.getAttribute('y1')),pixelsPerMetre),point(matrix,number(element.getAttribute('x2')),number(element.getAttribute('y2')),pixelsPerMetre)]
      else if(tag==='polyline'||tag==='polygon'){open=tag==='polyline';nodes=(element.getAttribute('points')||'').trim().split(/\s+/).map(pair=>pair.split(',').map(Number)).filter(pair=>pair.length===2&&pair.every(Number.isFinite)).map(([x,y])=>point(matrix,x,y,pixelsPerMetre))}
      else {const length=element.getTotalLength();if(!(length>0))continue;const count=Math.max(2,Math.min(240,Math.ceil(length/4)));nodes=Array.from({length:count},(_,i)=>{const p=element.getPointAtLength(length*i/(open?count-1:count));return point(matrix,p.x,p.y,pixelsPerMetre)});open=!/[zZ]\s*$/.test(element.getAttribute('d')||'')}
      if(nodes.length<2)continue
      const x=Math.min(...nodes.map(node=>node.x)),y=Math.min(...nodes.map(node=>node.y)),layerWidth=Math.max(...nodes.map(node=>node.x))-x,layerHeight=Math.max(...nodes.map(node=>node.y))-y
      nodes=nodes.map(node=>({...node,x:node.x-x,y:node.y-y}))
      layers.push({id:'svg-'+index,name:element.id||`${tag} ${index+1}`,type:'vector',x,y,width:Math.max(.001,layerWidth),height:Math.max(.001,layerHeight),nodes,open,fill:open?'none':colour(element,'fill','#25261f'),stroke:colour(element,'stroke','none'),strokeWidth:number(getComputedStyle(element).strokeWidth||element.getAttribute('stroke-width'))/pixelsPerMetre,opacity:number(getComputedStyle(element).opacity,1),collision:false,editorVisible:true})
    }
    if(!layers.length)throw new Error('The SVG does not contain supported vector artwork.')
    const label=(file.name||'SVG equipment').replace(/\.svg$/i,'')
    return {schema:'stageplot-item@3',label,dimensions:{widthMeters:width/pixelsPerMetre,depthMeters:height/pixelsPerMetre},shapes:layers,collisionShapes:[],editor:{layers}}
  }finally{host.remove()}
}
