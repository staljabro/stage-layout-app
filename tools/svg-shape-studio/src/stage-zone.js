import { sampleStageBoundary } from '../../../src/stage-geometry.js';

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
