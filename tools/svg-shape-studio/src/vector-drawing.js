export function finishDrawnVector(item, closed = false) {
  const minX=Math.min(...item.nodes.map(node=>node.x)),minY=Math.min(...item.nodes.map(node=>node.y));
  const maxX=Math.max(...item.nodes.map(node=>node.x)),maxY=Math.max(...item.nodes.map(node=>node.y));
  const open=!closed || item.nodes.length<3;
  return {...item,x:item.x+minX,y:item.y+minY,width:Math.max(.01,maxX-minX),height:Math.max(.01,maxY-minY),nodes:item.nodes.map(node=>({...node,x:node.x-minX,y:node.y-minY})),open,collision:false,fill:open?'none':item.fill==='none'?'#e9f5bc':item.fill};
}
export function drawingEndpoint(item,pointer,toScreen,radius=12) {
  const near=node=>{const point=toScreen({x:item.x+node.x,y:item.y+node.y});return Math.hypot(point.x-pointer.x,point.y-pointer.y)<=radius;};
  if(item.nodes.length>=3 && near(item.nodes[0]))return 'closed';
  if(near(item.nodes.at(-1)))return 'open';
  if(item.nodes.length===2 && near(item.nodes[0]))return 'open';
  return null;
}
