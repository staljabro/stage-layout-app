import { useEffect, useRef, useState } from 'react'
import { sampleStageBoundary, stagePath as zonePath } from './stage-geometry.js'
import { TextArtwork } from './text-shape.jsx'
import { readSessionDraft, useSessionDraft } from './session-draft.js'
import { selectionBox, enclosedItems } from './marquee.js'
import { belongsToStagingGroup, insertAtDefaultLayer } from './layer-order.js'
import { folderForItem, layerRows, moveFolderBlock, putItemsInFolder } from './layer-folders.js'
import { rotatedBounds } from '../tools/svg-shape-studio/src/rotation.js'
import { isPublishedItem, isEquipmentItem } from '../tools/library-membership.mjs'
import { collisionPolygons, isItemInsideSpace, itemsCollide, nearestSnapOffset, polygonsIntersect, rectangleBoundary } from './geometry.js'
import { projectFile, resolveProject, stageSpace } from './project-file.js'
import { StageplotHelp } from './help-dialog.jsx'
import { APP_VERSION } from './version.js'
import { AppMark } from './app-mark.jsx'
import { customStagingItem, customTextItem } from './custom-items.js'
import { sizeText } from './text-layout.js'

const API_BASE = (import.meta.env.VITE_LIBRARY_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8787/api' : '/api')).replace(/\/$/, '')
const LIBRARY_API = `${API_BASE}/items`
const GROUPS_API = `${API_BASE}/groups`
const STAGES_API = `${API_BASE}/stages`

const boundaryForSpace = (space) => space.collisionBoundary?.length >= 3 ? space.collisionBoundary : rectangleBoundary(space.width, space.depth)
const stageClipPath = (space) => `polygon(${boundaryForSpace(space).map((point) => `${point.x / space.width * 100}% ${point.y / space.depth * 100}%`).join(',')})`
const zonePatternId = (prefix, id) => `${prefix}-${String(id).replace(/[^a-zA-Z0-9_-]/g,'-')}`
function ZonePatterns({ zones, prefix }) {
  return <defs>{zones.filter(zone=>zone.fillMode==='multicolour').map(zone=>{const spacing=Math.max(.05,zone.stripeSpacing||.5);return <pattern key={zone.id} id={zonePatternId(prefix,zone.id)} width={spacing*2} height={spacing*2} patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><rect width={spacing} height={spacing*2} fill={zone.fill||'#8eb6d8'} stroke="none"/><rect x={spacing} width={spacing} height={spacing*2} fill={zone.fill2||'#25261f'} stroke="none"/></pattern>})}</defs>
}
const zoneFill = (zone,prefix) => zone.fillMode==='multicolour' ? `url(#${zonePatternId(prefix,zone.id)})` : zone.fill
const itemAvoidsSolidZones = (item, zones = [], partVisibility = {}) => {
  const footprints = collisionPolygons(item)
  return zones.filter((zone) => zone.solid && zone.collisionBoundary?.length >= 3 && (!zone.toggleable || partVisibility[zone.id] !== false)).every((zone) => footprints.every(footprint => !polygonsIntersect(footprint, zone.collisionBoundary)))
}

const regularPolygonPoints = (width, height, sides = 6) => Array.from({ length: Math.max(3, sides) }, (_, index) => {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(3, sides)
  return `${width / 2 + Math.cos(angle) * width / 2},${height / 2 + Math.sin(angle) * height / 2}`
}).join(' ')

const hexagonSvgPoints = (width, height) => `${width * .25},0 ${width * .75},0 ${width},${height * .5} ${width * .75},${height} ${width * .25},${height} 0,${height * .5}`

const tripodVectorGeometry = (shape) => {
  const radius = shape.legRadius ?? shape.width / Math.sqrt(3)
  const hub = { x: Math.sqrt(3) / 2 * radius, y: radius }
  return { hub, ends: [{ x: hub.x, y: 0 }, { x: Math.sqrt(3) * radius, y: radius * 1.5 }, { x: 0, y: radius * 1.5 }] }
}

const trapezoidSvgPoints = (shape) => {
  const left = (shape.leftInset || 0) + (shape.slew || 0)
  const right = shape.width - (shape.rightInset || 0) + (shape.slew || 0)
  return `${left},0 ${right},0 ${shape.width},${shape.height} 0,${shape.height}`
}

function PersonVector({ shape, seated, style }) {
  const w = shape.width
  const h = shape.height
  const body = { ...style, fill: '#ffffff', fillOpacity: 1, strokeLinejoin: 'round' }
  const head = { ...style, fill: shape.stroke, stroke: shape.stroke, fillOpacity: 1 }
  const detail = { fill: 'none', stroke: shape.stroke, strokeWidth: Math.max(1, shape.strokeWidth * .7), vectorEffect: 'non-scaling-stroke', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (seated) return <>
    <path d={`M ${w * .31} ${h * .25} C ${w * .24} ${h * .26},${w * .2} ${h * .32},${w * .22} ${h * .4} L ${w * .31} ${h * .6} Q ${w * .5} ${h * .68},${w * .69} ${h * .6} L ${w * .78} ${h * .4} C ${w * .8} ${h * .32},${w * .76} ${h * .26},${w * .69} ${h * .25} L ${w * .58} ${h * .22} L ${w * .42} ${h * .22} Z`} {...body} />
    <path d={`M ${w * .31} ${h * .29} L ${w * .2} ${h * .35} L ${w * .16} ${h * .65} L ${w * .25} ${h * .67} L ${w * .29} ${h * .43} L ${w * .38} ${h * .38} Z M ${w * .69} ${h * .29} L ${w * .8} ${h * .35} L ${w * .84} ${h * .65} L ${w * .75} ${h * .67} L ${w * .71} ${h * .43} L ${w * .62} ${h * .38} Z`} {...body} />
    <path d={`M ${w * .37} ${h * .58} L ${w * .2} ${h * .78} L ${w * .27} ${h * .84} L ${w * .47} ${h * .66} Z M ${w * .63} ${h * .58} L ${w * .8} ${h * .78} L ${w * .73} ${h * .84} L ${w * .53} ${h * .66} Z`} {...body} />
    <path d={`M ${w * .2} ${h * .78} L ${w * .19} ${h * .96} L ${w * .3} ${h * .96} L ${w * .32} ${h * .81} Z M ${w * .8} ${h * .78} L ${w * .81} ${h * .96} L ${w * .7} ${h * .96} L ${w * .68} ${h * .81} Z`} {...body} />
    <ellipse cx={w * .5} cy={h * .18} rx={w * .16} ry={h * .18} {...head} /><path d={`M ${w * .39} ${h * .31} Q ${w * .5} ${h * .37},${w * .61} ${h * .31} M ${w * .34} ${h * .57} Q ${w * .5} ${h * .62},${w * .66} ${h * .57}`} {...detail} />
  </>
  return <>
    <path d={`M ${w * .3} ${h * .25} C ${w * .24} ${h * .27},${w * .22} ${h * .34},${w * .25} ${h * .43} L ${w * .35} ${h * .67} L ${w * .65} ${h * .67} L ${w * .75} ${h * .43} C ${w * .78} ${h * .34},${w * .76} ${h * .27},${w * .7} ${h * .25} L ${w * .58} ${h * .22} L ${w * .42} ${h * .22} Z`} {...body} />
    <path d={`M ${w * .31} ${h * .29} L ${w * .2} ${h * .35} L ${w * .17} ${h * .75} L ${w * .26} ${h * .75} L ${w * .29} ${h * .43} L ${w * .38} ${h * .38} Z M ${w * .69} ${h * .29} L ${w * .8} ${h * .35} L ${w * .83} ${h * .75} L ${w * .74} ${h * .75} L ${w * .71} ${h * .43} L ${w * .62} ${h * .38} Z`} {...body} />
    <path d={`M ${w * .38} ${h * .64} L ${w * .49} ${h * .66} L ${w * .47} ${h * .96} L ${w * .36} ${h * .96} Z M ${w * .51} ${h * .66} L ${w * .62} ${h * .64} L ${w * .64} ${h * .96} L ${w * .53} ${h * .96} Z`} {...body} />
    <ellipse cx={w * .5} cy={h * .18} rx={w * .16} ry={h * .19} {...head} /><path d={`M ${w * .39} ${h * .31} Q ${w * .5} ${h * .38},${w * .61} ${h * .31} M ${w * .4} ${h * .63} L ${w * .6} ${h * .63}`} {...detail} />
  </>
}

function VectorShape({ shape }) {
  const style = { fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth, vectorEffect: 'non-scaling-stroke' }
  const pivot = shape.type === 'tripod' ? tripodVectorGeometry(shape).hub : { x: shape.width / 2, y: shape.height / 2 }
  const transform = `translate(${shape.x} ${shape.y}) rotate(${shape.rotation || 0} ${pivot.x} ${pivot.y})`
  let node
  if (shape.type === 'compound') node = <g transform={`scale(${shape.width / shape.artworkWidth} ${shape.height / shape.artworkHeight})`}>{shape.children.map((child,index)=><VectorShape key={index} shape={child}/>)}</g>
  else if (shape.type === 'text') node = <TextArtwork item={shape} />
  else if (shape.type === 'path') node = <path d={shape.d} {...style} />
  else if (shape.type === 'circle' || shape.type === 'ellipse') node = <ellipse cx={shape.width / 2} cy={shape.height / 2} rx={shape.width / 2} ry={shape.height / 2} {...style} />
  else if (shape.type === 'triangle') node = <polygon points={`${shape.width / 2},0 ${shape.width},${shape.height} 0,${shape.height}`} {...style} />
  else if (shape.type === 'line') node = <line x1="0" y1={shape.height / 2} x2={shape.width} y2={shape.height / 2} {...style} />
  else if (shape.type === 'arc') node = <path d={`M ${shape.startX} ${shape.startY} Q ${shape.controlX} ${shape.controlY} ${shape.endX} ${shape.endY}`} {...style} fill="none" />
  else if (shape.type === 'tripod') { const tripod = tripodVectorGeometry(shape); node = <path d={`M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[0].x} ${tripod.ends[0].y} M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[1].x} ${tripod.ends[1].y} M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[2].x} ${tripod.ends[2].y}`} {...style} fill="none" /> }
  else if (shape.type === 'hexagon' || shape.type === 'polygon') node = <polygon points={shape.type === 'hexagon' ? hexagonSvgPoints(shape.width, shape.height) : regularPolygonPoints(shape.width, shape.height, shape.sides)} {...style} />
  else if (shape.type === 'trapezoid') node = <polygon points={trapezoidSvgPoints(shape)} {...style} />
  else if (shape.type === 'chair') node = <><rect x={shape.width * .12} y={shape.height * .2} width={shape.width * .76} height={shape.height * .68} rx={shape.width * .06} {...style} /><rect x={shape.width * .08} y="0" width={shape.width * .84} height={shape.height * .24} rx={shape.width * .08} {...style} /><path d={`M ${shape.width * .15} ${shape.height * .87} V ${shape.height} M ${shape.width * .85} ${shape.height * .87} V ${shape.height}`} {...style} fill="none" /></>
  else if (shape.type === 'seatedPerson') node = <PersonVector shape={shape} seated style={style} />
  else if (shape.type === 'standingPerson') node = <PersonVector shape={shape} style={style} />
  else node = <rect width={shape.width} height={shape.height} rx={shape.type === 'roundRect' ? Math.min(shape.width, shape.height) * .18 : 0} {...style} />
  return <g transform={transform}>{node}</g>
}

function VectorArtwork({ shapes, width, depth, rotationParts = [], controls = {}, partVisibility = {} }) {
  const parts = new Map(rotationParts.map(part=>[part.id,part]))
  return <svg viewBox={`0 0 ${width} ${depth}`} aria-hidden="true">{(shapes || []).map((shape) => {if(shape.toggleable&&partVisibility[shape.id]===false)return null;const part=parts.get(shape.rotationPartId);const angle=part ? controls[part.id]?.rotation ?? part.defaultRotation ?? 0 : 0;return <g key={shape.id} transform={part?`rotate(${angle} ${part.pivotX} ${part.pivotY})`:undefined}><VectorShape shape={shape} /></g>})}</svg>
}

const Icon = ({ name }) => {
  const paths = {
    save: <><path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
    print: <><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><path d="M6 15h12v6H6z"/></>,
    undo: <><path d="M9 7 4 12l5 5"/><path d="M4 12h9a7 7 0 0 1 7 7"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    eye: <path className="mdi-fill" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5m0 13c-3.88 0-7.17-2.34-8.82-5.5C4.83 8.84 8.12 6.5 12 6.5s7.17 2.34 8.82 5.5c-1.65 3.16-4.94 5.5-8.82 5.5m0-8.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>,
    eyeOff: <path className="mdi-fill" d="M2 5.27 3.28 4 20 20.72 18.73 22l-3.08-3.08c-1.15.38-2.39.58-3.65.58-5 0-9.27-3.11-11-7.5.69-1.76 1.79-3.31 3.19-4.54L2 5.27M12 4.5c5 0 9.27 3.11 11 7.5-.82 2.08-2.21 3.88-4 5.19l-1.42-1.43c1.36-.94 2.42-2.26 3.24-3.76C19.17 8.84 15.88 6.5 12 6.5c-1.09 0-2.13.18-3.1.5L7.35 5.44A12 12 0 0 1 12 4.5M3.18 12C4.83 15.16 8.12 17.5 12 17.5c.69 0 1.36-.08 2-.23L11.72 15A3 3 0 0 1 9 12.28l-3.4-3.41A9.5 9.5 0 0 0 3.18 12M12 9a3 3 0 0 1 3 3c0 .35-.06.69-.17 1L11 9.17c.31-.11.65-.17 1-.17"/>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function CustomItemArtwork({ item }) {
  if (item.customType === 'staging') return <svg viewBox={`0 0 ${item.widthMeters} ${item.depthMeters}`} aria-hidden="true">
    <rect width={item.widthMeters} height={item.depthMeters} fill={item.fill} fillOpacity={item.fillOpacity} stroke="none" />
    {Array.from({length:Math.max(0,item.widthMeters-1)},(_,index)=><line key={`x-${index}`} x1={index+1} y1="0" x2={index+1} y2={item.depthMeters} stroke={item.sublineColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    {Array.from({length:Math.max(0,item.depthMeters-1)},(_,index)=><line key={`y-${index}`} x1="0" y1={index+1} x2={item.widthMeters} y2={index+1} stroke={item.sublineColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    <rect width={item.widthMeters} height={item.depthMeters} fill="none" stroke={item.line} strokeOpacity={item.lineOpacity} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    {item.showHeight !== false && <text x={item.widthMeters / 2} y={item.depthMeters / 2} fill={item.textColor} stroke="none" fontSize={Math.min(.28, item.depthMeters * .32)} fontWeight="700" textAnchor="middle" dominantBaseline="middle">{item.heightMm}mm</text>}
  </svg>
  if (item.customType === 'text') return <svg viewBox={`0 0 ${item.widthMeters} ${item.depthMeters}`} aria-hidden="true"><TextArtwork item={{ ...item, width: item.widthMeters, height: item.depthMeters }} /></svg>
  return null
}

function TriStateToggle({ value, label, description, onChange }) {
  const mixed=value==='mixed'
  return <button type="button" className="tri-state-option" role="checkbox" aria-checked={mixed?'mixed':value} onClick={()=>onChange(value!==true)}><span className={`tri-state-box ${mixed?'mixed':value?'checked':''}`}>{mixed?'×':value?'✓':''}</span><span><b>{label}</b>{description&&<small>{description}</small>}</span></button>
}

function App() {
  const [lockedStageId] = useState(()=>new URLSearchParams(window.location.search).get('stage'))
  const draftKey=lockedStageId===null?'stageplot:draft':`stageplot:draft:stage:${lockedStageId}`
  const [session] = useState(() => readSessionDraft(draftKey))
  const [project, setProject] = useState(session.project ?? 'Untitled stageplot')
  const [space, setSpace] = useState(lockedStageId!==null && session.space?.stageId!==lockedStageId ? null : session.space ?? null)
  const [preset, setPreset] = useState(session.preset ?? '')
  const [stagePickerOpen, setStagePickerOpen] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [customWidth,setCustomWidth]=useState(10)
  const [customDepth,setCustomDepth]=useState(5)
  const [items, setItems] = useState(session.items ?? [])
  const [layerFolders,setLayerFolders]=useState(session.layerFolders ?? [])
  const [editingFolderId,setEditingFolderId]=useState(null)
  const [folderNameDraft,setFolderNameDraft]=useState('')
  const [equipmentCollisionEnabled, setEquipmentCollisionEnabled] = useState(session.equipmentCollisionEnabled !== false)
  const [zoneCollisionEnabled, setZoneCollisionEnabled] = useState(session.zoneCollisionEnabled !== false)
  const [snappingEnabled, setSnappingEnabled] = useState(session.snappingEnabled !== false)
  const [selected, setSelected] = useState(null)
  const [multiSelected, setMultiSelected] = useState([])
  const [marquee, setMarquee] = useState(null)
  const [equipmentDrawerOpen, setEquipmentDrawerOpen] = useState(true)
  const [history, setHistory] = useState([])
  const [notice, setNotice] = useState('')
  const [helpOpen,setHelpOpen]=useState(false)
  const [printTimestamp,setPrintTimestamp]=useState(()=>new Date().toLocaleString())
  const [library, setLibrary] = useState([])
  const [groups, setGroups] = useState([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [selectedEquipmentTab, setSelectedEquipmentTab] = useState('all')
  const [customToolMode, setCustomToolMode] = useState(null)
  const [customStagingPreview, setCustomStagingPreview] = useState(null)
  const [stages, setStages] = useState([])
  const equipmentTabs = [
    { id: 'all', label: 'All equipment' },
    ...groups.filter(group => library.some(tool => tool.groupId === group.id)).map(group => ({ id: 'group:' + group.id, label: group.label })),
    ...(library.some(tool => !groups.some(group => group.id === tool.groupId)) ? [{ id: 'uncategorised', label: 'Uncategorised' }] : []),
    { id: 'custom', label: 'Custom' },
  ]
  const activeEquipmentTab = equipmentTabs.some(tab => tab.id === selectedEquipmentTab) ? selectedEquipmentTab : 'all'
  const visibleEquipment = library.filter(tool => {
    const tabId = groups.some(group => group.id === tool.groupId) ? 'group:' + tool.groupId : 'uncategorised'
    return activeEquipmentTab !== 'custom' && (activeEquipmentTab === 'all' || activeEquipmentTab === tabId) && tool.label.toLowerCase().includes(equipmentSearch.trim().toLowerCase())
  }).sort((a,b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))

  const [libraryOnline, setLibraryOnline] = useState(true)
  const [zoom, setZoom] = useState(session.zoom ?? 1)
  const [pan, setPan] = useState(session.pan ?? { x: 56, y: 56 })
  const boardRef = useRef(null)
  const viewportRef = useRef(null)
  const fileRef = useRef(null)
  const dragRef = useRef(null)
  const layerDragRef = useRef(null)
  const nextFolderIdRef=useRef(1)
  const rotateRef = useRef(null)
  const panRef = useRef(null)
  const marqueeRef = useRef(null)
  const customDrawRef = useRef(null)
  const clipboardRef = useRef(null)
  const bootedRef = useRef(false)
  const nextIdRef = useRef(Math.max(100, ...(session.items || []).map(item=>(Number(item.id)||0)+1)))
  const selectedItem = items.find((item) => item.id === selected)
  const sessionError = useSessionDraft(draftKey, {project,space,preset,items,layerFolders,zoom,pan,equipmentCollisionEnabled,zoneCollisionEnabled,snappingEnabled})

  const printLayout=(()=>{
    if(!space)return {scale:1,x:0,y:0}
    const points=[{x:0,y:0},{x:space.width,y:space.depth}]
    for(const item of items.filter(item=>item.visible!==false&&folderForItem(layerFolders,item.id)?.visible!==false)){
      const bounds=rotatedBounds([{x:item.xMeters-item.widthMeters/2,y:item.yMeters-item.depthMeters/2,width:item.widthMeters,height:item.depthMeters,rotation:item.rotation||0}])
      if(bounds)points.push({x:bounds.x,y:bounds.y},{x:bounds.right,y:bounds.bottom})
    }
    for(const zone of space.zones||[])for(const point of zone.nodes?.length?sampleStageBoundary(zone.nodes):[])points.push({x:point.x,y:point.y})
    for(const textItem of space.textItems||[])points.push({x:textItem.x,y:textItem.y})
    const minX=Math.min(...points.map(point=>point.x)),minY=Math.min(...points.map(point=>point.y)),maxX=Math.max(...points.map(point=>point.x)),maxY=Math.max(...points.map(point=>point.y))
    const width=Math.max(.01,maxX-minX)*100,height=Math.max(.01,maxY-minY)*100
    const scale=Math.min(1470/width,912/height)
    return {scale,x:(1512-width*scale)/2-minX*100*scale,y:(945-height*scale)/2-minY*100*scale}
  })()

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2200)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [itemsResponse, groupsResponse, stagesResponse] = await Promise.all([fetch(LIBRARY_API), fetch(GROUPS_API), fetch(STAGES_API)])
        if (!itemsResponse.ok || !groupsResponse.ok || !stagesResponse.ok) throw new Error()
        const [data, groupData, stageData] = await Promise.all([itemsResponse.json(), groupsResponse.json(), stagesResponse.json()])
        if (active) {
          const equipment=data.filter(item=>isEquipmentItem(item)&&isPublishedItem(item))
          setLibrary(equipment);setGroups(groupData);setStages(stageData);setLibraryOnline(true);setLibraryLoading(false)
          if(!bootedRef.current) {
            const saved=projectFile(session.project || 'Untitled stageplot',session.space || null,session.items || [],session.preset || '',{equipment:session.equipmentCollisionEnabled,zone:session.zoneCollisionEnabled,snapping:session.snappingEnabled},session.layerFolders || [])
            if(lockedStageId!==null)saved.stage={kind:'library',id:lockedStageId}
            const restored=resolveProject(saved,equipment,stageData,lockedStageId)
            setSpace(restored.space);setPreset(restored.preset);setItems(restored.items);setLayerFolders(restored.layerFolders)
            setEquipmentCollisionEnabled(restored.collisionSettings.equipment);setZoneCollisionEnabled(restored.collisionSettings.zone);setSnappingEnabled(restored.collisionSettings.snapping)
            nextIdRef.current=Math.max(100,...restored.items.map(item=>item.id+1))
            bootedRef.current=true
            if(restored.dropped)setNotice(`${restored.dropped} unavailable equipment items removed`)
          }
        }
      } catch { if (active) {setLibraryOnline(false);setLibraryLoading(false)} }
    }
    refresh()
    const timer = window.setInterval(refresh, 2000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [session,lockedStageId])

  const checkpoint = () => setHistory((h) => [...h.slice(-19), {items,layerFolders}])

  const avoidsZones = item => !zoneCollisionEnabled || (isItemInsideSpace(item,boundaryForSpace(space)) && itemAvoidsSolidZones(item,space.zones,space.partVisibility))
  const avoidsEquipment = (item, ignoredIds = []) => !equipmentCollisionEnabled || item.collisionEnabled===false || items.every(other => other.id === item.id || ignoredIds.includes(other.id) || other.collisionEnabled===false || !itemsCollide(item,other))
  const canPlace = (item, ignoredIds = []) => avoidsZones(item) && avoidsEquipment(item,ignoredIds)
  const canPlaceSet = candidates => {
    const movingIds=candidates.map(item=>item.id)
    return candidates.every(item=>canPlace(item,movingIds))
      && (!equipmentCollisionEnabled || candidates.every((item,index)=>item.collisionEnabled===false || candidates.slice(index+1).every(other=>other.collisionEnabled===false || !itemsCollide(item,other))))
  }
  const translateItems = (source,dx,dy) => source.map(item=>({...item,xMeters:item.xMeters+dx,yMeters:item.yMeters+dy}))
  const advanceUntilCollision = (source,dx,dy) => {
    const destination=translateItems(source,dx,dy)
    if(canPlaceSet(destination))return destination
    if(!canPlaceSet(source))return source
    let low=0,high=1
    for(let step=0;step<14;step+=1){const middle=(low+high)/2;if(canPlaceSet(translateItems(source,dx*middle,dy*middle)))low=middle;else high=middle}
    return translateItems(source,dx*low,dy*low)
  }
  const constrainDrag = (source,target) => {
    const requested={x:target[0].xMeters-source[0].xMeters,y:target[0].yMeters-source[0].yMeters}
    const direct=advanceUntilCollision(source,requested.x,requested.y)
    const remaining={x:target[0].xMeters-direct[0].xMeters,y:target[0].yMeters-direct[0].yMeters}
    const slide=(first,second)=>{
      let result=advanceUntilCollision(direct,first==='x'?remaining.x:0,first==='y'?remaining.y:0)
      result=advanceUntilCollision(result,second==='x'?target[0].xMeters-result[0].xMeters:0,second==='y'?target[0].yMeters-result[0].yMeters:0)
      return result
    }
    const xThenY=slide('x','y'),yThenX=slide('y','x')
    const error=result=>(target[0].xMeters-result[0].xMeters)**2+(target[0].yMeters-result[0].yMeters)**2
    const constrained=error(xThenY)<=error(yThenX)?xThenY:yThenX
    if(!snappingEnabled)return constrained
    const movingIds=new Set(constrained.map(item=>item.id))
    const snap=nearestSnapOffset(constrained,items.filter(item=>!movingIds.has(item.id)),.3)
    if(!snap)return constrained
    const snapped=translateItems(constrained,snap.dx,snap.dy)
    return canPlaceSet(snapped)?snapped:constrained
  }

  const viewportPointInStage = (clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: (space?.width || 0) / 2, y: (space?.depth || 0) / 2 }
    return { x: (clientX - rect.left - pan.x) / (100 * zoom), y: (clientY - rect.top - pan.y) / (100 * zoom) }
  }

  const addItem = (tool, position) => {
    if(!space)return setStagePickerOpen(true)
    checkpoint()
    const widthMeters = tool.dimensions?.widthMeters || .8
    const depthMeters = tool.dimensions?.depthMeters || .6
    const viewport = viewportRef.current
    const centre = position || (viewport ? viewportPointInStage(viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2) : { x: space.width / 2, y: space.depth / 2 })
    const item = { ...tool, id: nextIdRef.current++, assetId:tool.id,
      widthMeters, depthMeters, showLabel: false, collisionEnabled: !belongsToStagingGroup(tool,groups),
      shapes: tool.shapes, collisionShapes: tool.collisionShapes || [{ type: 'rect', x: 0, y: 0, width: widthMeters, height: depthMeters }],
      xMeters: Math.max(widthMeters / 2, Math.min(space.width - widthMeters / 2, centre.x)),
      yMeters: Math.max(depthMeters / 2, Math.min(space.depth - depthMeters / 2, centre.y)), rotation: 0,
      controls:Object.fromEntries((tool.rotationParts || []).map(part=>[part.id,{rotation:part.defaultRotation || 0}])),
      partVisibility:Object.fromEntries((tool.shapes || []).filter(shape=>shape.toggleable).map(shape=>[shape.id,true])) }
    setItems((old) => insertAtDefaultLayer(old,item,groups))
    setSelected(item.id)
    setMultiSelected([])
  }

  const startDrag = (event, item) => {
    if (event.button !== 0) return
    event.stopPropagation()
    if (event.shiftKey) {
      changeLayerSelection([item.id],true)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    checkpoint()
    if (multiSelected.includes(item.id)) {
      const members=items.filter(member=>multiSelected.includes(member.id)).map(member=>({...member}))
      dragRef.current = { members, currentMembers:members, startX: event.clientX, startY: event.clientY }
      return
    }
    dragRef.current = { id: item.id, item:{...item}, currentItem:{...item}, startX: event.clientX, startY: event.clientY, xMeters: item.xMeters, yMeters: item.yMeters }
    setSelected(item.id)
    setMultiSelected([])
  }

  const startRotation = (event, item) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    checkpoint()
    const board = boardRef.current.getBoundingClientRect()
    const cx = board.left + item.xMeters * 100 * zoom
    const cy = board.top + item.yMeters * 100 * zoom
    rotateRef.current = { id: item.id, cx, cy, offset: (item.rotation || 0) - Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI }
    setSelected(item.id)
    setMultiSelected([])
  }

  const drag = (event) => {
    const current = dragRef.current
    const board = boardRef.current
    if (!current || !board) return
    if (current.members) {
      const dx = (event.clientX-current.startX)/(100*zoom), dy = (event.clientY-current.startY)/(100*zoom)
      const target = current.members.map(item=>({...item,xMeters:item.xMeters+dx,yMeters:item.yMeters+dy}))
      const candidates=constrainDrag(current.currentMembers,target)
      current.currentMembers=candidates
      const moved=new Map(candidates.map(item=>[item.id,item]))
      setItems(old=>old.map(item=>moved.get(item.id)||item))
      return
    }
    const target = [{ ...current.item, xMeters: current.xMeters + (event.clientX - current.startX) / (100 * zoom), yMeters: current.yMeters + (event.clientY - current.startY) / (100 * zoom) }]
    const [candidate]=constrainDrag([current.currentItem],target)
    current.currentItem=candidate
    setItems((old) => old.map((item) => item.id === current.id ? candidate : item))
  }

  const startPan = (event) => {
    if (event.button === 0 && !event.target.closest?.('.placed-item')) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      if (customToolMode === 'staging') {
        const start = viewportPointInStage(event.clientX, event.clientY)
        customDrawRef.current = { start }
        setCustomStagingPreview(customStagingBounds(start, start))
        return
      }
      const rect=viewportRef.current.getBoundingClientRect()
      const start={x:event.clientX-rect.left,y:event.clientY-rect.top}
      marqueeRef.current={start,worldStart:viewportPointInStage(event.clientX,event.clientY),additive:event.shiftKey?[...multiSelected,...(selected!==null?[selected]:[])]:[]}
      setMarquee(selectionBox(start,start))
      return
    }
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = { x: event.clientX, y: event.clientY, pan }
  }

  const startPartRotation = (event,item,part) => {
    if(event.button!==0)return
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);checkpoint()
    const board=boardRef.current.getBoundingClientRect(), angle=(item.rotation||0)*Math.PI/180
    const dx=part.pivotX-item.widthMeters/2,dy=part.pivotY-item.depthMeters/2
    const cx=board.left+(item.xMeters+dx*Math.cos(angle)-dy*Math.sin(angle))*100*zoom
    const cy=board.top+(item.yMeters+dx*Math.sin(angle)+dy*Math.cos(angle))*100*zoom
    const pointer=Math.atan2(event.clientY-cy,event.clientX-cx)*180/Math.PI-(item.rotation||0)
    const current=item.controls?.[part.id]?.rotation ?? part.defaultRotation ?? 0
    rotateRef.current={id:item.id,partId:part.id,cx,cy,itemRotation:item.rotation||0,min:part.minRotation??-180,max:part.maxRotation??180,offset:current-pointer}
    setSelected(item.id);setMultiSelected([])
  }

  const finishViewportDrag = event => {
    if (customDrawRef.current) {
      const bounds = customStagingBounds(customDrawRef.current.start, viewportPointInStage(event.clientX, event.clientY))
      const item = customStagingItem({ id: nextIdRef.current++, ...bounds, rotation: 0 })
      checkpoint()
      setItems(old => insertAtDefaultLayer(old,item,groups))
      setSelected(item.id); setMultiSelected([])
      setCustomStagingPreview(null); customDrawRef.current = null; setCustomToolMode(null)
      setNotice('Custom staging added')
    }
    if(marqueeRef.current) {
      const drag=marqueeRef.current
      const box=selectionBox(drag.worldStart,viewportPointInStage(event.clientX,event.clientY))
      const visibleItems=items.filter(item=>item.visible!==false&&folderForItem(layerFolders,item.id)?.visible!==false)
      const ids=[...new Set([...drag.additive,...enclosedItems(visibleItems,box,item=>rotatedBounds([{x:item.xMeters-item.widthMeters/2,y:item.yMeters-item.depthMeters/2,width:item.widthMeters,height:item.depthMeters,rotation:item.rotation}]))])]
      setSelected(ids.length===1?ids[0]:null)
      setMultiSelected(ids.length>1?ids:[])
      setMarquee(null)
      marqueeRef.current=null
    }
    dragRef.current=null;rotateRef.current=null;panRef.current=null
  }

  const moveViewport = (event) => {
    if (customDrawRef.current) {
      setCustomStagingPreview(customStagingBounds(customDrawRef.current.start, viewportPointInStage(event.clientX, event.clientY)))
      return
    }
    if(marqueeRef.current) {
      const rect=viewportRef.current.getBoundingClientRect()
      setMarquee(selectionBox(marqueeRef.current.start,{x:event.clientX-rect.left,y:event.clientY-rect.top}))
      return
    }
    if (rotateRef.current) {
      const current = rotateRef.current
      const pointer = Math.atan2(event.clientY - current.cy, event.clientX - current.cx) * 180 / Math.PI
      const rotation = current.partId ? Math.max(current.min,Math.min(current.max,Math.round(pointer-current.itemRotation+current.offset))) : pointer + current.offset
      setItems((old) => old.map((item) => {
        if (item.id !== current.id) return item
        const candidate = current.partId ? {...item,controls:{...item.controls,[current.partId]:{rotation}}} : { ...item, rotation: Math.round(rotation) }
        return canPlace(candidate) ? candidate : item
      }))
      return
    }
    if (dragRef.current) { drag(event); return }
    if (!panRef.current) return
    setPan({ x: panRef.current.pan.x + event.clientX - panRef.current.x, y: panRef.current.pan.y + event.clientY - panRef.current.y })
  }

  const zoomViewport = (event) => {
    event.preventDefault()
    const rect = viewportRef.current.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const next = Math.max(.25, Math.min(4, zoom * Math.exp(-event.deltaY * .0012)))
    setPan({ x: point.x - (point.x - pan.x) * next / zoom, y: point.y - (point.y - pan.y) * next / zoom })
    setZoom(next)
  }

  const fitToSpace = (targetSpace) => {
    const viewport = viewportRef.current
    if (!viewport || !targetSpace) return
    const next = Math.max(.05,Math.min((viewport.clientWidth - 80) / (targetSpace.width * 100), (viewport.clientHeight - 80) / (targetSpace.depth * 100), 2))
    setZoom(next)
    setPan({ x: (viewport.clientWidth - targetSpace.width * 100 * next) / 2, y: (viewport.clientHeight - targetSpace.depth * 100 * next) / 2 })
  }
  const fitStage = () => fitToSpace(space)

  const updateSelected = (changes) => setItems((old) => old.map((item) => item.id === selected ? { ...item, ...changes } : item))
  const updateCustomStaging = changes => setItems(old => old.map(item => item.id === selected ? customStagingItem({ ...item, ...changes }) : item))
  const updateCustomText = changes => setItems(old => old.map(item => {
    if (item.id !== selected) return item
    const updated = { ...item, ...changes }
    const measured = sizeText(updated)
    return customTextItem({ ...updated, widthMeters: measured.width, depthMeters: measured.height })
  }))

  const dropLibraryItem = (event) => {
    event.preventDefault()
    const custom = event.dataTransfer.getData('application/x-stageplot-custom')
    if (custom === 'text') return addCustomText(viewportPointInStage(event.clientX, event.clientY))
    if (custom === 'staging') {
      setSelectedEquipmentTab('custom'); setCustomToolMode('staging')
      setNotice('Drag across the canvas to draw staging')
      return
    }
    const tool = library.find((candidate) => candidate.id === event.dataTransfer.getData('application/x-stageplot-item'))
    if (tool) addItem({ ...tool, type: `library:${tool.id}`, tone: 'custom' }, viewportPointInStage(event.clientX, event.clientY))
  }

  const save = () => {
    const zoneConflicts=space ? items.filter(item=>!isItemInsideSpace(item,boundaryForSpace(space)) || !itemAvoidsSolidZones(item,space.zones,space.partVisibility)) : []
    const equipmentConflicts=[]
    items.forEach((item,index)=>items.slice(index+1).forEach(other=>{if(item.collisionEnabled!==false && other.collisionEnabled!==false && itemsCollide(item,other))equipmentConflicts.push([item,other])}))
    if((zoneConflicts.length || equipmentConflicts.length) && !window.confirm(`This layout has ${zoneConflicts.length} item${zoneConflicts.length===1?'':'s'} outside the usable stage or intersecting a solid zone, and ${equipmentConflicts.length} equipment collision${equipmentConflicts.length===1?'':'s'}.\n\nA saved stageplot may not be true to real life. Save anyway?`))return
    const data = JSON.stringify(projectFile(project,space,items,preset,{equipment:equipmentCollisionEnabled,zone:zoneCollisionEnabled,snapping:snappingEnabled},layerFolders), null, 2)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    link.download = `${project.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'stageplot'}.stageplot`
    link.click()
    URL.revokeObjectURL(link.href)
    setNotice('Project saved')
  }

  const load = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if((items.length || space) && !window.confirm('Open this file and replace the current project? Save first if you want to keep your current work.'))return
    try {
      const data=JSON.parse(await file.text())
      const responses=await Promise.all([fetch(LIBRARY_API),fetch(STAGES_API)])
      if(responses.some(response=>!response.ok))throw new Error('The library could not be loaded. Your current project was not changed.')
      const [latestEquipment,latestStages]=await Promise.all(responses.map(response=>response.json()))
      const equipment=latestEquipment.filter(item=>isEquipmentItem(item)&&isPublishedItem(item))
      const restored=resolveProject(data,equipment,latestStages,lockedStageId)
      setProject(restored.project);setSpace(restored.space);setPreset(restored.preset);setItems(restored.items);setLayerFolders(restored.layerFolders)
      setEquipmentCollisionEnabled(restored.collisionSettings.equipment);setZoneCollisionEnabled(restored.collisionSettings.zone);setSnappingEnabled(restored.collisionSettings.snapping)
      setLibrary(equipment);setStages(latestStages);setLibraryOnline(true)
      setSelected(null);setMultiSelected([]);setHistory([]);setStagePickerOpen(!restored.space)
      nextIdRef.current=Math.max(100,...restored.items.map(item=>item.id+1))
      fitToSpace(restored.space)
      setNotice(`Project loaded${restored.dropped ? `; ${restored.dropped} unavailable items dropped` : ''}${restored.missingStage ? '; stage no longer available' : ''}`)
    } catch(error) {setNotice(error.message || 'That file could not be opened')}
  }

  const choosePreset = (value) => {
    const stage=stages.find(candidate=>candidate.id===value.slice(6))
    if(!stage || (lockedStageId!==null && stage.id!==lockedStageId))return
    const nextSpace=stageSpace(stage)
    setPreset(value);setSpace(nextSpace);setStagePickerOpen(false);setHistory([]);fitToSpace(nextSpace)
  }
  const newProject = () => {
    if(!window.confirm('Create a new project? This clears all placed equipment and the selected stage. Save first to keep a copy.'))return
    setProject('Untitled stageplot');setSpace(null);setPreset('');setItems([]);setLayerFolders([]);setHistory([]);setEquipmentCollisionEnabled(true);setZoneCollisionEnabled(true);setSnappingEnabled(true)
    setSelected(null);setMultiSelected([]);setStagePickerOpen(true);setZoom(1);setPan({x:56,y:56})
    dragRef.current=null;rotateRef.current=null;panRef.current=null;marqueeRef.current=null;setMarquee(null)
  }
  const copyStageLink = async () => {
    if(!space?.stageId)return
    const url=new URL(window.location.href);url.searchParams.set('stage',space.stageId)
    try {await navigator.clipboard.writeText(url.href);setNotice('Stage-locked link copied')}
    catch {window.prompt('Copy this stage-locked link:',url.href)}
  }
  const exportPdf=()=>{setPrintTimestamp(new Date().toLocaleString());window.setTimeout(()=>window.print(),0)}

  const reorderLayer = (id, targetId) => {
    const from = items.findIndex(item => item.id === id), to = items.findIndex(item => item.id === targetId)
    if (from < 0 || to < 0 || from === to) return
    checkpoint()
    const copy = [...items]
    copy.splice(to, 0, copy.splice(from, 1)[0])
    setItems(copy)
    const targetFolder=folderForItem(layerFolders,targetId)
    setLayerFolders(old=>old.map(folder=>({...folder,itemIds:folder.id===targetFolder?.id?[...folder.itemIds.filter(itemId=>itemId!==id),id]:folder.itemIds.filter(itemId=>itemId!==id)})))
  }
  const addLayerFolder=()=>{checkpoint();const used=new Set(layerFolders.map(folder=>folder.name));let number=1,name='New folder';while(used.has(name)){number+=1;name=`New folder ${number}`}setLayerFolders(old=>[...old,{id:`folder-${Date.now()}-${nextFolderIdRef.current++}`,name,collapsed:false,visible:true,itemIds:[]}])}
  const dropItemsOnFolder=(itemIds,folderId)=>{checkpoint();const result=putItemsInFolder(items,layerFolders,itemIds,folderId);setItems(result.items);setLayerFolders(result.folders)}
  const dropFolderOnTarget=(folderId,targetId)=>{checkpoint();setItems(moveFolderBlock(items,layerFolders,folderId,targetId))}
  const toggleItemVisibility=item=>{checkpoint();setItems(old=>old.map(candidate=>candidate.id===item.id?{...candidate,visible:candidate.visible===false}:candidate));if(selected===item.id){setSelected(null);setMultiSelected([])}}
  const toggleFolderVisibility=folder=>{checkpoint();setLayerFolders(old=>old.map(candidate=>candidate.id===folder.id?{...candidate,visible:candidate.visible===false}:candidate));if(folder.visible!==false){setSelected(null);setMultiSelected([])}}
  const changeLayerSelection=(ids,additive=false)=>{const current=[...new Set([...(selected!==null?[selected]:[]),...multiSelected])];let next=ids;if(additive){const removing=ids.every(id=>current.includes(id));next=removing?current.filter(id=>!ids.includes(id)):[...new Set([...current,...ids])]}setSelected(next.length===1?next[0]:null);setMultiSelected(next.length>1?next:[])}
  const selectLayerFolder=(folder,additive=false)=>changeLayerSelection(items.filter(item=>folder.itemIds.includes(item.id)).map(item=>item.id),additive)
  const moveSelectedLayer = direction => {
    const index = items.findIndex(item => item.id === selected)
    const target = items[index + direction]
    if (target) reorderLayer(selected, target.id)
  }
  const removeSelected = () => {
    const ids=multiSelected.length?multiSelected:selected!==null?[selected]:[]
    if (!ids.length) return
    checkpoint()
    setItems((old) => old.filter((item) => !ids.includes(item.id)))
    setLayerFolders(old=>old.map(folder=>({...folder,itemIds:folder.itemIds.filter(id=>!ids.includes(id))})))
    setSelected(null)
    setMultiSelected([])
  }

  const undo = () => {
    if (!history.length) return
    setItems(history[history.length - 1].items || history[history.length - 1])
    setLayerFolders(history[history.length - 1].layerFolders || [])
    setHistory((h) => h.slice(0, -1))
    setSelected(null)
    setMultiSelected([])
  }

  const copySelected = () => {
    const ids=multiSelected.length?multiSelected:selected!==null?[selected]:[]
    if(!ids.length)return
    clipboardRef.current={items:structuredClone(items.filter(item=>ids.includes(item.id))),folders:Object.fromEntries(ids.map(id=>[id,folderForItem(layerFolders,id)?.id||null])),pasteCount:0}
    setNotice(`${ids.length} item${ids.length===1?'':'s'} copied`)
  }

  const pasteSelected = () => {
    const clipboard=clipboardRef.current
    if(!clipboard?.items.length)return
    checkpoint();clipboard.pasteCount+=1
    const offset=.2*clipboard.pasteCount
    const copies=clipboard.items.map(item=>({...structuredClone(item),id:nextIdRef.current++,xMeters:item.xMeters+offset,yMeters:item.yMeters+offset}))
    setItems(old=>[...old,...copies])
    setLayerFolders(old=>old.map(folder=>({...folder,itemIds:[...folder.itemIds,...copies.filter((_,index)=>clipboard.folders[clipboard.items[index].id]===folder.id).map(item=>item.id)]})))
    const ids=copies.map(item=>item.id);setSelected(ids.length===1?ids[0]:null);setMultiSelected(ids.length>1?ids:[])
    setNotice(`${ids.length} item${ids.length===1?'':'s'} pasted`)
  }

  const refreshPlacedItems = async () => {
    try {
    const response=await fetch(LIBRARY_API,{cache:'no-store'})
    if(!response.ok)throw new Error()
    const latest=(await response.json()).filter(item=>isEquipmentItem(item)&&isPublishedItem(item))
    setLibrary(latest);setLibraryOnline(true)
    const assets=new Map(latest.map(asset=>[asset.id,asset]));let refreshed=0,missing=0
    checkpoint()
    const next=items.map(item=>{
      if(!item.assetId)return item
      const asset=assets.get(item.assetId)
      if(!asset){missing+=1;return item}
      refreshed+=1
      const validParts=new Set((asset.rotationParts||[]).map(part=>part.id))
      const controls=Object.fromEntries(Object.entries(item.controls||{}).filter(([id])=>validParts.has(id)))
      for(const part of asset.rotationParts||[])if(!controls[part.id])controls[part.id]={rotation:part.defaultRotation||0}
      const partVisibility=Object.fromEntries((asset.shapes||[]).filter(shape=>shape.toggleable).map(shape=>[shape.id,item.partVisibility?.[shape.id]!==false]))
      return {...item,...asset,id:item.id,assetId:item.assetId,type:`library:${item.assetId}`,widthMeters:asset.dimensions.widthMeters,depthMeters:asset.dimensions.depthMeters,xMeters:item.xMeters,yMeters:item.yMeters,rotation:item.rotation||0,label:item.label,showLabel:item.showLabel===true,collisionEnabled:item.collisionEnabled!==false,visible:item.visible!==false,controls,partVisibility}
    })
    setItems(next)
    setNotice(`${refreshed} library item${refreshed===1?'':'s'} refreshed${missing?`; ${missing} unavailable unchanged`:''}`)
    } catch {setLibraryOnline(false);setNotice('Equipment library could not be refreshed')}
  }

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape' && customToolMode) {customDrawRef.current=null;setCustomStagingPreview(null);setCustomToolMode(null);return}
      if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select') || event.target.isContentEditable)) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='c') {event.preventDefault();copySelected();return}
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='v') {event.preventDefault();pasteSelected();return}
      if (event.key!=='Delete'&&event.key!=='Backspace')return
      if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return
      const ids=multiSelected.length?multiSelected:[selected]
      if(!items.some(item=>ids.includes(item.id)))return
      event.preventDefault();setHistory(previous=>[...previous.slice(-19),{items,layerFolders}]);setItems(previous=>previous.filter(item=>!ids.includes(item.id)));setLayerFolders(previous=>previous.map(folder=>({...folder,itemIds:folder.itemIds.filter(id=>!ids.includes(id))})));setSelected(null);setMultiSelected([])
    }
    window.addEventListener('keydown',onKeyDown)
    return()=>window.removeEventListener('keydown',onKeyDown)
  })

  const viewportCentre = () => {
    const viewport = viewportRef.current
    return viewport ? viewportPointInStage(viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2) : { x: (space?.width || 0) / 2, y: (space?.depth || 0) / 2 }
  }

  const addCustomText = (position = viewportCentre()) => {
    if (!space) return setStagePickerOpen(true)
    checkpoint()
    const measured = sizeText({ text: 'Custom Text', fontSize: .3, bold: false, italic: false, fill: '#25261f', lineSpacing: 1.2, textAlign: 'left' })
    const item = customTextItem({ id: nextIdRef.current++, xMeters: position.x, yMeters: position.y, widthMeters: measured.width, depthMeters: measured.height, rotation: 0 })
    setItems(old => [...old, item])
    setSelected(item.id); setMultiSelected([])
  }

  const customStagingBounds = (start, point) => {
    const widthMeters = Math.max(1, Math.round(Math.abs(point.x - start.x)))
    const depthMeters = Math.max(1, Math.round(Math.abs(point.y - start.y)))
    const left = point.x < start.x ? start.x - widthMeters : start.x
    const top = point.y < start.y ? start.y - depthMeters : start.y
    return { left, top, widthMeters, depthMeters, xMeters: left + widthMeters / 2, yMeters: top + depthMeters / 2 }
  }
  const clearStage=()=>{
    if(!items.length)return
    if(!window.confirm('Clear this stage? This removes all placed equipment and layer folders, but keeps the selected stage.'))return
    checkpoint();setItems([]);setLayerFolders([]);setSelected(null);setMultiSelected([])
  }

  const multiSelectedItems=items.filter(item=>multiSelected.includes(item.id))
  const triState=getValue=>{const values=multiSelectedItems.map(getValue);return values.every(Boolean)?true:values.every(value=>!value)?false:'mixed'}
  const updateMultiple=(updater)=>{checkpoint();const ids=new Set(multiSelected);setItems(old=>old.map(item=>ids.has(item.id)?updater(item):item))}
  const sharedToggleableParts=multiSelectedItems.length&&multiSelectedItems.every(item=>item.assetId===multiSelectedItems[0].assetId)
    ? (multiSelectedItems[0].shapes||[]).filter(shape=>shape.toggleable)
    : []
  const toggleableStageParts=space ? [...(space.zones||[]),...(space.textItems||[])].filter(part=>part.toggleable) : []
  const finishFolderRename=(folder,name)=>{const trimmed=name.trim();setEditingFolderId(null);if(!trimmed||trimmed===folder.name)return;checkpoint();setLayerFolders(old=>old.map(candidate=>candidate.id===folder.id?{...candidate,name:trimmed}:candidate))}
  const folderNameControl=folder=>editingFolderId===folder.id?<input className="folder-name-input" autoFocus value={folderNameDraft} onPointerDown={event=>event.stopPropagation()} onChange={event=>setFolderNameDraft(event.target.value)} onBlur={event=>finishFolderRename(folder,event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}if(event.key==='Escape'){event.preventDefault();event.currentTarget.value=folder.name;event.currentTarget.blur()}}}/>:<button className="folder-name" title="Click to select contents · Shift-click to add/remove · Double-click to rename" onClick={event=>selectLayerFolder(folder,event.shiftKey)} onDoubleClick={event=>{event.stopPropagation();setEditingFolderId(folder.id);setFolderNameDraft(folder.name)}}>{folder.name}</button>
  const layerTree=layerRows(items,layerFolders)
  const layerRow=(item,nested=false)=><div key={item.id} className={`stage-layer ${nested?'nested ':''}${item.id===selected||multiSelected.includes(item.id)?'active':''}`} draggable onDragStart={event=>{event.stopPropagation();const ids=multiSelected.includes(item.id)?multiSelected:[item.id];layerDragRef.current={type:ids.length>1?'items':'item',id:item.id,ids};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-stageplot-layer',String(item.id))}} onDragEnd={event=>{event.stopPropagation();layerDragRef.current=null}} onDragOver={event=>{event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move'}} onDrop={event=>{event.preventDefault();event.stopPropagation();const source=layerDragRef.current;if(source?.type==='item')reorderLayer(source.id,item.id);else if(source?.type==='items'){const folder=folderForItem(layerFolders,item.id);if(folder)dropItemsOnFolder(source.ids,folder.id)}else if(source?.type==='folder')dropFolderOnTarget(source.id,item.id);layerDragRef.current=null}}>
    <span className="layer-grip" aria-hidden="true">&#9776;</span><button className="layer-name" onClick={event=>changeLayerSelection([item.id],event.shiftKey)}>{item.label}</button><small>{item.collisionEnabled===false?'collision off':item.showLabel?'label':''}</small><button className="layer-visibility" title={item.visible===false?'Show layer':'Hide layer'} aria-label={item.visible===false?`Show ${item.label}`:`Hide ${item.label}`} onClick={()=>toggleItemVisibility(item)}><Icon name={item.visible===false?'eyeOff':'eye'} /></button>
  </div>

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><AppMark/><span className="brand-title"><b>STAGEPLOT</b><small>{APP_VERSION}</small></span></div>
        <input className="project-name" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project name" />
        <div className="top-actions">
          <button className="btn ghost" onClick={()=>setHelpOpen(true)}>Help</button>
          <button className="btn ghost" onClick={newProject}><Icon name="plus" /> New project</button>
          <button className="btn ghost" onClick={save}><Icon name="save" /> Save</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Open</button>
          <button className="btn primary" disabled={!space} onClick={exportPdf}><Icon name="print" /> Export PDF</button>
          <input ref={fileRef} type="file" accept=".stageplot,.stageplot.json,.json,application/json" onChange={load} hidden />
        </div>
      </header>

      <main className="workspace">
              <section className="sidebar stage-layer-panel" aria-label="Placed item layers">
                <p className="eyebrow">LAYERS <small>{items.length}</small></p>
                <p className="helper">Drag layers to reorder or drop them onto folders. Top row is in front.</p>
                <div className="stage-layer-list">{layerTree.map(row=>row.type==='item'?layerRow(row.item):<div className={`layer-folder ${row.items.length>0&&row.items.every(item=>item.id===selected||multiSelected.includes(item.id))?'selected':''}`} key={row.folder.id} draggable onDragStart={event=>{layerDragRef.current={type:'folder',id:row.folder.id};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-stageplot-folder',row.folder.id)}} onDragEnd={()=>{layerDragRef.current=null}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move'}} onDrop={event=>{event.preventDefault();event.stopPropagation();const source=layerDragRef.current;if(source?.type==='item'||source?.type==='items')dropItemsOnFolder(source.ids||[source.id],row.folder.id);else if(source?.type==='folder'&&source.id!==row.folder.id&&row.items.length)dropFolderOnTarget(source.id,row.items.at(-1).id);layerDragRef.current=null}}>
                  <div className="layer-folder-header"><button className="folder-collapse" aria-label={row.folder.collapsed?'Expand folder':'Collapse folder'} onClick={()=>setLayerFolders(old=>old.map(folder=>folder.id===row.folder.id?{...folder,collapsed:!folder.collapsed}:folder))}>{row.folder.collapsed?'▸':'▾'}</button><span className="folder-icon">▰</span>{folderNameControl(row.folder)}<small>{row.items.length}</small><button className="layer-visibility" title={row.folder.visible===false?'Show folder':'Hide folder'} aria-label={row.folder.visible===false?`Show ${row.folder.name}`:`Hide ${row.folder.name}`} onClick={()=>toggleFolderVisibility(row.folder)}><Icon name={row.folder.visible===false?'eyeOff':'eye'} /></button><button className="folder-remove" title="Remove folder (keeps layers)" onClick={()=>{checkpoint();setLayerFolders(old=>old.filter(folder=>folder.id!==row.folder.id))}}>×</button></div>
                  {!row.folder.collapsed&&<div className="layer-folder-children">{row.items.map(item=>layerRow(item,true))}</div>}
                </div>)}</div>
                {!items.length && <p className="helper">Add equipment to see its layers here.</p>}
                <div className="layer-order-actions"><button disabled={!selected || items[items.length - 1]?.id === selected} onClick={() => moveSelectedLayer(1)}>Bring forward</button><button disabled={!selected || items[0]?.id === selected} onClick={() => moveSelectedLayer(-1)}>Send back</button></div>
                <button className="new-layer-folder" onClick={addLayerFolder}>+ New folder</button>
              </section>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="canvas-status"><span className="status-dot" /> Editing layout {space&&<><span className="canvas-size">{space.width} × {space.depth} m</span><button className="refresh-items" disabled={!items.some(item=>item.assetId)} onClick={refreshPlacedItems}>Refresh items</button></>}</div>
            <div className="history-actions">
              <span>{Math.round(zoom * 100)}%</span>
              <button className="fit-button" onClick={fitStage}>FIT</button>
              <button title="Undo" onClick={undo} disabled={!history.length}><Icon name="undo" /></button>
              <button title="Delete selected" onClick={removeSelected} disabled={selected===null && !multiSelected.length}><Icon name="trash" /></button>
            </div>
          </div>
          <header className="print-header">{project.trim() || 'Untitled stageplot'}</header>

          <div className={`stage-viewport ${customToolMode ? 'custom-tool-active' : ''}`} ref={viewportRef} style={{'--print-scale':printLayout.scale,'--print-x':`${printLayout.x}px`,'--print-y':`${printLayout.y}px`}} onWheel={zoomViewport} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={dropLibraryItem} onPointerDownCapture={event=>{if(event.button===1)startPan(event)}} onPointerDown={startPan} onPointerMove={moveViewport} onPointerUp={finishViewportDrag} onPointerCancel={() => { dragRef.current = null; rotateRef.current = null; panRef.current = null; marqueeRef.current=null;customDrawRef.current=null;setCustomStagingPreview(null);setMarquee(null) }}>
            {space ? <div className="stage" ref={boardRef} style={{ width: `${space.width * 100}px`, height: `${space.depth * 100}px`, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <div className="stage-boundary-surface" style={{ clipPath: stageClipPath(space) }} />
              {(space.boundary?.nodes || space.zones?.length > 0) && <svg className="stage-zones" viewBox={`0 0 ${space.width} ${space.depth}`}><ZonePatterns zones={space.zones||[]} prefix="stage-zone-pattern"/>{(space.zones || []).filter((zone) => !zone.solid && !zone.label && (!zone.toggleable || space.partVisibility?.[zone.id]!==false)).map((zone) => <path key={zone.id} d={zonePath(zone.nodes)} fill={zoneFill(zone,'stage-zone-pattern')} fillOpacity={zone.fillOpacity} stroke={zone.stroke} strokeOpacity={zone.strokeOpacity} strokeWidth={zone.strokeWidth} vectorEffect="non-scaling-stroke" />)}{space.boundary?.nodes && <path className="main-stage-outline" d={zonePath(space.boundary.nodes)} />}{(space.zones || []).filter((zone) => zone.solid && (!zone.toggleable || space.partVisibility?.[zone.id]!==false)).map((zone) => <path className="solid-zone" key={zone.id} d={zonePath(zone.nodes)} fill={zoneFill(zone,'stage-zone-pattern') || "#faf9f4"} fillOpacity={zone.fillOpacity ?? 1} stroke={zone.stroke || "#71851f"} strokeOpacity={zone.strokeOpacity ?? 1} strokeWidth={zone.strokeWidth ?? 2} />)}</svg>}
              {((space.zones || []).some((zone) => zone.label) || space.textItems?.length > 0) && <svg className="stage-label-assets" viewBox={`0 0 ${space.width} ${space.depth}`}><ZonePatterns zones={(space.zones||[]).filter(zone=>zone.label)} prefix="stage-label-pattern"/>{(space.zones || []).filter((zone) => zone.label && (!zone.toggleable || space.partVisibility?.[zone.id]!==false)).map((zone) => <path key={zone.id} d={zonePath(zone.nodes)} fill={zoneFill(zone,'stage-label-pattern')} fillOpacity={zone.fillOpacity} stroke={zone.stroke} strokeOpacity={zone.strokeOpacity} strokeWidth={zone.strokeWidth} vectorEffect="non-scaling-stroke" />)}{(space.textItems || []).filter(item=>!item.toggleable || space.partVisibility?.[item.id]!==false).map((item) => <text key={item.id} x={item.x} y={item.y} fill={item.color} fillOpacity={item.opacity} stroke="none" fontSize={item.fontSize} textAnchor="middle" dominantBaseline="middle">{item.text}</text>)}</svg>}
              <div className="stage-title"><span>UPSTAGE</span><b>{space.name}</b><span>{space.width} × {space.depth} m</span></div>
              {items.filter(item=>item.visible!==false && folderForItem(layerFolders,item.id)?.visible!==false).map((item) => (
                <button
                  key={item.id}
                  className={`placed-item ${selected === item.id || multiSelected.includes(item.id) ? 'selected' : ''} ${item.collisionEnabled===false?'collision-disabled':''}`}
                  style={{ left: `${(item.xMeters - item.widthMeters / 2) * 100}px`, top: `${(item.yMeters - item.depthMeters / 2) * 100}px`, width: `${item.widthMeters * 100}px`, height: `${item.depthMeters * 100}px`, transform: `rotate(${item.rotation || 0}deg)` }}
                  onPointerDown={(e) => startDrag(e, item)}
                  onDoubleClick={() => {
                    const label = window.prompt('Item label', item.label)
                    if (label?.trim()) setItems((old) => old.map((x) => x.id === item.id ? { ...x, label: label.trim() } : x))
                  }}
                >
                  {item.customType ? <span className="placed-artwork"><CustomItemArtwork item={item} /></span> : item.shapes ? <span className="placed-artwork"><VectorArtwork shapes={item.shapes} width={item.widthMeters} depth={item.depthMeters} rotationParts={item.rotationParts} controls={item.controls} partVisibility={item.partVisibility} /></span> : <span className={`placed-symbol ${item.tone}`}>{item.icon}</span>}
                  {item.showLabel === true && <span className="placed-label">{item.label}</span>}
                  {selected === item.id && <span className="rotation-stem"><span className="rotation-handle" onPointerDown={(event) => startRotation(event, item)} /></span>}
                  {selected === item.id && (item.rotationParts || []).map(part=><span key={part.id} className="part-rotation-handle" title={`Rotate ${part.name}`} style={{left:`${part.pivotX/item.widthMeters*100}%`,top:`${part.pivotY/item.depthMeters*100}%`}} onPointerDown={event=>startPartRotation(event,item,part)} />)}
                </button>
              ))}
              {customStagingPreview && <div className="custom-staging-preview" style={{left:`${customStagingPreview.left*100}px`,top:`${customStagingPreview.top*100}px`,width:`${customStagingPreview.widthMeters*100}px`,height:`${customStagingPreview.depthMeters*100}px`}}><span>{customStagingPreview.widthMeters} × {customStagingPreview.depthMeters}m</span></div>}
              {!space.collisionBoundary && <div className="stage-front">AUDIENCE</div>}
            </div> : <div className="blank-stage-message">Choose a stage to start your plot.</div>}
            {marquee && <div className="selection-marquee" style={{left:marquee.x,top:marquee.y,width:marquee.right-marquee.x,height:marquee.bottom-marquee.y}} />}
          </div>
          <div className="viewport-drawer">
            <div className="drawer-header"><button className="drawer-toggle" aria-expanded={equipmentDrawerOpen} aria-controls="equipment-drawer-content" onClick={() => setEquipmentDrawerOpen(open => !open)}><span>{equipmentDrawerOpen ? '\u25be' : '\u25b8'} Equipment library</span></button>{equipmentDrawerOpen&&<label className="equipment-search drawer-search"><span className="sr-only">Search equipment by name</span><input type="search" placeholder="Search equipment..." value={equipmentSearch} onChange={event=>setEquipmentSearch(event.target.value)} /></label>}</div>
            <div id="equipment-drawer-content" className="drawer-content equipment-drawer-content" hidden={!equipmentDrawerOpen}>
          <section className="library bottom-library">
            {!libraryOnline && <p className="library-warning">Library offline — run <code>npm run dev:all</code></p>}

            <div className="equipment-tabs" role="tablist" aria-label="Equipment groups" onKeyDown={event => {
              const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')]
              const index = tabs.indexOf(document.activeElement)
              const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
              if (next !== null) { event.preventDefault(); tabs[next].focus(); tabs[next].click() }
            }}>
              {equipmentTabs.map(tab => <button key={tab.id} id={'equipment-tab-' + tab.id} role="tab" aria-selected={activeEquipmentTab === tab.id} aria-controls="equipment-tab-panel" tabIndex={activeEquipmentTab === tab.id ? 0 : -1} onClick={() => setSelectedEquipmentTab(tab.id)}>{tab.label}</button>)}
            </div>
            <div id="equipment-tab-panel" className="grouped-library" role="tabpanel" aria-labelledby={'equipment-tab-' + activeEquipmentTab} tabIndex={0}>
              {activeEquipmentTab === 'custom' ? <div className="custom-tools">
                {['Custom staging - Prostage','Custom Text'].filter(label=>label.toLowerCase().includes(equipmentSearch.trim().toLowerCase())).map((label,index)=><button className="custom-tool" key={label} draggable onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-stageplot-custom',index===0?'staging':'text')}} onClick={()=>{if(index===0){if(!space)return setStagePickerOpen(true);setCustomToolMode('staging');setNotice('Drag across the canvas to draw staging')}else addCustomText()}}>
                  <span>{index===0?<svg viewBox="0 0 100 70" aria-hidden="true"><rect x="5" y="8" width="90" height="54" fill="#d6d2c5" stroke="#25261f" strokeWidth="4"/><text x="50" y="36" textAnchor="middle" dominantBaseline="middle" fontSize="16" stroke="none" fill="#25261f">200mm</text></svg>:<svg viewBox="0 0 100 70" aria-hidden="true"><text x="50" y="38" textAnchor="middle" fontSize="34" fontWeight="700" stroke="none" fill="#25261f">T</text></svg>}</span><span className="equipment-tile-name">{label}</span>
                </button>)}
              </div> : <div className="custom-tools">{visibleEquipment.map(tool => <button className="custom-tool" key={tool.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-stageplot-item', tool.id) }} onClick={() => addItem({ ...tool, type: 'library:' + tool.id, tone: 'custom' })}>
                <span><VectorArtwork shapes={tool.shapes} width={tool.dimensions.widthMeters} depth={tool.dimensions.depthMeters} /></span><span className="equipment-tile-name">{tool.label}</span>
              </button>)}</div>}
              {activeEquipmentTab !== 'custom' && !visibleEquipment.length && <p className="helper" role="status">{equipmentSearch.trim() ? 'No equipment matches your search in this tab.' : activeEquipmentTab !== 'all' ? 'No equipment in this group.' : libraryOnline ? 'No equipment published yet.' : 'Equipment library unavailable.'}</p>}
            </div>
          </section>
            </div>
          </div>
          <footer className="canvas-footer"><span>{items.length} items placed</span><span>Middle-drag to pan · Left-drag empty space to select</span></footer>
          <footer className="print-footer">Created in Stageplot stage drawing app Version {APP_VERSION} - {printTimestamp}</footer>
        </section>

        <aside className="inspector">
          <p className="eyebrow">INSPECTOR</p>
          <div className="inspector-fields">{selectedItem ? selectedItem.customType === 'staging' ? <>
            <label className="field">NAME<input value={selectedItem.label} onChange={event=>updateCustomStaging({label:event.target.value})}/></label>
            <div className="inspector-grid">
              <label className="field">WIDTH (m)<input type="number" min="1" step="1" value={selectedItem.widthMeters} onChange={event=>updateCustomStaging({widthMeters:+event.target.value})}/></label>
              <label className="field">DEPTH (m)<input type="number" min="1" step="1" value={selectedItem.depthMeters} onChange={event=>updateCustomStaging({depthMeters:+event.target.value})}/></label>
            </div>
            <label className="field">HEIGHT (mm)<input type="number" min="0" step="1" value={selectedItem.heightMm} onChange={event=>updateCustomStaging({heightMm:+event.target.value})}/></label>
            <label className="label-toggle"><input type="checkbox" checked={selectedItem.showHeight!==false} onChange={event=>updateCustomStaging({showHeight:event.target.checked})}/> Show height text</label>
            <div className="inspector-grid colour-grid">
              <label className="field">FILL<input type="color" value={selectedItem.fill} onChange={event=>updateCustomStaging({fill:event.target.value})}/></label>
              <label className="field">FILL OPACITY<input type="number" min="0" max="100" step="1" value={Math.round(selectedItem.fillOpacity*100)} onChange={event=>updateCustomStaging({fillOpacity:+event.target.value/100})}/></label>
              <label className="field">LINE<input type="color" value={selectedItem.line} onChange={event=>updateCustomStaging({line:event.target.value})}/></label>
              <label className="field">LINE OPACITY<input type="number" min="0" max="100" step="1" value={Math.round(selectedItem.lineOpacity*100)} onChange={event=>updateCustomStaging({lineOpacity:+event.target.value/100})}/></label>
              <label className="field">METRE LINES<input type="color" value={selectedItem.sublineColor} onChange={event=>updateCustomStaging({sublineColor:event.target.value})}/></label>
              <label className="field">TEXT<input type="color" value={selectedItem.textColor} onChange={event=>updateCustomStaging({textColor:event.target.value})}/></label>
            </div>
            <label className="field">ROTATION<input type="number" step="1" value={selectedItem.rotation||0} onChange={event=>updateCustomStaging({rotation:+event.target.value})}/></label>
            <button className="inspector-delete" onClick={removeSelected}><Icon name="trash"/> Delete item</button>
          </> : selectedItem.customType === 'text' ? <>
            <label className="field">TEXT<textarea rows="4" value={selectedItem.text} onChange={event=>updateCustomText({text:event.target.value})}/></label>
            <label className="field">SIZE (cm)<input type="number" min="1" step="1" value={Math.round(selectedItem.fontSize*100)} onChange={event=>updateCustomText({fontSize:+event.target.value/100})}/></label>
            <label className="label-toggle"><input type="checkbox" checked={selectedItem.bold===true} onChange={event=>updateCustomText({bold:event.target.checked})}/> Bold</label>
            <label className="label-toggle"><input type="checkbox" checked={selectedItem.italic===true} onChange={event=>updateCustomText({italic:event.target.checked})}/> Italic</label>
            <label className="field">COLOUR<input type="color" value={selectedItem.fill} onChange={event=>updateCustomText({fill:event.target.value})}/></label>
            <label className="field">ROTATION<input type="number" step="1" value={selectedItem.rotation||0} onChange={event=>updateCustomText({rotation:+event.target.value})}/></label>
            <button className="inspector-delete" onClick={removeSelected}><Icon name="trash"/> Delete item</button>
          </> : <>
            <label className="field">NAME<input value={selectedItem.label} onChange={(e) => updateSelected({ label: e.target.value })} /></label>
            <div className="inspector-grid">
              <label className="field">X (m)<input type="number" step="0.1" value={selectedItem.xMeters.toFixed(2)} onChange={(e) => updateSelected({ xMeters: +e.target.value })} /></label>
              <label className="field">Y (m)<input type="number" step="0.1" value={selectedItem.yMeters.toFixed(2)} onChange={(e) => updateSelected({ yMeters: +e.target.value })} /></label>
              <label className="field">WIDTH (m)<input value={selectedItem.widthMeters} disabled /></label>
              <label className="field">DEPTH (m)<input value={selectedItem.depthMeters} disabled /></label>
            </div>
            <label className="field">ROTATION<input type="number" step="1" value={selectedItem.rotation || 0} onChange={(e) => updateSelected({ rotation: +e.target.value })} /></label>
            {(selectedItem.rotationParts || []).map(part=><label className="field" key={part.id}>{part.name.toUpperCase()} ROTATION<input type="number" step="1" min={part.minRotation??-180} max={part.maxRotation??180} value={selectedItem.controls?.[part.id]?.rotation ?? part.defaultRotation ?? 0} onChange={event=>updateSelected({controls:{...selectedItem.controls,[part.id]:{rotation:Math.max(part.minRotation??-180,Math.min(part.maxRotation??180,+event.target.value))}}})}/></label>)}
            {(selectedItem.shapes || []).some(shape=>shape.toggleable) && <section className="toggleable-parts"><h3>Toggleable parts</h3><p>Choose which optional parts appear on this item.</p><div className="toggleable-part-list">{selectedItem.shapes.filter(shape=>shape.toggleable).map(shape=><label className="toggleable-part-option" key={shape.id}><input type="checkbox" checked={selectedItem.partVisibility?.[shape.id]!==false} onChange={event=>{checkpoint();updateSelected({partVisibility:{...selectedItem.partVisibility,[shape.id]:event.target.checked}})}} /><span>{shape.name || 'Item part'}</span></label>)}</div></section>}
            <label className="label-toggle"><input type="checkbox" checked={selectedItem.showLabel === true} onChange={event => { checkpoint(); updateSelected({ showLabel: event.target.checked }) }} /> Show label</label>
            <label className="label-toggle"><input type="checkbox" checked={selectedItem.collisionEnabled !== false} onChange={event => { checkpoint(); updateSelected({ collisionEnabled: event.target.checked }) }} /> Equipment collision</label>
            <p className="inspector-hint">Turn this off to allow other equipment to overlap this item. Stage and solid-zone collision still applies.</p>
            <button className="inspector-delete" onClick={removeSelected}><Icon name="trash" /> Delete item</button>
          </> : multiSelected.length ? <><p className="inspector-hint">{multiSelected.length} items selected. Changes below apply to the entire selection.</p><section className="multi-item-settings"><h3>Common settings</h3><TriStateToggle value={triState(item=>item.showLabel===true)} label="Show label" onChange={value=>updateMultiple(item=>({...item,showLabel:value}))}/><TriStateToggle value={triState(item=>item.collisionEnabled!==false)} label="Equipment collision" description="Stage and solid-zone collision remain separate." onChange={value=>updateMultiple(item=>({...item,collisionEnabled:value}))}/><TriStateToggle value={triState(item=>item.visible!==false)} label="Visible on canvas" onChange={value=>updateMultiple(item=>({...item,visible:value}))}/></section>{sharedToggleableParts.length>0&&<section className="toggleable-parts"><h3>Toggleable parts</h3><p>Mixed values show an X. Clicking applies On to every selected item.</p><div className="toggleable-part-list">{sharedToggleableParts.map(shape=><TriStateToggle key={shape.id} value={triState(item=>item.partVisibility?.[shape.id]!==false)} label={shape.name||'Item part'} onChange={value=>updateMultiple(item=>({...item,partVisibility:{...item.partVisibility,[shape.id]:value}}))}/>)}</div></section>}<button className="inspector-delete" onClick={removeSelected}><Icon name="trash" /> Delete selected items</button></> : <>
            <p className="inspector-hint">{space ? space.name : 'No stage selected.'}{lockedStageId!==null && ' · Stage locked by this link'}</p>
            {toggleableStageParts.length>0&&<section className="toggleable-parts"><h3>Toggleable stage parts</h3><p>Choose which optional parts appear in this project. Hiding a solid zone also disables its collision.</p><div className="toggleable-part-list">{toggleableStageParts.map(part=><label className="toggleable-part-option" key={part.id}><input type="checkbox" checked={space.partVisibility?.[part.id]!==false} onChange={event=>setSpace(current=>({...current,partVisibility:{...current.partVisibility,[part.id]:event.target.checked}}))}/><span>{part.name||'Stage part'}</span></label>)}</div></section>}
            <h3>Movement collision</h3>
            <label className="label-toggle"><input type="checkbox" checked={equipmentCollisionEnabled} onChange={event=>setEquipmentCollisionEnabled(event.target.checked)} /> Equipment collision</label>
            <label className="label-toggle"><input type="checkbox" checked={zoneCollisionEnabled} onChange={event=>setZoneCollisionEnabled(event.target.checked)} /> Stage and zone collision</label>
            <label className="label-toggle"><input type="checkbox" checked={snappingEnabled} onChange={event=>setSnappingEnabled(event.target.checked)} /> Corner snapping</label>
            <p className="inspector-hint">Turn constraints off temporarily to arrange equipment in narrow areas. Saving still checks the complete layout.</p>
            {lockedStageId===null && <button className="fit-stage" onClick={()=>setStagePickerOpen(true)}>Choose stage</button>}
            {space && <><div className="inspector-grid">
              <label className="field">WIDTH (m)<input type="number" min="1" step="0.01" disabled={!!space.stageId || lockedStageId!==null} value={space.width} onChange={(e) => {if(+e.target.value>0){setPreset('custom');setSpace({...space,width:+e.target.value})}}} /></label>
              <label className="field">DEPTH (m)<input type="number" min="1" step="0.01" disabled={!!space.stageId || lockedStageId!==null} value={space.depth} onChange={(e) => {if(+e.target.value>0){setPreset('custom');setSpace({...space,depth:+e.target.value})}}} /></label>
            </div><button className="fit-stage" onClick={fitStage}>Fit stage to viewport</button>
            {space.stageId && <button className="fit-stage" onClick={copyStageLink}>Copy stage-locked link</button>}</>}
            {space && <button className="inspector-delete clear-stage" disabled={!items.length} onClick={clearStage}><Icon name="trash" /> Clear stage</button>}
          </>}</div>
        </aside>
      </main>
      {(stagePickerOpen || !space) && <div className="stage-picker-backdrop" onMouseDown={event=>{if(space && event.target===event.currentTarget)setStagePickerOpen(false)}}>
        <section className="stage-picker" role="dialog" aria-modal="true" aria-label="Choose a stage">
          <div className="stage-picker-heading"><h2>{lockedStageId!==null ? 'Your designated stage' : 'Choose your stage'}</h2>{space && <button aria-label="Close" onClick={()=>setStagePickerOpen(false)}>&times;</button>}</div>
          <p>{lockedStageId!==null ? 'This link is restricted to the stage below.' : 'Select the space you would like to build your stageplot in.'}</p>
          {libraryLoading ? <p role="status">Loading stages…</p> : !libraryOnline ? <p role="alert">Stage library unavailable. Start the library server or try again when your connection is restored.</p> : <div className="stage-picker-list">{stages.filter(stage=>lockedStageId===null || stage.id===lockedStageId).map(stage=><button key={stage.id} onClick={()=>choosePreset('stage:'+stage.id)}>
            <svg viewBox={`0 0 ${stage.dimensions.widthMeters} ${stage.dimensions.depthMeters}`} aria-hidden="true"><path d={zonePath(stage.boundary.nodes)} fill="#e9f5bc" stroke="#71851f" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
            <span><b>{stage.label}</b><small>{stage.dimensions.widthMeters.toFixed(2)} × {stage.dimensions.depthMeters.toFixed(2)} m</small></span>
          </button>)}{!stages.some(stage=>lockedStageId===null || stage.id===lockedStageId) && <p role="status">{lockedStageId!==null ? 'The stage in this link is unavailable. Please ask the theatre for an updated link.' : 'No stages saved yet. Create one in Shape Studio, or use a rectangular space below.'}</p>}</div>}
          {lockedStageId===null && <form className="stage-picker-custom" onSubmit={event=>{event.preventDefault();if(customWidth>0 && customDepth>0){const next={name:'Custom Space',width:customWidth,depth:customDepth};setSpace(next);setPreset('custom');setStagePickerOpen(false);fitToSpace(next)}}}>
            <h3>Custom rectangular space</h3><div className="inspector-grid"><label className="field">WIDTH (m)<input type="number" required min=".1" step=".01" value={customWidth} onChange={event=>setCustomWidth(+event.target.value)} /></label><label className="field">DEPTH (m)<input type="number" required min=".1" step=".01" value={customDepth} onChange={event=>setCustomDepth(+event.target.value)} /></label></div><button className="btn ghost" type="submit">Use rectangular space</button>
          </form>}
          <button className="btn ghost" onClick={()=>fileRef.current?.click()}>Open a saved project</button>
        </section>
      </div>}
      {sessionError && <div className="session-warning" role="alert">{sessionError}</div>}
      {notice && <div className="toast">{notice}</div>}
      {helpOpen&&<StageplotHelp onClose={()=>setHelpOpen(false)}/>} 
    </div>
  )
}

export default App
