import { stagePath, stageSegmentPath } from '../../../src/stage-geometry.js';
export function vectorPath(item) {
  if (!item.nodes?.length) return '';
  if (!item.open) return stagePath(item.nodes);
  return `M ${item.nodes[0].x} ${item.nodes[0].y} ${item.nodes.slice(1).map((node,i)=>stageSegmentPath(item.nodes[i],node)).join(' ')}`;
}
const midpoint = (a,b) => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function corner(a,b,c,d) {
  const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),m=midpoint(abc,bcd);
  return {...d,curveMode:'bezier',mx:m.x,my:m.y,startOutX:ab.x,startOutY:ab.y,midInX:abc.x,midInY:abc.y,midOutX:bcd.x,midOutY:bcd.y,endInX:cd.x,endInY:cd.y};
}
export function convertToVector(item) {
  const w=item.width,h=item.height,p=(x,y)=>({x,y,curveMode:'line'});
  let nodes;
  if(item.type==='line') nodes=[p(0,h/2),p(w,h/2)];
  else if(item.type==='triangle') nodes=[p(w/2,0),p(w,h),p(0,h)];
  else if(item.type==='roundRect') {
    const r=Math.min(w,h)*.18,k=.5522847498307936*r;
    nodes=[corner(p(0,r),p(0,r-k),p(r-k,0),p(r,0)),p(w-r,0),corner(p(w-r,0),p(w-r+k,0),p(w,r-k),p(w,r)),p(w,h-r),corner(p(w,h-r),p(w,h-r+k),p(w-r+k,h),p(w-r,h)),p(r,h),corner(p(r,h),p(r-k,h),p(0,h-r+k),p(0,h-r)),p(0,r)];
  } else nodes=[p(0,0),p(w,0),p(w,h),p(0,h)];
  return {...item,type:'vector',nodes,open:item.type==='line',fill:item.type==='line'?'none':item.fill};
}
