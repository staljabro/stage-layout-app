import {stagePath,sampleStageBoundary} from '../stage-geometry.js'
import {CurtainArtwork} from '../stage-curtain.jsx'
import {stageLineBounds} from '../stage-curtain.js'
import {applyStagePartVisibility} from '../stage-part-visibility.js'
import {EquipmentArtwork} from '../equipment-artwork.jsx'
import {resolveProject} from '../project-file.js'
import {equipmentVisible,stageAssetVisible} from '../layer-visibility.js'
export function StageThumbnail({stage:sourceStage,layout}) {
  if(!sourceStage)return null
  const stage=layout?applyStagePartVisibility(sourceStage,layout.stage?.partVisibility):sourceStage
  const equipment=layout?resolveProject({...layout,assetSnapshots:{...layout.assetSnapshots,stage}},layout.assetSnapshots?.equipment||[],[stage]).items:[]
  const placements=[...(stage.fixedEquipment||[]),...equipment].filter(equipmentVisible),boundary=sampleStageBoundary(stage.boundary.nodes)
  const xs=[0,stage.dimensions.widthMeters,...boundary.map(point=>point.x),...placements.flatMap(item=>[item.xMeters-item.widthMeters,item.xMeters+item.widthMeters])],ys=[0,stage.dimensions.depthMeters,...boundary.map(point=>point.y),...placements.flatMap(item=>[item.yMeters-item.depthMeters,item.yMeters+item.depthMeters])]
  for(const curtain of stage.curtains||[]){const bounds=stageLineBounds(curtain);xs.push(bounds.x,bounds.right);ys.push(bounds.y,bounds.bottom)}
  const x=Math.min(...xs)-.3,y=Math.min(...ys)-.3,width=Math.max(...xs)-x+.3,height=Math.max(...ys)-y+.3
  return <svg className="stage-thumbnail" viewBox={[x,y,width,height].join(' ')} role="img" aria-label={layout?'Equipment layout preview':'Stage outline preview'}><path d={stagePath(stage.boundary.nodes)} fill={stage.boundary.visible===false?'none':'#e3ebd7'} stroke={stage.boundary.visible===false?'none':'#85996c'} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>{(stage.zones||[]).filter(zone=>stageAssetVisible(zone,stage.layerFolders)).map(zone=><path key={zone.id} d={stagePath(zone.nodes)} fill={zone.fill||'#cad8dd'} fillOpacity={zone.fillOpacity??1} stroke={zone.stroke||'#74826b'} strokeWidth="1" vectorEffect="non-scaling-stroke"/>)}{(stage.textItems||[]).filter(item=>stageAssetVisible(item,stage.layerFolders)).map(item=><text key={item.id} x={item.x} y={item.y} fontSize={item.fontSize} fill={item.color} textAnchor="middle">{item.text}</text>)}{(stage.curtains||[]).filter(line=>stageAssetVisible(line,stage.layerFolders)).map(line=><CurtainArtwork key={line.id} curtain={line}/>)}{placements.map((item,index)=><g key={index} transform={'translate('+item.xMeters+' '+item.yMeters+') rotate('+(item.rotation||0)+')'}><svg x={-item.widthMeters/2} y={-item.depthMeters/2} width={item.widthMeters} height={item.depthMeters} overflow="visible"><EquipmentArtwork item={item}/></svg>{item.showLabel&&<text textAnchor="middle" y={(item.labelOffset??1)*(item.depthMeters/2+.2)} fontSize=".15">{item.label}</text>}</g>)}</svg>
}
