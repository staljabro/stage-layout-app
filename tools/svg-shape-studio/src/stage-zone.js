import { sampleStageBoundary } from '../../../src/stage-geometry.js';

export const rectangularZoneNodes=(x,y,width,length)=>[
  {x,y,curveMode:'line'},
  {x:x+width,y,curveMode:'line'},
  {x:x+width,y:y+length,curveMode:'line'},
  {x,y:y+length,curveMode:'line'},
];

export const resizeRectangularZone=(zone,width,length)=>{
  if(!Number.isFinite(width)||!Number.isFinite(length)||width<=0||length<=0)return zone;
  const bounds=boundaryBounds(zone.nodes);
  const x=zone.anchorMode==='centre'?bounds.centreX-width/2:bounds.x;
  const y=zone.anchorMode==='centre'?bounds.centreY-length/2:bounds.y;
  return {...zone,nodes:rectangularZoneNodes(x,y,width,length)};
};

const coordinatePairs=[['x','y'],['cx','cy'],['arcX','arcY'],['mx','my'],['startOutX','startOutY'],['midInX','midInY'],['midOutX','midOutY'],['endInX','endInY']];

export const translateBoundaryNodes=(nodes,dx,dy)=>nodes.map(node=>{
  const translated={...node};
  coordinatePairs.forEach(([xKey,yKey])=>{
    if(Number.isFinite(node[xKey]))translated[xKey]=node[xKey]+dx;
    if(Number.isFinite(node[yKey]))translated[yKey]=node[yKey]+dy;
  });
  return translated;
});

export const boundaryBounds=nodes=>{
  const points=sampleStageBoundary(nodes,64),xs=points.map(point=>point.x),ys=points.map(point=>point.y);
  const x=Math.min(...xs),y=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  return {x,y,right,bottom,width:right-x,height:bottom-y,centreX:(x+right)/2,centreY:(y+bottom)/2};
};
