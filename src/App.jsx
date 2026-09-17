import { useEffect, useRef, useState } from 'react'
import { stagePath as zonePath } from './stage-geometry.js'
import { isPublishedItem } from '../tools/library-membership.mjs'
import { footprintPoints, isItemInsideSpace, pointInPolygon, rectangleBoundary } from './geometry.js'

const PRESETS = {
  theatre: { name: 'Main Theatre', width: 12, depth: 8 },
  studio: { name: 'Studio', width: 8, depth: 6 },
  custom: { name: 'Custom Space', width: 10, depth: 7 },
}

const LIBRARY_API = 'http://127.0.0.1:8787/api/items'
const GROUPS_API = 'http://127.0.0.1:8787/api/groups'
const STAGES_API = 'http://127.0.0.1:8787/api/stages'

const boundaryForSpace = (space) => space.collisionBoundary?.length >= 3 ? space.collisionBoundary : rectangleBoundary(space.width, space.depth)
const stageClipPath = (space) => `polygon(${boundaryForSpace(space).map((point) => `${point.x / space.width * 100}% ${point.y / space.depth * 100}%`).join(',')})`
const itemAvoidsSolidZones = (item, zones = []) => {
  const footprint = footprintPoints(item)
  return zones.filter((zone) => zone.solid && zone.collisionBoundary?.length >= 3).every((zone) => !footprint.some((point) => pointInPolygon(point, zone.collisionBoundary)) && !zone.collisionBoundary.some((point) => pointInPolygon(point, footprint)))
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

function VectorArtwork({ shapes, width, depth }) {
  return <svg viewBox={`0 0 ${width} ${depth}`} aria-hidden="true">{(shapes || []).map((shape) => <VectorShape shape={shape} key={shape.id} />)}</svg>
}

const Icon = ({ name }) => {
  const paths = {
    save: <><path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
    print: <><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><path d="M6 15h12v6H6z"/></>,
    undo: <><path d="M9 7 4 12l5 5"/><path d="M4 12h9a7 7 0 0 1 7 7"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [project, setProject] = useState('Friday Night Sessions')
  const [space, setSpace] = useState(PRESETS.theatre)
  const [preset, setPreset] = useState('theatre')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [equipmentDrawerOpen, setEquipmentDrawerOpen] = useState(true)
  const [history, setHistory] = useState([])
  const [notice, setNotice] = useState('')
  const [library, setLibrary] = useState([])
  const [groups, setGroups] = useState([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [selectedEquipmentTab, setSelectedEquipmentTab] = useState('all')
  const [stages, setStages] = useState([])
  const equipmentTabs = [
    { id: 'all', label: 'All equipment' },
    ...groups.filter(group => library.some(tool => tool.groupId === group.id)).map(group => ({ id: 'group:' + group.id, label: group.label })),
    ...(library.some(tool => !groups.some(group => group.id === tool.groupId)) ? [{ id: 'uncategorised', label: 'Uncategorised' }] : []),
  ]
  const activeEquipmentTab = equipmentTabs.some(tab => tab.id === selectedEquipmentTab) ? selectedEquipmentTab : 'all'
  const visibleEquipment = library.filter(tool => {
    const tabId = groups.some(group => group.id === tool.groupId) ? 'group:' + tool.groupId : 'uncategorised'
    return (activeEquipmentTab === 'all' || activeEquipmentTab === tabId) && tool.label.toLowerCase().includes(equipmentSearch.trim().toLowerCase())
  }).sort((a,b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))

  const [libraryOnline, setLibraryOnline] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 56, y: 56 })
  const boardRef = useRef(null)
  const viewportRef = useRef(null)
  const fileRef = useRef(null)
  const dragRef = useRef(null)
  const layerDragRef = useRef(null)
  const rotateRef = useRef(null)
  const panRef = useRef(null)
  const nextIdRef = useRef(100)
  const selectedItem = items.find((item) => item.id === selected)

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
        if (active) { setLibrary(data.filter(isPublishedItem)); setGroups(groupData); setStages(stageData); setLibraryOnline(true) }
      } catch { if (active) setLibraryOnline(false) }
    }
    refresh()
    const timer = window.setInterval(refresh, 2000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  const checkpoint = () => setHistory((h) => [...h.slice(-19), items])

  const viewportPointInStage = (clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: space.width / 2, y: space.depth / 2 }
    return { x: (clientX - rect.left - pan.x) / (100 * zoom), y: (clientY - rect.top - pan.y) / (100 * zoom) }
  }

  const addItem = (tool, position) => {
    checkpoint()
    const widthMeters = tool.dimensions?.widthMeters || .8
    const depthMeters = tool.dimensions?.depthMeters || .6
    const viewport = viewportRef.current
    const centre = position || (viewport ? viewportPointInStage(viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2) : { x: space.width / 2, y: space.depth / 2 })
    const item = { ...tool, id: nextIdRef.current++,
      widthMeters, depthMeters, showLabel: false,
      shapes: tool.shapes, collisionShapes: tool.collisionShapes || [{ type: 'rect', x: 0, y: 0, width: widthMeters, height: depthMeters }],
      xMeters: Math.max(widthMeters / 2, Math.min(space.width - widthMeters / 2, centre.x)),
      yMeters: Math.max(depthMeters / 2, Math.min(space.depth - depthMeters / 2, centre.y)), rotation: 0 }
    setItems((old) => [...old, item])
    setSelected(item.id)
  }

  const startDrag = (event, item) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    checkpoint()
    dragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, xMeters: item.xMeters, yMeters: item.yMeters }
    setSelected(item.id)
  }

  const startRotation = (event, item) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    checkpoint()
    const board = boardRef.current.getBoundingClientRect()
    const cx = board.left + item.xMeters * 100 * zoom
    const cy = board.top + item.yMeters * 100 * zoom
    rotateRef.current = { id: item.id, cx, cy, offset: (item.rotation || 0) - Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI }
    setSelected(item.id)
  }

  const drag = (event) => {
    const current = dragRef.current
    const board = boardRef.current
    if (!current || !board) return
    const target = items.find((item) => item.id === current.id)
    if (!target) return
    const candidate = { ...target, xMeters: current.xMeters + (event.clientX - current.startX) / (100 * zoom), yMeters: current.yMeters + (event.clientY - current.startY) / (100 * zoom) }
    if (isItemInsideSpace(candidate, boundaryForSpace(space)) && itemAvoidsSolidZones(candidate, space.zones)) setItems((old) => old.map((item) => item.id === current.id ? candidate : item))
  }

  const startPan = (event) => {
    if (event.button !== 0 || event.target.closest?.('.placed-item')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = { x: event.clientX, y: event.clientY, pan }
    setSelected(null)
  }

  const moveViewport = (event) => {
    if (rotateRef.current) {
      const current = rotateRef.current
      const rotation = Math.atan2(event.clientY - current.cy, event.clientX - current.cx) * 180 / Math.PI + current.offset
      setItems((old) => old.map((item) => {
        if (item.id !== current.id) return item
        const candidate = { ...item, rotation: Math.round(rotation) }
        return isItemInsideSpace(candidate, boundaryForSpace(space)) && itemAvoidsSolidZones(candidate, space.zones) ? candidate : item
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

  const fitStage = () => {
    const viewport = viewportRef.current
    if (!viewport) return
    const next = Math.min((viewport.clientWidth - 80) / (space.width * 100), (viewport.clientHeight - 80) / (space.depth * 100), 2)
    setZoom(next)
    setPan({ x: (viewport.clientWidth - space.width * 100 * next) / 2, y: (viewport.clientHeight - space.depth * 100 * next) / 2 })
  }

  const updateSelected = (changes) => setItems((old) => old.map((item) => item.id === selected ? { ...item, ...changes } : item))

  const dropLibraryItem = (event) => {
    event.preventDefault()
    const tool = library.find((candidate) => candidate.id === event.dataTransfer.getData('application/x-stageplot-item'))
    if (tool) addItem({ ...tool, type: `library:${tool.id}`, tone: 'custom' }, viewportPointInStage(event.clientX, event.clientY))
  }

  const save = () => {
    const data = JSON.stringify({ version: 1, project, space, items }, null, 2)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    link.download = `${project.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'stageplot'}.stageplot.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setNotice('Project saved')
  }

  const load = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!Array.isArray(data.items) || !data.space) throw new Error('Invalid file')
        setProject(data.project || 'Untitled stageplot')
        setSpace(data.space)
        setItems(data.items.map((item) => ({
          ...item,
          widthMeters: item.widthMeters || item.dimensions?.widthMeters || .8,
          depthMeters: item.depthMeters || item.dimensions?.depthMeters || .6,
          xMeters: Number.isFinite(item.xMeters) ? item.xMeters : ((item.x || 50) / 100) * data.space.width,
          yMeters: Number.isFinite(item.yMeters) ? item.yMeters : ((item.y || 50) / 100) * data.space.depth,
          rotation: item.rotation || 0,
          showLabel: item.showLabel === true,
        })))
        setPreset('custom')
        setSelected(null)
        setNotice('Project loaded')
      } catch { setNotice('That file could not be opened') }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const choosePreset = (value) => {
    setPreset(value)
    if (value.startsWith('stage:')) {
      const stage = stages.find((candidate) => candidate.id === value.slice(6))
      if (stage) setSpace({ name: stage.label, width: stage.dimensions.widthMeters, depth: stage.dimensions.depthMeters, collisionBoundary: stage.collisionBoundary, boundary: stage.boundary, zones: stage.zones || [], textItems: stage.textItems || [] })
    } else setSpace(PRESETS[value])
  }

  const reorderLayer = (id, targetId) => {
    const from = items.findIndex(item => item.id === id), to = items.findIndex(item => item.id === targetId)
    if (from < 0 || to < 0 || from === to) return
    checkpoint()
    const copy = [...items]
    copy.splice(to, 0, copy.splice(from, 1)[0])
    setItems(copy)
  }
  const moveSelectedLayer = direction => {
    const index = items.findIndex(item => item.id === selected)
    const target = items[index + direction]
    if (target) reorderLayer(selected, target.id)
  }
  const removeSelected = () => {
    if (!selected) return
    checkpoint()
    setItems((old) => old.filter((item) => item.id !== selected))
    setSelected(null)
  }

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select') || event.target.isContentEditable)) return
      if (!items.some(item => item.id === selected)) return
      event.preventDefault()
      setHistory(previous => [...previous.slice(-19), items])
      setItems(previous => previous.filter(item => item.id !== selected))
      setSelected(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [items, selected])

  const undo = () => {
    if (!history.length) return
    setItems(history[history.length - 1])
    setHistory((h) => h.slice(0, -1))
    setSelected(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>STAGEPLOT</span></div>
        <input className="project-name" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project name" />
        <div className="top-actions">
          <button className="btn ghost" onClick={save}><Icon name="save" /> Save</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Open</button>
          <button className="btn primary" onClick={() => window.print()}><Icon name="print" /> Export PDF</button>
          <input ref={fileRef} type="file" accept=".json,.stageplot" onChange={load} hidden />
        </div>
      </header>

      <main className="workspace">
              <section className="sidebar stage-layer-panel" aria-label="Placed item layers">
                <p className="eyebrow">LAYERS <small>{items.length}</small></p>
                <p className="helper">Drag to reorder. Top row is in front.</p>
                <div className="stage-layer-list">{[...items].reverse().map(item => <button key={item.id} className={item.id === selected ? 'stage-layer active' : 'stage-layer'} aria-pressed={item.id === selected} draggable onDragStart={event => { layerDragRef.current = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-stageplot-layer', String(item.id)) }} onDragEnd={() => { layerDragRef.current = null }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={event => { event.preventDefault(); event.stopPropagation(); if (layerDragRef.current !== null) reorderLayer(layerDragRef.current, item.id); layerDragRef.current = null }} onClick={() => setSelected(item.id)}><span aria-hidden="true">&#9776;</span><span>{item.label}</span><small>{item.showLabel ? 'label' : ''}</small></button>)}</div>
                {!items.length && <p className="helper">Add equipment to see its layers here.</p>}
                <div className="layer-order-actions"><button disabled={!selected || items[items.length - 1]?.id === selected} onClick={() => moveSelectedLayer(1)}>Bring forward</button><button disabled={!selected || items[0]?.id === selected} onClick={() => moveSelectedLayer(-1)}>Send back</button></div>
              </section>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div><span className="status-dot" /> Editing layout</div>
            <div className="history-actions">
              <span>{Math.round(zoom * 100)}%</span>
              <button className="fit-button" onClick={fitStage}>FIT</button>
              <button title="Undo" onClick={undo} disabled={!history.length}><Icon name="undo" /></button>
              <button title="Delete selected" onClick={removeSelected} disabled={!selected}><Icon name="trash" /></button>
            </div>
          </div>

          <div className="stage-viewport" ref={viewportRef} onWheel={zoomViewport} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={dropLibraryItem} onPointerDown={startPan} onPointerMove={moveViewport} onPointerUp={() => { dragRef.current = null; rotateRef.current = null; panRef.current = null }} onPointerCancel={() => { dragRef.current = null; rotateRef.current = null; panRef.current = null }}>
            <div className="stage" ref={boardRef} style={{ width: `${space.width * 100}px`, height: `${space.depth * 100}px`, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <div className="stage-boundary-surface" style={{ clipPath: stageClipPath(space) }} />
              {(space.boundary?.nodes || space.zones?.length > 0) && <svg className="stage-zones" viewBox={`0 0 ${space.width} ${space.depth}`}>{(space.zones || []).filter((zone) => !zone.solid && !zone.label).map((zone) => <path key={zone.id} d={zonePath(zone.nodes)} fill={zone.fill} fillOpacity={zone.fillOpacity} stroke={zone.stroke} strokeOpacity={zone.strokeOpacity} strokeWidth={zone.strokeWidth} vectorEffect="non-scaling-stroke" />)}{space.boundary?.nodes && <path className="main-stage-outline" d={zonePath(space.boundary.nodes)} />}{(space.zones || []).filter((zone) => zone.solid).map((zone) => <path className="solid-zone" key={zone.id} d={zonePath(zone.nodes)} />)}</svg>}
              {((space.zones || []).some((zone) => zone.label) || space.textItems?.length > 0) && <svg className="stage-label-assets" viewBox={`0 0 ${space.width} ${space.depth}`}>{(space.zones || []).filter((zone) => zone.label).map((zone) => <path key={zone.id} d={zonePath(zone.nodes)} fill={zone.fill} fillOpacity={zone.fillOpacity} stroke={zone.stroke} strokeOpacity={zone.strokeOpacity} strokeWidth={zone.strokeWidth} vectorEffect="non-scaling-stroke" />)}{(space.textItems || []).map((item) => <text key={item.id} x={item.x} y={item.y} fill={item.color} fillOpacity={item.opacity} stroke="none" fontSize={item.fontSize} textAnchor="middle" dominantBaseline="middle">{item.text}</text>)}</svg>}
              <div className="stage-title"><span>UPSTAGE</span><b>{space.name}</b><span>{space.width} × {space.depth} m</span></div>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`placed-item ${selected === item.id ? 'selected' : ''}`}
                  style={{ left: `${(item.xMeters - item.widthMeters / 2) * 100}px`, top: `${(item.yMeters - item.depthMeters / 2) * 100}px`, width: `${item.widthMeters * 100}px`, height: `${item.depthMeters * 100}px`, transform: `rotate(${item.rotation || 0}deg)` }}
                  onPointerDown={(e) => startDrag(e, item)}
                  onDoubleClick={() => {
                    const label = window.prompt('Item label', item.label)
                    if (label?.trim()) setItems((old) => old.map((x) => x.id === item.id ? { ...x, label: label.trim() } : x))
                  }}
                >
                  {item.shapes ? <span className="placed-artwork"><VectorArtwork shapes={item.shapes} width={item.widthMeters} depth={item.depthMeters} /></span> : <span className={`placed-symbol ${item.tone}`}>{item.icon}</span>}
                  {item.showLabel === true && <span className="placed-label">{item.label}</span>}
                  {selected === item.id && <span className="rotation-stem"><span className="rotation-handle" onPointerDown={(event) => startRotation(event, item)} /></span>}
                </button>
              ))}
              {!space.collisionBoundary && <div className="stage-front">AUDIENCE</div>}
            </div>
          </div>
          <div className="viewport-drawer">
            <button className="drawer-toggle" aria-expanded={equipmentDrawerOpen} aria-controls="equipment-drawer-content" onClick={() => setEquipmentDrawerOpen(open => !open)}><span>{equipmentDrawerOpen ? '\u25be' : '\u25b8'} Equipment library</span><small>Click or drag equipment onto the stage</small></button>
            <div id="equipment-drawer-content" className="drawer-content equipment-drawer-content" hidden={!equipmentDrawerOpen}>
          <section className="library bottom-library">
            <div className="equipment-library-header"><p className="eyebrow">EQUIPMENT</p>            <label className="equipment-search">
              <span className="sr-only">Search equipment by name</span>
              <input type="search" placeholder="Search equipment..." value={equipmentSearch} onChange={event => setEquipmentSearch(event.target.value)} />
            </label></div>
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
              <div className="custom-tools">{visibleEquipment.map(tool => <button className="custom-tool" key={tool.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-stageplot-item', tool.id) }} onClick={() => addItem({ ...tool, type: 'library:' + tool.id, tone: 'custom' })}>
                <span><VectorArtwork shapes={tool.shapes} width={tool.dimensions.widthMeters} depth={tool.dimensions.depthMeters} /></span><span className="equipment-tile-name">{tool.label}</span>
              </button>)}</div>
              {!visibleEquipment.length && <p className="helper" role="status">{equipmentSearch.trim() ? 'No equipment matches your search in this tab.' : activeEquipmentTab !== 'all' ? 'No equipment in this group.' : libraryOnline ? 'No equipment published yet.' : 'Equipment library unavailable.'}</p>}
            </div>
          </section>
            </div>
          </div>
          <footer className="canvas-footer"><span>{items.length} items placed</span><span>Drag items to position · Double-click to rename</span></footer>
        </section>

        <aside className="inspector">
          <p className="eyebrow">INSPECTOR</p>
          <div className="inspector-fields">{selectedItem ? <>
            <label className="field">NAME<input value={selectedItem.label} onChange={(e) => updateSelected({ label: e.target.value })} /></label>
            <div className="inspector-grid">
              <label className="field">X (m)<input type="number" step="0.1" value={selectedItem.xMeters.toFixed(2)} onChange={(e) => updateSelected({ xMeters: +e.target.value })} /></label>
              <label className="field">Y (m)<input type="number" step="0.1" value={selectedItem.yMeters.toFixed(2)} onChange={(e) => updateSelected({ yMeters: +e.target.value })} /></label>
              <label className="field">WIDTH (m)<input value={selectedItem.widthMeters} disabled /></label>
              <label className="field">DEPTH (m)<input value={selectedItem.depthMeters} disabled /></label>
            </div>
            <label className="field">ROTATION<input type="number" step="1" value={selectedItem.rotation || 0} onChange={(e) => updateSelected({ rotation: +e.target.value })} /></label>
            <label className="label-toggle"><input type="checkbox" checked={selectedItem.showLabel === true} onChange={event => { checkpoint(); updateSelected({ showLabel: event.target.checked }) }} /> Show label</label>
            <button className="inspector-delete" onClick={removeSelected}><Icon name="trash" /> Delete item</button>
          </> : <>
            <p className="inspector-hint">No item selected. Stage dimensions do not scale placed items.</p>
            <label className="field">SPACE<select value={preset} onChange={(e) => choosePreset(e.target.value)}><option value="theatre">Main Theatre</option><option value="studio">Studio</option>{stages.length > 0 && <optgroup label="Stage library">{stages.map((stage) => <option value={`stage:${stage.id}`} key={stage.id}>{stage.label}</option>)}</optgroup>}<option value="custom">Custom rectangular space</option></select></label>
            <div className="inspector-grid">
              <label className="field">WIDTH (m)<input type="number" min="1" step="0.1" value={space.width} onChange={(e) => { setPreset('custom'); setSpace({ name: 'Custom Space', width: +e.target.value, depth: space.depth }) }} /></label>
              <label className="field">DEPTH (m)<input type="number" min="1" step="0.1" value={space.depth} onChange={(e) => { setPreset('custom'); setSpace({ name: 'Custom Space', width: space.width, depth: +e.target.value }) }} /></label>
            </div>
            <button className="fit-stage" onClick={fitStage}>Fit stage to viewport</button>
          </>}</div>
        </aside>
      </main>
      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}

export default App
