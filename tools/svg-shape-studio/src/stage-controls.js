import { segmentMode, pointOnArc, smoothControl, bezierGeometry } from '../../../src/stage-geometry.js';
export function stageControlPoints(nodes,index) {
  const node=nodes[index];
  if(!node)return [];
  const previous=nodes[(index-1+nodes.length)%nodes.length];
  const mode=segmentMode(node);
  if(mode==='pointArc')return [['pointArc',pointOnArc(previous,node)]];
  if(mode==='smooth')return [['smooth',smoothControl(previous,node)]];
  if(mode==='bezier')return Object.entries(bezierGeometry(previous,node));
  return [];
}
export function nearestControl(points,pointer,toScreen,radius=12) {
  return points.map(([kind,point])=>{
    const screen=toScreen(point);
    return {kind,distance:Math.hypot(screen.x-pointer.x,screen.y-pointer.y)};
  }).filter(control=>control.distance<=radius).sort((a,b)=>a.distance-b.distance)[0]?.kind;
}
