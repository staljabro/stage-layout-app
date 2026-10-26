import {sampleStageBoundary} from './stage-geometry.js'

export const statusLabels={awaiting_band:'Awaiting response',in_progress:'In progress',submitted:'Submitted',changed:'Changed since submission',changes_requested:'Changes requested',approved:'Approved'}
export const go=params=>{const url=new URL(window.location.href);url.search='';for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);window.location.assign(url.href)}
export const when=value=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not saved yet'
export const editLink=layout=>{const url=new URL(window.location.href);url.search='';url.searchParams.set('band',layout.guestToken);return url.href}

export function createEmptyStage({label,width,depth}) {
  const nodes=[{x:0,y:0,curveMode:'line'},{x:width,y:0,curveMode:'line'},{x:width,y:depth,curveMode:'line'},{x:0,y:depth,curveMode:'line'}]
  return {schema:'stageplot-stage@1',label,dimensions:{widthMeters:width,depthMeters:depth},boundary:{closed:true,nodes},collisionBoundary:sampleStageBoundary(nodes),zones:[],textItems:[],fixedEquipment:[],availableEquipment:[]}
}
