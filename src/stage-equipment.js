import { sampleStageBoundary } from './stage-geometry.js';
import { assetSnapshot } from './project-snapshots.js';
import { itemsCollide } from './geometry.js';
import { assetProfiles } from '../tools/library-membership.mjs';

// Store only artwork, geometry and placement data, never library/editor metadata.
export function fixedEquipmentSnapshot(item,id) {
  const keys=['assetId','label','widthMeters','depthMeters','xMeters','yMeters','rotation','shapes','collisionShapes','rotationParts','controls','partVisibility','collisionEnabled','showLabel','customType','heightMm','showHeight','fill','fillOpacity','line','lineOpacity','sublineColor','textColor','text','fontSize','bold','italic'];
  return structuredClone(Object.fromEntries([['id',id],...keys.filter(key=>item[key]!==undefined).map(key=>[key,item[key]])]));
}

export function stageFromLayout(space,items,{id,label,profile='external'}) {
  if(!space||!label.trim())throw new Error('Choose a stage and enter a name.');
  const source=space.assetSnapshot;
  const profiles=(source?assetProfiles(source):[profile]).filter(candidate=>items.every(item=>!item.assetId||assetProfiles(item).includes(candidate)));
  if(!profiles.length)throw new Error('The stage and selected equipment must share a library profile.');
  const nodes=space.boundary?.nodes || [{x:0,y:0},{x:space.width,y:0},{x:space.width,y:space.depth},{x:0,y:space.depth}];
  const existing=source?.fixedEquipment || [];
  return {
    ...(source?assetSnapshot(source):{}),schema:'stageplot-stage@1',id,label:label.trim(),
    profiles,visibility:'draft',personal:true,
    revision:undefined,shareEquipmentIds:[],
    dimensions:{widthMeters:space.width,depthMeters:space.depth},
    boundary:{closed:true,nodes:structuredClone(nodes)},collisionBoundary:sampleStageBoundary(nodes),
    zones:structuredClone((source?.zones || space.zones || []).filter(zone=>space.partVisibility?.[zone.id]!==false)),
    textItems:structuredClone((source?.textItems || space.textItems || []).filter(item=>space.partVisibility?.[item.id]!==false)),
    fixedEquipment:[...existing,...items].map((item,index)=>fixedEquipmentSnapshot(item,`fixed-${index+1}`)),
  };
}

export function validFixedEquipment(items) {
  if(items===undefined)return true;
  if(!Array.isArray(items))return false;
  const ids=new Set();
  return items.every(item=>{
    if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))return false;
    ids.add(item.id);
    return ['xMeters','yMeters','widthMeters','depthMeters'].every(key=>Number.isFinite(item[key]))
      && item.widthMeters>0 && item.depthMeters>0
      && (item.rotation===undefined||Number.isFinite(item.rotation))
      && (item.customType==='staging'||item.customType==='text'||Array.isArray(item.shapes))
      && (item.collisionShapes===undefined||Array.isArray(item.collisionShapes));
  });
}

export function avoidsFixedEquipment(item,fixedEquipment=[]) {
  return fixedEquipment.every(other=>other.visible===false||other.collisionEnabled===false||!itemsCollide(item,other));
}
