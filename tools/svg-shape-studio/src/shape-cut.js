import polygonClipping from 'polygon-clipping';
import fitCurve from 'fit-curve';
import { sampleStageBoundary } from '../../../src/stage-geometry.js';

const point=(x,y)=>({x,y});
const ellipsePoints=(width,height,count=64)=>Array.from({length:count},(_,index)=>{const angle=index*Math.PI*2/count;return point(width/2+Math.cos(angle)*width/2,height/2+Math.sin(angle)*height/2)});
const roundedRectanglePoints=(width,height)=>{
  const radius=Math.min(width,height)*.18,points=[];
  for(const [cx,cy,start] of [[width-radius,radius,-Math.PI/2],[width-radius,height-radius,0],[radius,height-radius,Math.PI/2],[radius,radius,Math.PI]])for(let index=0;index<=8;index+=1){const angle=start+index*Math.PI/2/8;points.push(point(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius))}
  return points;
};
const regularPolygon=(width,height,sides)=>Array.from({length:Math.max(3,sides)},(_,index)=>{const angle=-Math.PI/2+index*Math.PI*2/Math.max(3,sides);return point(width/2+Math.cos(angle)*width/2,height/2+Math.sin(angle)*height/2)});

export function layerOutline(layer) {
  let local;
  if(layer.type==='rect')local=[point(0,0),point(layer.width,0),point(layer.width,layer.height),point(0,layer.height)];
  else if(layer.type==='roundRect')local=roundedRectanglePoints(layer.width,layer.height);
  else if(layer.type==='circle'||layer.type==='ellipse')local=ellipsePoints(layer.width,layer.height);
  else if(layer.type==='triangle')local=[point(layer.width/2,0),point(layer.width,layer.height),point(0,layer.height)];
  else if(layer.type==='hexagon')local=[point(layer.width*.25,0),point(layer.width*.75,0),point(layer.width,layer.height*.5),point(layer.width*.75,layer.height),point(layer.width*.25,layer.height),point(0,layer.height*.5)];
  else if(layer.type==='polygon')local=regularPolygon(layer.width,layer.height,layer.sides);
  else if(layer.type==='trapezoid')local=[point((layer.leftInset||0)+(layer.slew||0),0),point(layer.width-(layer.rightInset||0)+(layer.slew||0),0),point(layer.width,layer.height),point(0,layer.height)];
  else if(layer.type==='vector'&&!layer.open)local=sampleStageBoundary(layer.nodes,64);
  else throw new Error('Cut supports closed rectangles, rounded rectangles, ellipses, triangles, polygons, trapezoids and vectors.');
  const angle=(layer.rotation||0)*Math.PI/180,cx=layer.width/2,cy=layer.height/2;
  return local.map(value=>{const x=value.x-cx,y=value.y-cy;return [layer.x+cx+x*Math.cos(angle)-y*Math.sin(angle),layer.y+cy+x*Math.sin(angle)+y*Math.cos(angle)]});
}

export function subtractLayers(bottom,cutter) {
  const result=polygonClipping.difference([[layerOutline(bottom)]],[[layerOutline(cutter)]]);
  if(result.some(polygon=>polygon.length>1))throw new Error('This cut would create a hole, which editable Studio vectors do not yet support. Move the cutter so it crosses an outside edge.');
  return result.map(polygon=>polygon[0].slice(0,-1)).filter(ring=>ring.length>=3);
}

const distanceToLine=(pointValue,start,end)=>{
  const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);
  return length<1e-9?Math.hypot(pointValue[0]-start[0],pointValue[1]-start[1]):Math.abs(dy*pointValue[0]-dx*pointValue[1]+end[0]*start[1]-end[1]*start[0])/length;
};
const isStraightCubic=([start,control1,control2,end],tolerance)=>distanceToLine(control1,start,end)<=tolerance&&distanceToLine(control2,start,end)<=tolerance;
const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const splitCubic=([start,control1,control2,end])=>{
  const startOut=midpoint(start,control1),betweenControls=midpoint(control1,control2),endIn=midpoint(control2,end);
  const firstIn=midpoint(startOut,betweenControls),secondOut=midpoint(betweenControls,endIn),centre=midpoint(firstIn,secondOut);
  return [[start,startOut,firstIn,centre],[centre,secondOut,endIn,end]];
};
const cubicLength=curve=>curve.slice(1).reduce((total,value,index)=>total+Math.hypot(value[0]-curve[index][0],value[1]-curve[index][1]),0);
const segmentNode=([start,control1,control2,end],tolerance)=>{
  if(isStraightCubic([start,control1,control2,end],tolerance))return {x:end[0],y:end[1],curveMode:'line'};
  // Studio stores a curved edge as two cubics meeting at its editable midpoint.
  // De Casteljau splitting maps a conventional cubic into that representation exactly.
  const startOut=midpoint(start,control1),betweenControls=midpoint(control1,control2),endIn=midpoint(control2,end);
  const midIn=midpoint(startOut,betweenControls),midOut=midpoint(betweenControls,endIn),arcMid=midpoint(midIn,midOut);
  return {x:end[0],y:end[1],curveMode:'bezier',mx:arcMid[0],my:arcMid[1],startOutX:startOut[0],startOutY:startOut[1],midInX:midIn[0],midInY:midIn[1],midOutX:midOut[0],midOutY:midOut[1],endInX:endIn[0],endInY:endIn[1]};
};
const turnScore=(previous,current,next)=>{
  const ax=previous[0]-current[0],ay=previous[1]-current[1],bx=next[0]-current[0],by=next[1]-current[1],lengthA=Math.hypot(ax,ay),lengthB=Math.hypot(bx,by);
  return lengthA&&lengthB?1+(ax*bx+ay*by)/(lengthA*lengthB):0;
};
const rotateToStrongestCorner=ring=>{
  let corner=0,score=-1;
  ring.forEach((value,index)=>{const candidate=turnScore(ring[(index+ring.length-1)%ring.length],value,ring[(index+1)%ring.length]);if(candidate>score){score=candidate;corner=index}});
  return [...ring.slice(corner),...ring.slice(0,corner)];
};

export function fitCutRing(ring,error){
  const boundsX=ring.map(([x])=>x),boundsY=ring.map(([,y])=>y),span=Math.max(Math.max(...boundsX)-Math.min(...boundsX),Math.max(...boundsY)-Math.min(...boundsY));
  const fitError=error??Math.max(.0005,span*.001),straightTolerance=fitError*.2;
  const corners=ring.map((value,index)=>({index,score:turnScore(ring[(index+ring.length-1)%ring.length],value,ring[(index+1)%ring.length])})).filter(value=>value.score>.04).map(value=>value.index);
  let curves;
  if(corners.length>=2){
    curves=corners.flatMap((startIndex,cornerIndex)=>{
      const endIndex=corners[(cornerIndex+1)%corners.length],run=[ring[startIndex]];
      for(let index=(startIndex+1)%ring.length;index!==endIndex;index=(index+1)%ring.length)run.push(ring[index]);
      run.push(ring[endIndex]);
      return fitCurve(run,fitError*fitError);
    });
  }else{
    const ordered=rotateToStrongestCorner(ring);
    curves=fitCurve([...ordered,ordered[0]],fitError*fitError);
  }
  // A closed Studio vector needs at least three nodes. Simple circular results can
  // legitimately fit into two cubics, so split the longest curve without altering it.
  while(curves.length>0&&curves.length<3){
    const index=curves.reduce((longest,curve,candidate)=>cubicLength(curve)>cubicLength(curves[longest])?candidate:longest,0);
    curves.splice(index,1,...splitCubic(curves[index]));
  }
  if(!curves.length)return ring.map(([x,y])=>({x,y,curveMode:'line'}));
  const nodes=[{x:curves[0][0][0],y:curves[0][0][1],curveMode:'line'}];
  curves.forEach((curve,index)=>{
    const node=segmentNode(curve,straightTolerance);
    if(index===curves.length-1)Object.assign(nodes[0],node);
    else nodes.push(node);
  });
  return nodes;
}

export function vectorFromCutRing(bottom,ring,id) {
  const xs=ring.map(([x])=>x),ys=ring.map(([,y])=>y),x=Math.min(...xs),y=Math.min(...ys);
  const nodes=fitCutRing(ring).map(node=>Object.fromEntries(Object.entries(node).map(([key,value])=>[key,typeof value==='number'&&(key==='x'||key==='mx'||key.endsWith('X'))?value-x:typeof value==='number'&&(key==='y'||key==='my'||key.endsWith('Y'))?value-y:value])));
  return {...bottom,id,type:'vector',name:`${bottom.name||'Layer'} cut`,x,y,width:Math.max(.01,Math.max(...xs)-x),height:Math.max(.01,Math.max(...ys)-y),rotation:0,open:false,nodes,editorGroupId:undefined,editorGroupName:undefined};
}
