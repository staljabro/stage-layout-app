import {TextArtwork} from '../text-shape.jsx'
import {textLayout} from '../text-layout.js'
import {vectorPath} from './vector-conversion.js'
import {polygonPoints,hexagonPoints,trapezoidPoints,pointsAttribute,tripodGeometry} from './artwork-geometry.js'
import {ImageLayerArtwork} from '../image-layer.jsx'
function PersonArtwork({ item, seated, common }) {
  const w = item.width;
  const h = item.height;
  const body = {
    ...common,
    fill: "#ffffff",
    fillOpacity: 1,
    strokeLinejoin: "round",
  };
  const head = {
    ...common,
    fill: item.stroke,
    stroke: item.stroke,
    fillOpacity: 1,
  };
  const detail = {
    fill: "none",
    stroke: item.stroke,
    strokeWidth: Math.max(1, item.strokeWidth * 0.7),
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (seated)
    return (
      <>
        <path
          d={`M ${w * 0.31} ${h * 0.25} C ${w * 0.24} ${h * 0.26},${w * 0.2} ${h * 0.32},${w * 0.22} ${h * 0.4} L ${w * 0.31} ${h * 0.6} Q ${w * 0.5} ${h * 0.68},${w * 0.69} ${h * 0.6} L ${w * 0.78} ${h * 0.4} C ${w * 0.8} ${h * 0.32},${w * 0.76} ${h * 0.26},${w * 0.69} ${h * 0.25} L ${w * 0.58} ${h * 0.22} L ${w * 0.42} ${h * 0.22} Z`}
          {...body}
        />
        <path
          d={`M ${w * 0.31} ${h * 0.29} L ${w * 0.2} ${h * 0.35} L ${w * 0.16} ${h * 0.65} L ${w * 0.25} ${h * 0.67} L ${w * 0.29} ${h * 0.43} L ${w * 0.38} ${h * 0.38} Z`}
          {...body}
        />
        <path
          d={`M ${w * 0.69} ${h * 0.29} L ${w * 0.8} ${h * 0.35} L ${w * 0.84} ${h * 0.65} L ${w * 0.75} ${h * 0.67} L ${w * 0.71} ${h * 0.43} L ${w * 0.62} ${h * 0.38} Z`}
          {...body}
        />
        <path
          d={`M ${w * 0.37} ${h * 0.58} L ${w * 0.2} ${h * 0.78} L ${w * 0.27} ${h * 0.84} L ${w * 0.47} ${h * 0.66} Z M ${w * 0.63} ${h * 0.58} L ${w * 0.8} ${h * 0.78} L ${w * 0.73} ${h * 0.84} L ${w * 0.53} ${h * 0.66} Z`}
          {...body}
        />
        <path
          d={`M ${w * 0.2} ${h * 0.78} L ${w * 0.19} ${h * 0.96} L ${w * 0.3} ${h * 0.96} L ${w * 0.32} ${h * 0.81} Z M ${w * 0.8} ${h * 0.78} L ${w * 0.81} ${h * 0.96} L ${w * 0.7} ${h * 0.96} L ${w * 0.68} ${h * 0.81} Z`}
          {...body}
        />
        <ellipse
          cx={w * 0.5}
          cy={h * 0.18}
          rx={w * 0.16}
          ry={h * 0.18}
          {...head}
        />
        <path
          d={`M ${w * 0.39} ${h * 0.31} Q ${w * 0.5} ${h * 0.37},${w * 0.61} ${h * 0.31} M ${w * 0.34} ${h * 0.57} Q ${w * 0.5} ${h * 0.62},${w * 0.66} ${h * 0.57}`}
          {...detail}
        />
      </>
    );
  return (
    <>
      <path
        d={`M ${w * 0.3} ${h * 0.25} C ${w * 0.24} ${h * 0.27},${w * 0.22} ${h * 0.34},${w * 0.25} ${h * 0.43} L ${w * 0.35} ${h * 0.67} L ${w * 0.65} ${h * 0.67} L ${w * 0.75} ${h * 0.43} C ${w * 0.78} ${h * 0.34},${w * 0.76} ${h * 0.27},${w * 0.7} ${h * 0.25} L ${w * 0.58} ${h * 0.22} L ${w * 0.42} ${h * 0.22} Z`}
        {...body}
      />
      <path
        d={`M ${w * 0.31} ${h * 0.29} L ${w * 0.2} ${h * 0.35} L ${w * 0.17} ${h * 0.75} L ${w * 0.26} ${h * 0.75} L ${w * 0.29} ${h * 0.43} L ${w * 0.38} ${h * 0.38} Z M ${w * 0.69} ${h * 0.29} L ${w * 0.8} ${h * 0.35} L ${w * 0.83} ${h * 0.75} L ${w * 0.74} ${h * 0.75} L ${w * 0.71} ${h * 0.43} L ${w * 0.62} ${h * 0.38} Z`}
        {...body}
      />
      <path
        d={`M ${w * 0.38} ${h * 0.64} L ${w * 0.49} ${h * 0.66} L ${w * 0.47} ${h * 0.96} L ${w * 0.36} ${h * 0.96} Z M ${w * 0.51} ${h * 0.66} L ${w * 0.62} ${h * 0.64} L ${w * 0.64} ${h * 0.96} L ${w * 0.53} ${h * 0.96} Z`}
        {...body}
      />
      <ellipse
        cx={w * 0.5}
        cy={h * 0.18}
        rx={w * 0.16}
        ry={h * 0.19}
        {...head}
      />
      <path
        d={`M ${w * 0.39} ${h * 0.31} Q ${w * 0.5} ${h * 0.38},${w * 0.61} ${h * 0.31} M ${w * 0.4} ${h * 0.63} L ${w * 0.6} ${h * 0.63}`}
        {...detail}
      />
    </>
  );
}



export function Shape({
  item,
  selected,
  onPointerDown,
  onHandlePointerDown,
  vectorEditor,
  collisionGuide = false,
  controlUnit,
}) {
  const artworkBounds={x:0,y:0,...(item.type==="text"?textLayout(item):{width:item.width,height:item.height})};
  const common = collisionGuide
    ? {
        fill: "none",
        stroke: "#e05252",
        strokeWidth: 0.7,
        strokeDasharray: "2 1.2",
        vectorEffect: "non-scaling-stroke",
      }
    : {
        fill: item.collisionOnly ? "#d7d9d6" : item.fill,
        stroke: item.collisionOnly ? "#777b77" : item.stroke,
        strokeWidth: item.strokeWidth,
        opacity: item.collisionOnly ? 0.5 : undefined,
        vectorEffect: "non-scaling-stroke",
      };
  let content;
  if (item.type === "image") content = <ImageLayerArtwork shape={item}/>;
  else if (item.type === "compound") content = <g transform={`scale(${item.width / item.artworkWidth} ${item.height / item.artworkHeight})`}>{item.children.map((child,index)=><Shape key={index} item={child}/>)}</g>;
  else if (item.type === "path") content = <path d={item.d} {...common} />;
  else if (item.type === "text") content = <g pointerEvents="none"><TextArtwork item={item} /></g>;
  else if (item.type === "vector") content = <path d={vectorPath(item)} {...common} />;
  else if (item.type === "circle" || item.type === "ellipse")
    content = (
      <ellipse
        cx={item.width / 2}
        cy={item.height / 2}
        rx={item.width / 2}
        ry={item.height / 2}
        {...common}
      />
    );
  else if (item.type === "triangle")
    content = (
      <polygon
        points={`${item.width / 2},0 ${item.width},${item.height} 0,${item.height}`}
        {...common}
      />
    );
  else if (item.type === "line")
    content = (
      <line
        x1="0"
        y1={item.height / 2}
        x2={item.width}
        y2={item.height / 2}
        {...common}
      />
    );
  else if (item.type === "arc")
    content = (
      <path
        d={`M ${item.startX} ${item.startY} Q ${item.controlX} ${item.controlY} ${item.endX} ${item.endY}`}
        {...common}
        fill="none"
      />
    );
  else if (item.type === "tripod") {
    const tripod = tripodGeometry(item);
    content = (
      <path
        d={`M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[0].x} ${tripod.ends[0].y} M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[1].x} ${tripod.ends[1].y} M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[2].x} ${tripod.ends[2].y}`}
        {...common}
        fill="none"
      />
    );
  } else if (item.type === "hexagon" || item.type === "polygon")
    content = (
      <polygon
        points={pointsAttribute(
          item.type === "hexagon"
            ? hexagonPoints(item.width, item.height)
            : polygonPoints(item.width, item.height, item.sides),
        )}
        {...common}
      />
    );
  else if (item.type === "trapezoid")
    content = (
      <polygon points={pointsAttribute(trapezoidPoints(item))} {...common} />
    );
  else if (item.type === "chair")
    content = (
      <>
        <rect
          x={item.width * 0.12}
          y={item.height * 0.2}
          width={item.width * 0.76}
          height={item.height * 0.68}
          rx={item.width * 0.06}
          {...common}
        />
        <rect
          x={item.width * 0.08}
          y="0"
          width={item.width * 0.84}
          height={item.height * 0.24}
          rx={item.width * 0.08}
          {...common}
        />
        <path
          d={`M ${item.width * 0.15} ${item.height * 0.87} V ${item.height} M ${item.width * 0.85} ${item.height * 0.87} V ${item.height}`}
          {...common}
          fill="none"
        />
      </>
    );
  else if (item.type === "seatedPerson")
    content = <PersonArtwork item={item} seated common={common} />;
  else if (item.type === "standingPerson")
    content = <PersonArtwork item={item} common={common} />;
  else
    content = (
      <rect
        width={item.width}
        height={item.height}
        rx={
          item.type === "roundRect"
            ? Math.min(item.width, item.height) * 0.18
            : 0
        }
        {...common}
      />
    );

  const pivot =
    item.type === "tripod"
      ? tripodGeometry(item).hub
      : item.type==='image'?{x:item.width/2,y:item.height/2}:{ x: artworkBounds.width / 2, y: artworkBounds.height / 2 };
  const handleX=item.type==='image'?artworkBounds.x+artworkBounds.width/2:pivot.x;
  return (
    <g
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation} ${pivot.x} ${pivot.y})`}
      onPointerDown={onPointerDown}
      data-shape-id={item.id}
      className={`shape-layer ${collisionGuide ? "collision-guide" : ""}`}
    >
      <g className="shape-artwork">{content}</g>
      {item.type === "text" && !collisionGuide && <rect width={artworkBounds.width} height={artworkBounds.height} fill="transparent" stroke="none" pointerEvents="fill" className="text-shape-hit" />}
      {item.type === "image" && !collisionGuide && <rect x={artworkBounds.x} y={artworkBounds.y} width={artworkBounds.width} height={artworkBounds.height} fill="transparent" stroke="none" pointerEvents="fill" className="image-shape-hit" />}
      {selected && vectorEditor}
      {selected && onHandlePointerDown && <g className="rotation-handles"><line x1={handleX} y1={artworkBounds.y} x2={handleX} y2={artworkBounds.y-(controlUnit?25*controlUnit:.19)}/><circle cx={handleX} cy={artworkBounds.y-(controlUnit?30*controlUnit:.22)} r={controlUnit?5*controlUnit:.03} onPointerDown={event=>onHandlePointerDown(event,"rotate")}><title>Rotate object (Shift: 15-degree steps)</title></circle></g>}
      {selected && !["vector","text","arc"].includes(item.type) && onHandlePointerDown && <g className="shape-handles">{(item.type === "circle" ? [[item.width,item.height/2,"radius"]] : [[artworkBounds.x,artworkBounds.y,"resize-nw"],[artworkBounds.x+artworkBounds.width,artworkBounds.y,"resize-ne"],[artworkBounds.x,artworkBounds.y+artworkBounds.height,"resize-sw"],[artworkBounds.x+artworkBounds.width,artworkBounds.y+artworkBounds.height,"resize-se"]]).map(([x,y,handle]) => <circle key={handle} cx={x} cy={y} r={controlUnit?3*controlUnit:.012} onPointerDown={(event) => onHandlePointerDown?.(event,handle)} />)}</g>}
      {selected && item.type !== "arc" && (
        <rect
          className={`selection${item.type==="text"?" text-selection":item.type==='image'?' image-selection':''}`}
          x={artworkBounds.x-(item.type==='image'?0:.02)}
          y={artworkBounds.y-(item.type==='image'?0:.02)}
          width={artworkBounds.width+(item.type==='image'?0:.04)}
          height={artworkBounds.height+(item.type==='image'?0:.04)}
          style={item.type==='image'?{pointerEvents:'stroke'}:undefined}
          onPointerDown={item.type==='image'?event=>{if(!event.ctrlKey||!onHandlePointerDown)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(event.currentTarget.getScreenCTM().inverse());const edge=Object.entries({left:Math.abs(point.x),right:Math.abs(point.x-item.width),top:Math.abs(point.y),bottom:Math.abs(point.y-item.height)}).sort((a,b)=>a[1]-b[1])[0][0];onHandlePointerDown(event,'crop-'+edge)}:undefined}
        />
      )}
      {selected && item.type === "trapezoid" && (
        <g className="shape-handles">
          <circle
            cx={trapezoidPoints(item)[0].x}
            cy="0"
            r=".012"
            onPointerDown={(event) => onHandlePointerDown?.(event, "left")}
          />
          <circle
            cx={trapezoidPoints(item)[1].x}
            cy="0"
            r=".012"
            onPointerDown={(event) => onHandlePointerDown?.(event, "right")}
          />
          <path d={`M ${item.width / 2 + (item.slew || 0)} -.11 V -.045`} />
          <circle
            cx={item.width / 2 + (item.slew || 0)}
            cy="-.13"
            r=".012"
            onPointerDown={(event) => onHandlePointerDown?.(event, "slew")}
          />
        </g>
      )}
      {selected && item.type === "arc" && (
        <g className="shape-handles arc-handles">
          <circle
            cx={item.startX}
            cy={item.startY}
            r=".012"
            onPointerDown={(event) => onHandlePointerDown?.(event, "arc-start")}
          />
          <circle
            cx={item.endX}
            cy={item.endY}
            r=".012"
            onPointerDown={(event) => onHandlePointerDown?.(event, "arc-end")}
          />
          <circle
            className="control-handle"
            cx={(item.startX + 2 * item.controlX + item.endX) / 4}
            cy={(item.startY + 2 * item.controlY + item.endY) / 4}
            r=".012"
            onPointerDown={(event) =>
              onHandlePointerDown?.(event, "arc-control")
            }
          />
        </g>
      )}
    </g>
  );
}



