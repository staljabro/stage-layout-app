import { TextArtwork } from './text-shape.jsx'

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

export function VectorArtwork({ shapes, width, depth, rotationParts = [], controls = {}, partVisibility = {} }) {
  const parts = new Map(rotationParts.map(part=>[part.id,part]))
  return <svg style={{width:"100%",height:"100%"}} viewBox={`0 0 ${width} ${depth}`} aria-hidden="true">{(shapes || []).map((shape) => {if(shape.toggleable&&partVisibility[shape.id]===false)return null;const part=parts.get(shape.rotationPartId);const angle=part ? controls[part.id]?.rotation ?? part.defaultRotation ?? 0 : 0;return <g key={shape.id} transform={part?`rotate(${angle} ${part.pivotX} ${part.pivotY})`:undefined}><VectorShape shape={shape} /></g>})}</svg>
}

export function CustomItemArtwork({ item }) {
  if (item.customType === 'staging') return <svg style={{width:"100%",height:"100%"}} viewBox={`0 0 ${item.widthMeters} ${item.depthMeters}`} aria-hidden="true">
    <rect width={item.widthMeters} height={item.depthMeters} fill={item.fill} fillOpacity={item.fillOpacity} stroke="none" />
    {Array.from({length:Math.max(0,item.widthMeters-1)},(_,index)=><line key={`x-${index}`} x1={index+1} y1="0" x2={index+1} y2={item.depthMeters} stroke={item.sublineColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    {Array.from({length:Math.max(0,item.depthMeters-1)},(_,index)=><line key={`y-${index}`} x1="0" y1={index+1} x2={item.widthMeters} y2={index+1} stroke={item.sublineColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    <rect width={item.widthMeters} height={item.depthMeters} fill="none" stroke={item.line} strokeOpacity={item.lineOpacity} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    {item.showHeight !== false && <text x={item.widthMeters / 2} y={item.depthMeters / 2} fill={item.textColor} stroke="none" fontSize={Math.min(.28, item.depthMeters * .32)} fontWeight="700" textAnchor="middle" dominantBaseline="middle">{item.heightMm}mm</text>}
  </svg>
  if (item.customType === 'text') return <svg style={{width:"100%",height:"100%"}} viewBox={`0 0 ${item.widthMeters} ${item.depthMeters}`} aria-hidden="true"><TextArtwork item={{ ...item, width: item.widthMeters, height: item.depthMeters }} /></svg>
  return null
}

export function EquipmentArtwork({item}) {
  return item.customType ? <CustomItemArtwork item={item}/> : <VectorArtwork shapes={item.shapes} width={item.widthMeters} depth={item.depthMeters} rotationParts={item.rotationParts} controls={item.controls} partVisibility={item.partVisibility}/>;
}
export function FixedEquipmentArtwork({items=[]}) {
  return items.filter(item=>item.visible!==false).map(item=><g key={item.id} transform={`translate(${item.xMeters} ${item.yMeters}) rotate(${item.rotation||0})`}>
    <svg style={{width:item.widthMeters,height:item.depthMeters}} x={-item.widthMeters/2} y={-item.depthMeters/2} width={item.widthMeters} height={item.depthMeters} overflow="visible"><EquipmentArtwork item={item}/></svg>
    {item.showLabel&&<text x="0" y={item.depthMeters/2+.15} textAnchor="middle" fontSize=".15" fill="#25261f" stroke="none">{item.label}</text>}
  </g>);
}
