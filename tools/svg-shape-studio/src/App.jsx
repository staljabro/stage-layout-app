import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { segmentMode, segmentMidpoint, smoothControl, arcOffset, pointOnArc, bezierGeometry, stageSegmentPath, stagePath, sampleStageBoundary } from "../../../src/stage-geometry.js";
import { isPublishedItem, isEquipmentItem } from "../../library-membership.mjs";
import { objectPivot, normalizeRotation, rotateObjects, rotatedBounds, lockTripodPartPivots } from "./rotation.js";
import { TextArtwork } from "../../../src/text-shape.jsx";
import { sizeText, textSvg } from "../../../src/text-layout.js";
import { convertToVector, vectorPath } from "./vector-conversion.js";
import { equipmentSaveChoice, newAssetId } from "./equipment-save.js";
import { toCentimetres, fromCentimetres } from "./measurements.js";
import { readSessionDraft, useSessionDraft } from "../../../src/session-draft.js";
import { selectionBox, enclosedItems, containsBounds } from "../../../src/marquee.js";
import { stageControlPoints, nearestControl } from "./stage-controls.js";
import { drawingEndpoint, finishDrawnVector } from "./vector-drawing.js";
import { advancedPresetId, instantiateAdvancedShape, removeCustomShapeMembership } from "./advanced-shapes.js";
import { StudioHelp } from "../../../src/help-dialog.jsx";

const API_BASE = (import.meta.env.VITE_LIBRARY_API_URL || (import.meta.env.DEV ? "http://127.0.0.1:8787/api" : "/api")).replace(/\/$/, "");
const LIBRARY_API = `${API_BASE}/items`;
const STAGES_API = `${API_BASE}/stages`;
const GROUPS_API = `${API_BASE}/groups`;
const MeasurementUnit = createContext("cm");

const roundDimension = value => Number(value.toFixed(2));
function useDimensionState(initialValue) {
  const [value, setValue] = useState(initialValue);
  const normalize = entry => {
    if (typeof entry === "number") return roundDimension(entry);
    const result = {...entry};
    if (result.type === "text") return sizeText(result);
    for (const key of ["width", "height", "legRadius"]) {
      if (typeof result[key] === "number") result[key] = roundDimension(result[key]);
    }
    return result;
  };
  const updateValue = next => setValue(previous => {
    const result = typeof next === "function" ? next(previous) : next;
    return Array.isArray(result) ? result.map(normalize) : normalize(result);
  });
  return [value, updateValue];
}

function CommittedNumberInput({ value, onChange, min, max, ...props }) {
  const metres = useContext(MeasurementUnit) === "m";
  const scale = metres ? 1 : 100;
  const format = entry => metres ? Number(entry).toFixed(2) : String(toCentimetres(entry));
  const formattedValue = format(value);
  const commit = (event) => {
    const input = event.currentTarget;
    const number = input.value.trim() === "" ? NaN : Number(input.value);
    if (!Number.isFinite(number)) {
      input.value = formattedValue;
      return;
    }
    const boundedInput = Math.min(max === undefined ? Infinity : Number(max) * scale, Math.max(min === undefined ? -Infinity : Number(min) * scale, number));
    const bounded = metres ? roundDimension(boundedInput) : fromCentimetres(boundedInput);
    input.value = format(bounded);
    if (bounded !== Number(value)) onChange?.({ target: { value: String(bounded) } });
  };
  return <input {...props} key={`${metres}:${value}`} type="number" step={metres ? ".01" : "1"} min={min === undefined ? undefined : Number(min) * scale} max={max === undefined ? undefined : Number(max) * scale} defaultValue={formattedValue} onBlur={commit} onKeyDown={event=>{
    if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
    if (event.key === "Escape") { event.currentTarget.value = formattedValue; event.currentTarget.blur(); }
  }}/>;
}

function LiveNumberInput({ value, onChange, min, centimetres = false, ...props }) {
  const scale = centimetres ? 100 : 1;
  const displayValue = centimetres ? toCentimetres(value) : value;
  const [draft, setDraft] = useState(String(displayValue));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(displayValue));
  }, [displayValue]);
  return <input {...props} type="number" step={centimetres ? 1 : props.step} min={min * scale} value={draft}
    onFocus={() => { focused.current = true; }}
    onChange={event => {
      setDraft(event.target.value);
      const number = centimetres ? fromCentimetres(event.target.value) : Number(event.target.value);
      if (event.target.value.trim() !== "" && Number.isFinite(number) && number >= min) onChange(number);
    }}
    onBlur={() => { focused.current = false; setDraft(String(displayValue)); }}
  />;
}

const PALETTE = [
  { type: "rect", label: "Rectangle", glyph: "□" },
  { type: "roundRect", label: "Rounded", glyph: "▢" },
  { type: "circle", label: "Circle", glyph: "○" },
  { type: "ellipse", label: "Ellipse", glyph: "⬭" },
  { type: "triangle", label: "Triangle", glyph: "△" },
  { type: "line", label: "Line", glyph: "╱" },
  { type: "text", label: "Text", glyph: "T" },
  { type: "tripod", label: "Tripod base", glyph: "Y" },
];

const ADVANCED_PALETTE = [
  { type: "arc", label: "Arc", glyph: "\u2312" },
  { type: "vector", label: "Vector", glyph: "\u25c7" },
  { type: "drawVector", label: "Custom vector", glyph: "✎" },
  { type: "trapezoid", label: "Trapezoid", glyph: "▱" },
  { type: "polygon", label: "Polygon", glyph: "⬠" },
];

const DEFAULTS = {
  text: { width: .4, height: .2, text: "Text", fontSize: .2, bold: false, italic: false, textAlign: "left", lineSpacing: 1.2 },
  vector: { width: .6, height: .4 },
  rect: { width: 0.6, height: 0.4 },
  roundRect: { width: 0.6, height: 0.4 },
  circle: { width: 0.4, height: 0.4 },
  ellipse: { width: 0.6, height: 0.35 },
  triangle: { width: 0.5, height: 0.45 },
  line: { width: 0.6, height: 0.03 },
  arc: {
    width: 0.7,
    height: 0.4,
    startX: 0,
    startY: 0.35,
    endX: 0.7,
    endY: 0.35,
    controlX: 0.35,
    controlY: 0,
  },
  tripod: { width: 0.693, height: 0.6, legRadius: 0.4 },
  hexagon: { width: 0.6, height: 0.6 },
  trapezoid: {
    width: 0.8,
    height: 0.55,
    leftInset: 0.14,
    rightInset: 0.14,
    slew: 0,
  },
  polygon: { width: 0.6, height: 0.6, sides: 5 },
  chair: { width: 0.47, height: 0.52 },
  seatedPerson: { width: 0.6, height: 0.65 },
  standingPerson: { width: 0.6, height: 0.4 },
};

const polygonPoints = (width, height, sides = 6) =>
  Array.from({ length: Math.max(3, sides) }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(3, sides);
    return {
      x: width / 2 + (Math.cos(angle) * width) / 2,
      y: height / 2 + (Math.sin(angle) * height) / 2,
    };
  });

const hexagonPoints = (width, height) => [
  { x: width * 0.25, y: 0 },
  { x: width * 0.75, y: 0 },
  { x: width, y: height * 0.5 },
  { x: width * 0.75, y: height },
  { x: width * 0.25, y: height },
  { x: 0, y: height * 0.5 },
];

const trapezoidPoints = (item) => {
  const left = (item.leftInset || 0) + (item.slew || 0);
  const right = item.width - (item.rightInset || 0) + (item.slew || 0);
  return [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: item.width, y: item.height },
    { x: 0, y: item.height },
  ];
};

const pointsAttribute = (points) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const tripodGeometry = (item) => {
  const radius = item.legRadius ?? item.width / Math.sqrt(3);
  const hub = { x: (Math.sqrt(3) / 2) * radius, y: radius };
  return {
    radius,
    width: Math.sqrt(3) * radius,
    height: radius * 1.5,
    hub,
    ends: [
      { x: hub.x, y: 0 },
      { x: Math.sqrt(3) * radius, y: radius * 1.5 },
      { x: 0, y: radius * 1.5 },
    ],
  };
};

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

const slug = (value) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/(?:^|\s)(\w)/g, (_, c) => c.toUpperCase()) || "CustomShape";
const libraryId = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled-item";

const defaultStageNodes = (width, depth) => [
  { x: 0, y: 0, curveMode: "line" },
  { x: width, y: 0, curveMode: "line" },
  { x: width, y: depth, curveMode: "line" },
  { x: 0, y: depth, curveMode: "line" },
];

const resizeShape = (item, changes) => {
  if (item.type === "text") return sizeText({ ...item, ...changes });
  const width = Math.max(.01, changes.width ?? item.width), height = Math.max(.01, changes.height ?? item.height);
  const sx = width/item.width, sy = height/item.height;
  const result = {...item,...changes,width,height};
  if (sx === 1 && sy === 1) return result;
  for (const key of ["startX","endX","controlX","leftInset","rightInset","slew"]) if (Number.isFinite(item[key])) result[key]=item[key]*sx;
  for (const key of ["startY","endY","controlY"]) if (Number.isFinite(item[key])) result[key]=item[key]*sy;
  if (item.type === "tripod") { result.legRadius=width/Math.sqrt(3); result.height=result.legRadius*1.5; }
  if (item.nodes) result.nodes=item.nodes.map((node,index)=>{
    const next={...node,x:node.x*sx,y:node.y*sy};
    for(const key of ["cx","arcX","mx","startOutX","midInX","midOutX","endInX"]) if(Number.isFinite(node[key])) next[key]=node[key]*sx;
    for(const key of ["cy","arcY","my","startOutY","midInY","midOutY","endInY"]) if(Number.isFinite(node[key])) next[key]=node[key]*sy;
    const previous=item.nodes[(index-1+item.nodes.length)%item.nodes.length];
    if(segmentMode(node)==="pointArc") { const point=pointOnArc(previous,node); next.arcDepth=arcOffset({x:previous.x*sx,y:previous.y*sy},next,{x:point.x*sx,y:point.y*sy}); }
    if(Number.isFinite(node.bulge)){const control=smoothControl(previous,node);next.cx=control.x*sx;next.cy=control.y*sy;next.bulge=undefined;}
    return next;
  });
  return result;
};
const moveVectorHandle = (original,handle,dx,dy,snap) => {
  const [,indexValue,kind]=handle.split(":"); const index=+indexValue;
  const nodes=structuredClone(original.nodes),node=nodes[index],previous=nodes[(index-1+nodes.length)%nodes.length];
  const base=kind==="node"?node:kind==="pointArc"?pointOnArc(previous,node):kind==="smooth"?smoothControl(previous,node):bezierGeometry(previous,node)[kind];
  const point={x:snap(base.x+dx),y:snap(base.y+dy)};
  if(kind==="node")Object.assign(node,point);
  else if(kind==="pointArc")Object.assign(node,{arcDepth:arcOffset(previous,node,point),arcX:undefined,arcY:undefined});
  else if(kind==="smooth")Object.assign(node,{cx:point.x,cy:point.y,bulge:undefined});
  else if(kind==="midpoint") {const g=bezierGeometry(previous,node);Object.assign(node,{mx:point.x,my:point.y,midInX:g.midIn.x+point.x-base.x,midInY:g.midIn.y+point.y-base.y,midOutX:g.midOut.x+point.x-base.x,midOutY:g.midOut.y+point.y-base.y});}
  else Object.assign(node,{[kind+"X"]:point.x,[kind+"Y"]:point.y});
  return {...original,nodes};
};
function VectorEditor({item,index,onSelect,onDrag,onInsert,onCurve}) {
  return <g>{item.nodes.map((node,i)=>{
    if (item.open && i === 0) return null;
    const previous=item.nodes[(i-1+item.nodes.length)%item.nodes.length],mode=segmentMode(node);
    return <path key={i} className="segment-hit" d={`M ${previous.x} ${previous.y} ${stageSegmentPath(previous,node)}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onSelect(i);if(event.shiftKey && mode === "line")onInsert(i);else if(event.ctrlKey)onCurve(i);}} />;
  })}{item.nodes.map((node,i)=>{
    const previous=item.nodes[(i-1+item.nodes.length)%item.nodes.length],mode=segmentMode(node);
    const handles=item.open && i===0 ? [] : mode==="pointArc"?[["pointArc",pointOnArc(previous,node)]]:mode==="smooth"?[["smooth",smoothControl(previous,node)]]:mode==="bezier"?Object.entries(bezierGeometry(previous,node)):[];
    return <g key={i}>
      <circle className={index===i?"boundary-node selected":"boundary-node"} cx={node.x} cy={node.y} r=".025" onPointerDown={event=>{onSelect(i);onDrag(event,`vector:${i}:node`);}} />
      {index===i && handles.map(([kind,point])=><circle key={kind} className={kind==="midpoint"||kind==="pointArc"||kind==="smooth"?"curve-control":"bezier-control"} cx={point.x} cy={point.y} r=".025" onPointerDown={event=>onDrag(event,`vector:${i}:${kind}`)} />)}
    </g>;
  })}</g>;
}


const PRESET_COLOURS = [
  ["Black", "#191919"], ["Dark walnut", "#49352b"], ["Warm brown", "#80634c"],
  ["Brass", "#a58a4b"], ["White", "#f5f5f0"], ["Cream", "#e6dcc3"],
  ["Charcoal", "#454642"], ["Muted olive", "#656b50"], ["Burgundy", "#694249"], ["Slate", "#59636b"],
];
function ColourPicker({value,onChange}) {
  return <div className="colour-picker">
    <div className="colour-presets">{PRESET_COLOURS.map(([name,colour])=><button type="button" key={colour} title={name} aria-label={name} aria-pressed={value?.toLowerCase()===colour} style={{background:colour}} onClick={()=>onChange({target:{value:colour}})} />)}</div>
    <input type="color" value={value} onChange={onChange} aria-label="Custom colour" />
  </div>;
}
function ReferenceInspector({referenceImage,setReferenceImage}) {
  const unit = useContext(MeasurementUnit).toUpperCase();
  return (                <>
                  <p className="eyebrow advanced-title">REFERENCE IMAGE</p>
                  <div className="field-row">
                    <label className="field">
                      X ({unit})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={referenceImage.x}
                        onChange={(e) =>
                          setReferenceImage({
                            ...referenceImage,
                            x: +e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Y ({unit})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={referenceImage.y}
                        onChange={(e) =>
                          setReferenceImage({
                            ...referenceImage,
                            y: +e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      WIDTH ({unit})
                      <CommittedNumberInput
                        type="number"
                        min=".05"
                        step="0.01"
                        value={referenceImage.width}
                        onChange={(e) => {
                          const width = +e.target.value;
                          setReferenceImage({
                            ...referenceImage,
                            width,
                            height:
                              (referenceImage.lockAspect ?? true)
                                ? width /
                                  (referenceImage.aspectRatio ||
                                    referenceImage.width /
                                      referenceImage.height)
                                : referenceImage.height,
                          });
                        }}
                      />
                    </label>
                    <label className="field">
                      HEIGHT ({unit})
                      <CommittedNumberInput
                        type="number"
                        min=".05"
                        step="0.01"
                        value={referenceImage.height}
                        onChange={(e) => {
                          const height = +e.target.value;
                          setReferenceImage({
                            ...referenceImage,
                            height,
                            width:
                              (referenceImage.lockAspect ?? true)
                                ? height *
                                  (referenceImage.aspectRatio ||
                                    referenceImage.width /
                                      referenceImage.height)
                                : referenceImage.width,
                          });
                        }}
                      />
                    </label>
                  </div>
                  <label className="collision-toggle">
                    <input
                      type="checkbox"
                      checked={referenceImage.lockAspect ?? true}
                      onChange={(e) =>
                        setReferenceImage({
                          ...referenceImage,
                          lockAspect: e.target.checked,
                          aspectRatio:
                            referenceImage.width / referenceImage.height,
                        })
                      }
                    />
                    <span>
                      <b>Lock aspect ratio</b>
                      <small>
                        Preserve the image proportions while resizing.
                      </small>
                    </span>
                  </label>
                  <label className="collision-toggle">
                    <input type="checkbox" checked={referenceImage.locked ?? false} onChange={(e) => setReferenceImage({ ...referenceImage, locked: e.target.checked })} />
                    <span><b>Lock background image</b><small>Locked images can only be selected from the Assets list.</small></span>
                  </label>
                  <p className="handle-help">Hold Ctrl and drag an edge of the image frame to crop it.</p>
                  <button className="delete" onClick={() => setReferenceImage(null)}>Remove background image</button>
                  <label className="field">
                    OPACITY{" "}
                    <span>{Math.round(referenceImage.opacity * 100)}%</span>
                    <input
                      type="range"
                      min=".05"
                      max="1"
                      step=".05"
                      value={referenceImage.opacity}
                      onChange={(e) =>
                        setReferenceImage({
                          ...referenceImage,
                          opacity: +e.target.value,
                        })
                      }
                    />
                  </label>
                </>
);
}
function EquipmentReferences({images,selectedImage,onDrag,onCrop}) {
  return <g className="equipment-references">{[...images].sort((a,b)=>(a.zOrder??0)-(b.zOrder??0)).map(image=><svg key={image.id} className={image.locked?"ordered-reference locked":"ordered-reference"} x={image.x} y={image.y} width={image.width} height={image.height} viewBox={`${image.crop?.left||0} ${image.crop?.top||0} ${1-(image.crop?.left||0)-(image.crop?.right||0)} ${1-(image.crop?.top||0)-(image.crop?.bottom||0)}`} preserveAspectRatio="none" opacity={image.opacity} overflow="hidden" onPointerDown={image.locked?undefined:event=>onDrag(event,"image-move",image)}><image href={image.dataUrl} width="1" height="1" preserveAspectRatio="none" /></svg>)}
    {selectedImage && <><rect className="reference-image-frame" x={selectedImage.x} y={selectedImage.y} width={selectedImage.width} height={selectedImage.height} pointerEvents={selectedImage.locked?"none":"stroke"} onPointerDown={onCrop}/>{!selectedImage.locked && <circle className="image-resize" cx={selectedImage.x+selectedImage.width} cy={selectedImage.y+selectedImage.height} r=".025" onPointerDown={event=>onDrag(event,"image-resize",selectedImage)}/>}</>}
  </g>;
}

function Shape({
  item,
  selected,
  onPointerDown,
  onHandlePointerDown,
  vectorEditor,
  collisionGuide = false,
}) {
  const common = collisionGuide
    ? {
        fill: "none",
        stroke: "#e05252",
        strokeWidth: 0.7,
        strokeDasharray: "2 1.2",
        vectorEffect: "non-scaling-stroke",
      }
    : {
        fill: item.fill,
        stroke: item.stroke,
        strokeWidth: item.strokeWidth,
        vectorEffect: "non-scaling-stroke",
      };
  let content;
  if (item.type === "compound") content = <g transform={`scale(${item.width / item.artworkWidth} ${item.height / item.artworkHeight})`}>{item.children.map((child,index)=><Shape key={index} item={child}/>)}</g>;
  else if (item.type === "path") content = <path d={item.d} {...common} />;
  else if (item.type === "text") content = <TextArtwork item={item} />;
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
      : { x: item.width / 2, y: item.height / 2 };
  return (
    <g
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation} ${pivot.x} ${pivot.y})`}
      onPointerDown={onPointerDown}
      data-shape-id={item.id}
      className={`shape-layer ${collisionGuide ? "collision-guide" : ""}`}
    >
      <g className="shape-artwork">{content}</g>
      {item.type === "text" && !collisionGuide && <rect width={item.width} height={item.height} fill="transparent" stroke="none" className="text-shape-hit" />}
      {selected && vectorEditor}
      {selected && onHandlePointerDown && <g className="rotation-handles"><line x1={pivot.x} y1="0" x2={pivot.x} y2="-.19"/><circle cx={pivot.x} cy="-.22" r=".03" onPointerDown={event=>onHandlePointerDown(event,"rotate")}><title>Rotate object (Shift: 15-degree steps)</title></circle></g>}
      {selected && !["vector","text","arc"].includes(item.type) && onHandlePointerDown && <g className="shape-handles">{(item.type === "circle" ? [[item.width,item.height/2,"radius"]] : [[0,0,"resize-nw"],[item.width,0,"resize-ne"],[0,item.height,"resize-sw"],[item.width,item.height,"resize-se"]]).map(([x,y,handle]) => <circle key={handle} cx={x} cy={y} r=".035" onPointerDown={(event) => onHandlePointerDown?.(event,handle)} />)}</g>}
      {selected && item.type !== "arc" && (
        <rect
          className="selection"
          x="-.02"
          y="-.02"
          width={item.width + 0.04}
          height={item.height + 0.04}
        />
      )}
      {selected && item.type === "trapezoid" && (
        <g className="shape-handles">
          <circle
            cx={trapezoidPoints(item)[0].x}
            cy="0"
            r=".035"
            onPointerDown={(event) => onHandlePointerDown?.(event, "left")}
          />
          <circle
            cx={trapezoidPoints(item)[1].x}
            cy="0"
            r=".035"
            onPointerDown={(event) => onHandlePointerDown?.(event, "right")}
          />
          <path d={`M ${item.width / 2 + (item.slew || 0)} -.11 V -.045`} />
          <circle
            cx={item.width / 2 + (item.slew || 0)}
            cy="-.13"
            r=".035"
            onPointerDown={(event) => onHandlePointerDown?.(event, "slew")}
          />
        </g>
      )}
      {selected && item.type === "arc" && (
        <g className="shape-handles arc-handles">
          <circle
            cx={item.startX}
            cy={item.startY}
            r=".035"
            onPointerDown={(event) => onHandlePointerDown?.(event, "arc-start")}
          />
          <circle
            cx={item.endX}
            cy={item.endY}
            r=".035"
            onPointerDown={(event) => onHandlePointerDown?.(event, "arc-end")}
          />
          <circle
            className="control-handle"
            cx={(item.startX + 2 * item.controlX + item.endX) / 4}
            cy={(item.startY + 2 * item.controlY + item.endY) / 4}
            r=".04"
            onPointerDown={(event) =>
              onHandlePointerDown?.(event, "arc-control")
            }
          />
        </g>
      )}
    </g>
  );
}

function svgElement(item) {
  const attrs = `fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" vector-effect="non-scaling-stroke"`;
  const pivot =
    item.type === "tripod"
      ? tripodGeometry(item).hub
      : { x: item.width / 2, y: item.height / 2 };
  const transform = `transform="translate(${item.x} ${item.y}) rotate(${item.rotation} ${pivot.x} ${pivot.y})"`;
  let node;
  if (item.type === "compound") node = `<g transform="scale(${item.width / item.artworkWidth} ${item.height / item.artworkHeight})">${item.children.map(svgElement).join("\n")}</g>`;
  else if (item.type === "path") node = `<path d="${item.d}" ${attrs} />`;
  else if (item.type === "text") node = textSvg(item);
  else if (item.type === "vector") node = `<path d="${vectorPath(item)}" ${attrs} />`;
  else if (item.type === "circle" || item.type === "ellipse")
    node = `<ellipse cx="${item.width / 2}" cy="${item.height / 2}" rx="${item.width / 2}" ry="${item.height / 2}" ${attrs} />`;
  else if (item.type === "triangle")
    node = `<polygon points="${item.width / 2},0 ${item.width},${item.height} 0,${item.height}" ${attrs} />`;
  else if (item.type === "line")
    node = `<line x1="0" y1="${item.height / 2}" x2="${item.width}" y2="${item.height / 2}" ${attrs} />`;
  else if (item.type === "arc")
    node = `<path d="M ${item.startX} ${item.startY} Q ${item.controlX} ${item.controlY} ${item.endX} ${item.endY}" fill="none" ${attrs} />`;
  else if (item.type === "tripod") {
    const tripod = tripodGeometry(item);
    node = `<path d="M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[0].x} ${tripod.ends[0].y} M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[1].x} ${tripod.ends[1].y} M ${tripod.hub.x} ${tripod.hub.y} L ${tripod.ends[2].x} ${tripod.ends[2].y}" fill="none" ${attrs} />`;
  } else if (item.type === "hexagon" || item.type === "polygon")
    node = `<polygon points="${pointsAttribute(item.type === "hexagon" ? hexagonPoints(item.width, item.height) : polygonPoints(item.width, item.height, item.sides))}" ${attrs} />`;
  else if (item.type === "trapezoid")
    node = `<polygon points="${pointsAttribute(trapezoidPoints(item))}" ${attrs} />`;
  else if (item.type === "seatedPerson")
    node = `<path d="M ${item.width * 0.38} ${item.height * 0.12} C ${item.width * 0.3} ${item.height * 0.13},${item.width * 0.22} ${item.height * 0.13},${item.width * 0.17} ${item.height * 0.19} C ${item.width * 0.12} ${item.height * 0.27},${item.width * 0.1} ${item.height * 0.36},${item.width * 0.08} ${item.height * 0.44} L ${item.width * 0.12} ${item.height * 0.56} Q ${item.width * 0.13} ${item.height * 0.61},${item.width * 0.21} ${item.height * 0.61} L ${item.width * 0.22} ${item.height * 0.7} Q ${item.width * 0.23} ${item.height * 0.76},${item.width * 0.31} ${item.height * 0.74} L ${item.width * 0.34} ${item.height * 0.94} Q ${item.width * 0.35} ${item.height},${item.width * 0.43} ${item.height * 0.99} L ${item.width * 0.48} ${item.height * 0.68} Q ${item.width * 0.5} ${item.height * 0.58},${item.width * 0.52} ${item.height * 0.68} L ${item.width * 0.57} ${item.height * 0.99} Q ${item.width * 0.65} ${item.height},${item.width * 0.66} ${item.height * 0.94} L ${item.width * 0.69} ${item.height * 0.74} Q ${item.width * 0.77} ${item.height * 0.76},${item.width * 0.78} ${item.height * 0.7} L ${item.width * 0.79} ${item.height * 0.61} Q ${item.width * 0.87} ${item.height * 0.61},${item.width * 0.88} ${item.height * 0.56} L ${item.width * 0.92} ${item.height * 0.44} C ${item.width * 0.9} ${item.height * 0.36},${item.width * 0.88} ${item.height * 0.27},${item.width * 0.83} ${item.height * 0.19} C ${item.width * 0.78} ${item.height * 0.13},${item.width * 0.7} ${item.height * 0.13},${item.width * 0.62} ${item.height * 0.12} Z" ${attrs} /><ellipse cx="${item.width * 0.5}" cy="${item.height * 0.17}" rx="${item.width * 0.18}" ry="${item.height * 0.17}" ${attrs} /><path d="M ${item.width * 0.37} ${item.height * 0.27} Q ${item.width * 0.5} ${item.height * 0.34},${item.width * 0.63} ${item.height * 0.27} M ${item.width * 0.22} ${item.height * 0.32} Q ${item.width * 0.2} ${item.height * 0.46},${item.width * 0.21} ${item.height * 0.56} M ${item.width * 0.78} ${item.height * 0.32} Q ${item.width * 0.8} ${item.height * 0.46},${item.width * 0.79} ${item.height * 0.56} M ${item.width * 0.28} ${item.height * 0.54} Q ${item.width * 0.5} ${item.height * 0.59},${item.width * 0.72} ${item.height * 0.54} M ${item.width * 0.5} ${item.height * 0.62} L ${item.width * 0.5} ${item.height * 0.82}" fill="none" ${attrs} />`;
  else if (item.type === "standingPerson")
    node = `<path d="M ${item.width * 0.38} ${item.height * 0.12} C ${item.width * 0.29} ${item.height * 0.13},${item.width * 0.2} ${item.height * 0.14},${item.width * 0.13} ${item.height * 0.19} C ${item.width * 0.06} ${item.height * 0.24},${item.width * 0.07} ${item.height * 0.34},${item.width * 0.14} ${item.height * 0.39} Q ${item.width * 0.19} ${item.height * 0.43},${item.width * 0.25} ${item.height * 0.4} Q ${item.width * 0.31} ${item.height * 0.54},${item.width * 0.5} ${item.height * 0.57} Q ${item.width * 0.69} ${item.height * 0.54},${item.width * 0.75} ${item.height * 0.4} Q ${item.width * 0.81} ${item.height * 0.43},${item.width * 0.86} ${item.height * 0.39} C ${item.width * 0.93} ${item.height * 0.34},${item.width * 0.94} ${item.height * 0.24},${item.width * 0.87} ${item.height * 0.19} C ${item.width * 0.8} ${item.height * 0.14},${item.width * 0.71} ${item.height * 0.13},${item.width * 0.62} ${item.height * 0.12} Z" ${attrs} /><rect x="${item.width * 0.31}" y="${item.height * 0.47}" width="${item.width * 0.17}" height="${item.height * 0.45}" rx="${item.width * 0.08}" ${attrs} /><rect x="${item.width * 0.52}" y="${item.height * 0.47}" width="${item.width * 0.17}" height="${item.height * 0.45}" rx="${item.width * 0.08}" ${attrs} /><ellipse cx="${item.width * 0.5}" cy="${item.height * 0.2}" rx="${item.width * 0.18}" ry="${item.height * 0.23}" ${attrs} /><path d="M ${item.width * 0.37} ${item.height * 0.34} Q ${item.width * 0.5} ${item.height * 0.43},${item.width * 0.63} ${item.height * 0.34}" fill="none" ${attrs} />`;
  else
    node = `<rect width="${item.width}" height="${item.height}" rx="${item.type === "roundRect" ? Math.min(item.width, item.height) * 0.18 : 0}" ${attrs} />`;
  return `  <g ${transform}>${node}</g>`;
}

function collisionFromLayer(item) {
  const rotatePoint = (point) => {
    const angle = ((item.rotation || 0) * Math.PI) / 180;
    const pivot =
      item.type === "tripod"
        ? tripodGeometry(item).hub
        : { x: item.width / 2, y: item.height / 2 };
    const x = point.x - pivot.x;
    const y = point.y - pivot.y;
    return {
      x: item.x + pivot.x + x * Math.cos(angle) - y * Math.sin(angle),
      y: item.y + pivot.y + x * Math.sin(angle) + y * Math.cos(angle),
    };
  };
  if (item.type === "vector") return { type: "polygon", points: sampleStageBoundary(item.nodes,48).map(rotatePoint) };
  if (item.type === "trapezoid")
    return { type: "polygon", points: trapezoidPoints(item).map(rotatePoint) };
  if (item.type === "hexagon" || item.type === "polygon")
    return {
      type: "polygon",
      points: (item.type === "hexagon"
        ? hexagonPoints(item.width, item.height)
        : polygonPoints(item.width, item.height, item.sides)
      ).map(rotatePoint),
    };
  if (item.type === "tripod")
    return {
      type: "polygon",
      points: tripodGeometry(item).ends.map(rotatePoint),
    };
  if (item.type === "seatedPerson" || item.type === "standingPerson")
    return {
      type: "ellipse",
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      rotation: item.rotation,
    };
  return {
    type:
      item.type === "circle"
        ? "ellipse"
        : item.type === "roundRect" || item.type === "chair"
          ? "rect"
          : item.type,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    rotationPartId: item.rotationPartId,
  };
}

function collisionLayers(item) {
  if (item.type !== "compound") return item.collision ? [collisionFromLayer(item)] : [];
  const angle = (item.rotation || 0) * Math.PI / 180;
  const transform = ({x, y}) => {
    const dx = x * item.width / item.artworkWidth - item.width / 2;
    const dy = y * item.height / item.artworkHeight - item.height / 2;
    return {x:item.x + item.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),y:item.y + item.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle)};
  };
  return item.children.flatMap(collisionLayers).map(shape => {
    let points = shape.points;
    if (!points) {
      const rotation = (shape.rotation || 0) * Math.PI / 180;
      const local = shape.type === "ellipse"
        ? Array.from({length:64}, (_,i)=>({x:shape.width / 2 * Math.cos(i * Math.PI / 32),y:shape.height / 2 * Math.sin(i * Math.PI / 32)}))
        : [{x:-shape.width/2,y:-shape.height/2},{x:shape.width/2,y:-shape.height/2},{x:shape.width/2,y:shape.height/2},{x:-shape.width/2,y:shape.height/2}];
      points = local.map(({x,y})=>({x:shape.x + shape.width/2 + x*Math.cos(rotation)-y*Math.sin(rotation),y:shape.y + shape.height/2 + x*Math.sin(rotation)+y*Math.cos(rotation)}));
    }
    return {type:"polygon",points:points.map(transform),rotationPartId:shape.rotationPartId};
  });
}

function CollisionGuide({ item }) {
  const collision = collisionFromLayer(item);
  const common = {
    fill: "none",
    stroke: "#e05252",
    strokeWidth: 0.7,
    strokeDasharray: "2 1.2",
    vectorEffect: "non-scaling-stroke",
    pointerEvents: "none",
  };
  if (collision.type === "polygon")
    return <polygon points={pointsAttribute(collision.points)} {...common} />;
  const transform = `translate(${collision.x} ${collision.y}) rotate(${collision.rotation || 0} ${collision.width / 2} ${collision.height / 2})`;
  if (collision.type === "ellipse")
    return (
      <ellipse
        transform={transform}
        cx={collision.width / 2}
        cy={collision.height / 2}
        rx={collision.width / 2}
        ry={collision.height / 2}
        {...common}
      />
    );
  if (collision.type === "line")
    return (
      <line
        transform={transform}
        x1="0"
        y1={collision.height / 2}
        x2={collision.width}
        y2={collision.height / 2}
        {...common}
      />
    );
  return (
    <rect
      transform={transform}
      width={collision.width}
      height={collision.height}
      {...common}
    />
  );
}

function App() {
  const [session] = useState(() => readSessionDraft("shape-studio:draft"));
  const [documentMode, setDocumentMode] = useState(session.documentMode ?? "item");
  const [shapeName, setShapeName] = useState(session.shapeName ?? "Untitled Item");
  const [realWidth, setRealWidth] = useDimensionState(session.realWidth ?? 1);
  const [realDepth, setRealDepth] = useDimensionState(session.realDepth ?? 1);
  const [groupId, setGroupId] = useState(session.groupId ?? "");
  const [items, setItems] = useDimensionState(session.items ?? []);
  const [rotationParts, setRotationParts] = useState(session.rotationParts ?? []);
  const [cornerSnapping, setCornerSnapping] = useState(session.cornerSnapping ?? false);
  const [selectedId, setSelectedId] = useState(null);
  const [vectorNodeIndex, setVectorNodeIndex] = useState(null);
  const [vectorDrawing, setVectorDrawing] = useState(session.vectorDrawing ?? null);
  const [vectorPreview, setVectorPreview] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [history, setHistory] = useState([]);
  const [snapMode, setSnapMode] = useState(session.snapMode ?? "standard");
  const [grid, setGrid] = useState(session.grid ?? true);
  const [toast, setToast] = useState("");
  const [helpOpen,setHelpOpen]=useState(false);
  const [library, setLibrary] = useState([]);
  const [advancedShapeRole, setAdvancedShapeRole] = useState(session.advancedShapeRole ?? null);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const [shapeSaving, setShapeSaving] = useState(false);
  const [stageSaveAsOpen, setStageSaveAsOpen] = useState(false);
  const [stageSaveAsName, setStageSaveAsName] = useState("");
  const [saveChoice, setSaveChoice] = useState(null);
  const [manageCustomOpen, setManageCustomOpen] = useState(false);
  const [removingPresetId, setRemovingPresetId] = useState(null);
  const [manageStageplotOpen, setManageStageplotOpen] = useState(false);
  const [manageGroupsOpen, setManageGroupsOpen] = useState(false);
  const [managedItemSearch, setManagedItemSearch] = useState("");
  const [managedGroupSearch, setManagedGroupSearch] = useState("");
  const [groupsSaving, setGroupsSaving] = useState(false);
  const [editingItemNameId, setEditingItemNameId] = useState(null);
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [editingStageNameId, setEditingStageNameId] = useState(null);
  const [stageNameDraft, setStageNameDraft] = useState("");
  const [editingEquipmentGroupId, setEditingEquipmentGroupId] = useState(null);
  const [equipmentGroupDraft, setEquipmentGroupDraft] = useState("");
  const savedProject = useRef(session.savedProject ?? null);
  const resetProjectBaseline = useRef(false);
  const [removingStageplotId, setRemovingStageplotId] = useState(null);
  const [stageLibrary, setStageLibrary] = useState([]);
  const [stageNodes, setStageNodes] = useState(session.stageNodes ?? defaultStageNodes(1, 1));
  const [selectedStageNode, setSelectedStageNode] = useState(null);
  const [referenceImages, setReferenceImages] = useDimensionState(session.referenceImages ?? []);
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const [zones, setZones] = useState(session.zones ?? []);
  const [textItems, setTextItems] = useState(session.textItems ?? []);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [canvasResizeEnabled, setCanvasResizeEnabled] = useState(session.canvasResizeEnabled ?? false);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedStageAssetIds, setSelectedStageAssetIds] = useState([]);
  const [stageNodesExpanded, setStageNodesExpanded] = useState(false);
  const [stageBoundaryLocked, setStageBoundaryLocked] = useState(session.stageBoundaryLocked ?? false);
  const [groups, setGroups] = useState([]);
  const [activeLibraryId, setActiveLibraryId] = useState(session.activeLibraryId ?? null);
  const [draftAssetId, setDraftAssetId] = useState(() => session.draftAssetId ?? newAssetId(session.documentMode === "stage" ? "stage" : "item"));
  const [libraryError, setLibraryError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [zoom, setZoom] = useState(session.zoom ?? 1);
  const [pan, setPan] = useState(session.pan ?? { x: 0, y: 0 });
  const [canvasResizeView, setCanvasResizeView] = useState(session.canvasResizeView ?? null);
  const nextId = useRef(Math.max(session.nextId || 20, ...(session.items || []).map(item=>(Number(item.id)||0)+1)));
  const nextGroupId = useRef(session.nextGroupId || 1);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const handleRef = useRef(null);
  const rotationDragRef = useRef(null);
  const panRef = useRef(null);
  const marqueeRef = useRef(null);
  const [marquee, setMarquee] = useState(null);
  const stageDragRef = useRef(null);
  const imageFileRef = useRef(null);
  const assetDragRef = useRef(null);
  const projectSnapshot = JSON.stringify(documentMode === "item"
    ? {documentMode,shapeName,realWidth,realDepth,groupId,items,rotationParts,cornerSnapping,referenceImages,advancedShapeRole}
    : {documentMode,shapeName,realWidth,realDepth,stageNodes,stageBoundaryLocked,zones,textItems,referenceImages});
  useEffect(() => {
    if (savedProject.current === null || resetProjectBaseline.current) {
      savedProject.current = projectSnapshot;
      resetProjectBaseline.current = false;
    }
  });
  const sessionError = useSessionDraft("shape-studio:draft", {
    documentMode, shapeName, realWidth, realDepth, groupId, items, rotationParts, cornerSnapping, referenceImages,
    advancedShapeRole, stageNodes, zones, textItems, stageBoundaryLocked, activeLibraryId, draftAssetId, snapMode, grid,
    zoom, pan, canvasResizeEnabled, canvasResizeView, vectorDrawing,
    savedProject: savedProject.current ?? projectSnapshot, nextId: nextId.current, nextGroupId: nextGroupId.current,
  });
  const equipmentItems = library.filter(isEquipmentItem);
  const publishedItems = equipmentItems.filter(isPublishedItem);
  const matchingManagedStages = stageLibrary.filter(stage => stage.label.toLowerCase().includes(managedItemSearch.trim().toLowerCase())).sort((a,b)=>a.label.localeCompare(b.label));
  const matchingManagedItems = equipmentItems.filter(item => {
    const groupName = groups.find(group=>group.id===item.groupId)?.label || "Uncategorised";
    return (item.label + " " + groupName).toLowerCase().includes(managedItemSearch.trim().toLowerCase());
  }).sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:"base"}));
  const managedEquipmentSections = [...groups, {id:null,label:"Uncategorised"}].map(group => ({...group,items:matchingManagedItems.filter(item => (groups.some(candidate=>candidate.id===item.groupId) ? item.groupId : null) === group.id)})).filter(group=>group.items.length);
  const matchingManagedGroups = groups.filter(group=>group.label.toLowerCase().includes(managedGroupSearch.trim().toLowerCase()));
  const activePublished = Boolean(activeLibraryId && publishedItems.some(item => item.id === activeLibraryId));
  const advancedPresets = library.filter(item => item.editor?.advancedShapeRole && item.editor?.layers?.length);
  const selected = items.find((item) => item.id === selectedId);
  const drawnVector = items.find(item=>item.id===vectorDrawing?.id);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const selectedText = textItems.find((item) => item.id === selectedTextId);
  const referenceImage = referenceImages.find(
    (image) => image.id === selectedReferenceId,
  );
  const referenceSelected = Boolean(referenceImage);
  const orderedAssets = [
    ...referenceImages.map((asset) => ({ ...asset, assetType: "image" })),
    ...zones.map((asset) => ({ ...asset, assetType: "zone" })),
    ...textItems.map((asset) => ({ ...asset, assetType: "text" })),
  ].sort((a, b) => (b.zOrder ?? 0) - (a.zOrder ?? 0));
  const setReferenceSelected = (selected) => {
    if (!selected) setSelectedReferenceId(null);
  };
  const setReferenceImage = (value) => {
    if (!selectedReferenceId) return;
    if (documentMode === "item") checkpoint();
    if (value === null) {
      setReferenceImages((old) =>
        old.filter((image) => image.id !== selectedReferenceId),
      );
      setSelectedReferenceId(null);
      return;
    }
    setReferenceImages((old) =>
      old.map((image) =>
        image.id === selectedReferenceId
          ? typeof value === "function"
            ? value(image)
            : value
          : image,
      ),
    );
  };
  const stageNode =
    selectedStageNode === null
      ? null
      : (selectedZone?.nodes || stageNodes)[selectedStageNode];
  const activeStageControls = documentMode === "stage" && !selectedZone?.locked && (selectedZone || !stageBoundaryLocked) ? stageControlPoints(selectedZone?.nodes || stageNodes, selectedStageNode) : [];
  const selectedGroupItems = selectedGroupId
    ? items.filter((item) => item.editorGroupId === selectedGroupId)
    : [];
  const groupBounds = rotatedBounds(selectedGroupItems);
  const effectiveRotationParts = lockTripodPartPivots(rotationParts,items);

  const svgMarkup = useMemo(
    () =>
      `<svg viewBox="0 0 ${realWidth} ${realDepth}" xmlns="http://www.w3.org/2000/svg" aria-label="${shapeName}">\n${items.map(svgElement).join("\n")}\n</svg>`,
    [items, shapeName, realWidth, realDepth],
  );
  const vectorShapes = useMemo(
    () =>
      items.map(function toVectorShape({ id, name, collision, ...shape }) { return ({
        ...shape,
        ...(shape.type === "vector" ? {type:"path",d:vectorPath(shape)} : {}),
        ...(shape.type === "compound" ? {children:shape.children.map(toVectorShape)} : {}),
        id: String(id),
        name,
      }); }),
    [items],
  );
  const collisionShapes = useMemo(
    () => items.flatMap(collisionLayers),
    [items],
  );
  const itemData = useMemo(
    () => ({
      schema: "stageplot-item@3",
      stageplotPublished: activePublished,
      id: activeLibraryId || draftAssetId,
      label: shapeName.trim() || "Untitled Item",
      groupId: advancedShapeRole ? null : groupId || null,
      dimensions: { widthMeters: realWidth, depthMeters: realDepth },
      shapes: vectorShapes,
      collisionShapes,
      snapPoints: cornerSnapping ? [{x:0,y:0},{x:realWidth,y:0},{x:realWidth,y:realDepth},{x:0,y:realDepth}] : [],
      rotationParts: effectiveRotationParts,
      editor: { layers: items, referenceImages, ...(advancedShapeRole ? {advancedShapeRole} : {}), ...(library.find(item=>item.id===activeLibraryId)?.editor?.placementMode ? {placementMode:library.find(item=>item.id===activeLibraryId).editor.placementMode} : {}) },
    }),
    [
      activeLibraryId, draftAssetId,
      activePublished,
      library,
      shapeName,
      groupId,
      realWidth,
      realDepth,
      vectorShapes,
      collisionShapes,
      cornerSnapping,
      effectiveRotationParts,
      items,
      referenceImages,
      advancedShapeRole,
    ],
  );
  const itemPackage = useMemo(
    () => JSON.stringify(itemData, null, 2),
    [itemData],
  );
  const stageData = useMemo(
    () => ({
      schema: "stageplot-stage@1",
      id: activeLibraryId || draftAssetId,
      label: shapeName.trim() || "Untitled Stage",
      dimensions: { widthMeters: realWidth, depthMeters: realDepth },
      boundary: { closed: true, nodes: stageNodes },
      collisionBoundary: sampleStageBoundary(stageNodes),
      zones: zones.map((zone) => ({
        ...zone,
        collisionBoundary: zone.solid
          ? sampleStageBoundary(zone.nodes)
          : undefined,
      })),
      textItems,
      details: [],
      editor: { referenceImages, stageBoundaryLocked },
    }),
    [
      activeLibraryId, draftAssetId,
      shapeName,
      realWidth,
      realDepth,
      stageNodes,
      stageBoundaryLocked,
      zones,
      textItems,
      referenceImages,
    ],
  );

  const refreshLibrary = async () => {
    try {
      const [itemsResponse, groupsResponse, stagesResponse] = await Promise.all(
        [fetch(`${LIBRARY_API}?scope=all`), fetch(GROUPS_API), fetch(STAGES_API)],
      );
      if (!itemsResponse.ok || !groupsResponse.ok || !stagesResponse.ok)
        throw new Error("Library server unavailable");
      setLibrary(await itemsResponse.json());
      setGroups(await groupsResponse.json());
      setStageLibrary(await stagesResponse.json());
      setLibraryError("");
    } catch {
      setLibraryError("Start the library server with npm run dev:all");
    }
  };
  useEffect(() => {
    refreshLibrary();
  }, []);

  const checkpoint = () =>
    setHistory((old) => [
      ...old.slice(-9),
      {
        items: structuredClone(items),
        rotationParts: structuredClone(rotationParts),
        cornerSnapping,
        referenceImages: structuredClone(referenceImages),
        stageNodes: structuredClone(stageNodes),
        stageBoundaryLocked,
        zones: structuredClone(zones),
        textItems: structuredClone(textItems),
        realWidth,
        realDepth,
        shapeName,
        groupId,
      },
    ]);
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setItems(previous.items);
    setRotationParts(previous.rotationParts || []);
    setCornerSnapping(previous.cornerSnapping ?? false);
    setReferenceImages(previous.referenceImages || []);
    if (previous.stageNodes) setStageNodes(previous.stageNodes);
    if (previous.stageBoundaryLocked !== undefined) setStageBoundaryLocked(previous.stageBoundaryLocked);
    if (previous.zones) setZones(previous.zones);
    if (previous.textItems) setTextItems(previous.textItems);
    setSelectedReferenceId(null);
    setRealWidth(previous.realWidth);
    setRealDepth(previous.realDepth);
    setShapeName(previous.shapeName);
    setGroupId(previous.groupId);
    setHistory((old) => old.slice(0, -1));
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
    setSelectedStageAssetIds([]);
  };
  const update = (changes) => {
    checkpoint();
    setItems((old) =>
      old.map((item) =>
        item.id === selectedId ? resizeShape(item,changes) : item,
      ),
    );
  };
  const updateTripodRadius = (value) => {
    const radius = Math.max(0.01, value);
    checkpoint();
    setItems((old) =>
      old.map((item) =>
        item.id === selectedId
          ? {
              ...item,
              legRadius: radius,
              width: Math.sqrt(3) * radius,
              height: radius * 1.5,
            }
          : item,
      ),
    );
  };
  const flash = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };
  const addAdvancedPreset = (preset) => {
    if (vectorDrawing) finishVectorDrawing(false);
    try {
      let groupId;
      do { groupId = `preset-group-${nextGroupId.current++}`; } while (items.some(item => item.editorGroupId === groupId));
      const layers = instantiateAdvancedShape(preset, {width:realWidth,depth:realDepth}, nextId.current, groupId);
      checkpoint();
      nextId.current += layers.length;
      setItems(old => [...old,...layers]);
      setSelectedId(layers[0].type === "compound" ? layers[0].id : null);
      setSelectedReferenceId(null);
      setMultiSelectedIds([]);
      setSelectedGroupId(layers[0].type === "compound" ? null : groupId);
    } catch(error) { flash(error.message); }
  };
  const saveAdvancedPreset = async () => {
    if (!items.length || !presetName.trim()) return;
    setPresetSaving(true);
    try {
      const id = advancedShapeRole && activeLibraryId ? activeLibraryId : advancedPresetId("custom", libraryId(presetName));
      const existing = library.find(item => item.id === id);
      const data = {...itemData,id,groupId:null,stageplotPublished:existing ? isPublishedItem(existing) : false,label:presetName.trim(),editor:{...itemData.editor,advancedShapeRole:"custom",placementMode:existing?.editor?.placementMode || "layers"}};
      const response = await fetch(`${LIBRARY_API}/${encodeURIComponent(id)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save custom shape");
      setLibrary(old => [...old.filter(item => item.id !== id),result]);
      savedProject.current = projectSnapshot;
      setPresetDialogOpen(false);
      flash("Custom shape saved");
    } catch(error) { flash(error.message || "Could not save advanced shape"); }
    finally { setPresetSaving(false); }
  };
  const add = (type) => {
    if (vectorDrawing) finishVectorDrawing(false);
    if (type === "drawVector") {
      setVectorDrawing({id:null});
      setVectorPreview(null);
      setSelectedId(null);setMultiSelectedIds([]);setSelectedGroupId(null);setSelectedReferenceId(null);
      flash("Click points to draw. Click the last point to finish, the first to close, or press Esc.");
      return;
    }
    setVectorDrawing(null);
    setSelectedReferenceId(null);
    checkpoint();
    const size = DEFAULTS[type];
    const definition = [...PALETTE, ...ADVANCED_PALETTE].find(
      (x) => x.type === type,
    );
    const item = {
      id: nextId.current++,
      type,
      name: definition.label,
      x: realWidth / 2 - size.width / 2,
      y: realDepth / 2 - size.height / 2,
      ...size,
      ...(type === "vector" ? {nodes:defaultStageNodes(size.width,size.height)} : {}),
      fill: "#e9f5bc",
      stroke: "#25261f",
      strokeWidth: 2,
      rotation: 0,
      toggleable: false,
      collision: type !== "line" && type !== "arc" && type !== "text",
    };
    setItems((old) => [...old, type === "text" ? sizeText({...item, fill:"#25261f", stroke:"none", strokeWidth:0}) : item]);
    setSelectedId(item.id);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
  };
  const pointerDown = (event, item) => {
    if (event.button !== 0) return;
    if (item.type === "text") event.preventDefault();
    setSelectedReferenceId(null);
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!event.shiftKey && multiSelectedIds.length > 1 && multiSelectedIds.includes(item.id)) {
      dragRef.current = { groupId: "selection", px: event.clientX, py: event.clientY, members: items.filter(member=>multiSelectedIds.includes(member.id)).map(member=>({id:member.id,x:member.x,y:member.y})) };
      return;
    }
    if (item.editorGroupId) {
      const members = items.filter(
        (candidate) => candidate.editorGroupId === item.editorGroupId,
      );
      setSelectedGroupId(item.editorGroupId);
      setSelectedId(null);
      setMultiSelectedIds([]);
      dragRef.current = {
        groupId: item.editorGroupId,
        px: event.clientX,
        py: event.clientY,
        members: members.map((member) => ({
          id: member.id,
          x: member.x,
          y: member.y,
        })),
      };
    } else {
      if (event.shiftKey) {
        const current = [
          ...new Set([
            ...multiSelectedIds,
            ...(selectedId ? [selectedId] : []),
          ]),
        ];
        const next = current.includes(item.id)
          ? current.filter((id) => id !== item.id)
          : [...current, item.id];
        setMultiSelectedIds(next.length > 1 ? next : []);
        setSelectedId(next.length === 1 ? next[0] : null);
      } else {
        setSelectedId(item.id);
        setMultiSelectedIds([]);
      }
      setSelectedGroupId(null);
      dragRef.current = {
        id: item.id,
        px: event.clientX,
        py: event.clientY,
        x: item.x,
        y: item.y,
      };
    }
  };
  const selectLayer = (event, item) => {
    setSelectedReferenceId(null);
    if (item.editorGroupId) {
      setSelectedGroupId(item.editorGroupId);
      setSelectedId(null);
      setMultiSelectedIds([]);
      return;
    }
    setSelectedGroupId(null);
    if (event.shiftKey) {
      const current = [
        ...new Set([...multiSelectedIds, ...(selectedId ? [selectedId] : [])]),
      ];
      const next = current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id];
      setMultiSelectedIds(next.length > 1 ? next : []);
      setSelectedId(next.length === 1 ? next[0] : null);
    } else {
      setSelectedId(item.id);
      setMultiSelectedIds([]);
    }
  };
  const pointerMove = (event) => {
    if (rotationDragRef.current && canvasRef.current) {
      const drag=rotationDragRef.current,rect=canvasRef.current.getBoundingClientRect();
      const point={x:(event.clientX-rect.left)/rect.width*realWidth,y:(event.clientY-rect.top)/rect.height*realDepth};
      const angle=Math.atan2(point.y-drag.center.y,point.x-drag.center.x)*180/Math.PI;
      const step=event.shiftKey?15:1,degrees=Math.round(normalizeRotation(angle-drag.startAngle)/step)*step;
      const rotated=new Map(rotateObjects(drag.original,drag.center,degrees).map(item=>[item.id,item]));
      setItems(old=>old.map(item=>rotated.get(item.id)||item));
      return;
    }
    const snapStep =
      snapMode === "advanced" ? 0.01 : snapMode === "standard" ? 0.1 : 0;
    const snapValue = (value) =>
      snapStep ? Math.round(value / snapStep) * snapStep : value;
    if (handleRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaX =
        ((event.clientX - handleRef.current.px) / rect.width) * realWidth;
      const deltaY =
        ((event.clientY - handleRef.current.py) / rect.height) * realDepth;
      const { id, handle, original } = handleRef.current;
      const angle = (original.rotation || 0)*Math.PI/180;
      const localX=deltaX*Math.cos(angle)+deltaY*Math.sin(angle), localY=-deltaX*Math.sin(angle)+deltaY*Math.cos(angle);
      setItems((old) =>
        old.map((item) => {
          if (item.id !== id) return item;
          if (handle.startsWith("vector:")) return moveVectorHandle(original,handle,localX,localY,snapValue);
          if (handle === "radius") { const diameter=Math.max(.02,snapValue(original.width+localX*2)); return {...item,width:diameter,height:diameter,x:original.x+(original.width-diameter)/2,y:original.y+(original.height-diameter)/2}; }
          if (handle.startsWith("resize-")) {
            const west=handle.endsWith("nw")||handle.endsWith("sw"), north=handle.endsWith("nw")||handle.endsWith("ne");
            const width=Math.max(.01,snapValue(original.width+(west?-localX:localX))),height=Math.max(.01,snapValue(original.height+(north?-localY:localY)));
            const shiftX=(west?original.width-width:0)+(width-original.width)/2,shiftY=(north?original.height-height:0)+(height-original.height)/2;
            return resizeShape(original,{width,height,x:original.x+original.width/2+shiftX*Math.cos(angle)-shiftY*Math.sin(angle)-width/2,y:original.y+original.height/2+shiftX*Math.sin(angle)+shiftY*Math.cos(angle)-height/2});
          }
          if (handle === "arc-start")
            return {
              ...item,
              startX: snapValue(original.startX + deltaX),
              startY: snapValue(original.startY + deltaY),
            };
          if (handle === "arc-end")
            return {
              ...item,
              endX: snapValue(original.endX + deltaX),
              endY: snapValue(original.endY + deltaY),
            };
          if (handle === "arc-control")
            return {
              ...item,
              controlX: 2 * snapValue((original.startX + 2 * original.controlX + original.endX) / 4 + deltaX) - (original.startX + original.endX) / 2,
              controlY: 2 * snapValue((original.startY + 2 * original.controlY + original.endY) / 4 + deltaY) - (original.startY + original.endY) / 2,
            };
          if (handle === "left")
            return {
              ...item,
              leftInset: snapValue(original.leftInset + deltaX),
            };
          if (handle === "right")
            return {
              ...item,
              rightInset: snapValue(original.rightInset - deltaX),
            };
          return { ...item, slew: snapValue(original.slew + deltaX) };
        }),
      );
      return;
    }
    if (!dragRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const d = dragRef.current;
    if (!d.historyCommitted) {
      checkpoint();
      d.historyCommitted = true;
    }
    if (d.groupId) {
      let dx = ((event.clientX - d.px) / rect.width) * realWidth;
      let dy = ((event.clientY - d.py) / rect.height) * realDepth;
      dx = snapValue(dx);
      dy = snapValue(dy);
      setItems((old) =>
        old.map((item) => {
          const original = d.members.find((member) => member.id === item.id);
          return original
            ? { ...item, x: original.x + dx, y: original.y + dy }
            : item;
        }),
      );
      return;
    }
    let x = d.x + ((event.clientX - d.px) / rect.width) * realWidth;
    let y = d.y + ((event.clientY - d.py) / rect.height) * realDepth;
    x = snapValue(x);
    y = snapValue(y);
    setItems((old) =>
      old.map((item) =>
        item.id === d.id
          ? {
              ...item,
              x: Math.max(0, Math.min(realWidth - item.width, x)),
              y: Math.max(0, Math.min(realDepth - item.height, y)),
            }
          : item,
      ),
    );
  };
  const startHandleDrag = (event, handle) => {
    if (event.button !== 0) return;
    if (handle === "rotate") { startRotationDrag(event, selected); return; }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    checkpoint();
    handleRef.current = {
      id: selected.id,
      handle,
      px: event.clientX,
      py: event.clientY,
      original: {
        ...structuredClone(selected),
        leftInset: selected.leftInset || 0,
        rightInset: selected.rightInset || 0,
        slew: selected.slew || 0,
        startX: selected.startX,
        startY: selected.startY,
        endX: selected.endX,
        endY: selected.endY,
        controlX: selected.controlX,
        controlY: selected.controlY,
      },
    };
  };
  const startRotationDrag = (event, item = null) => {
    if (event.button !== 0) return;
    const originals=item?[item]:selectedGroupItems;
    if (!originals.length) return;
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);checkpoint();
    const bounds=rotatedBounds(originals),pivot=item?objectPivot(item):null;
    const center=item?{x:item.x+pivot.x,y:item.y+pivot.y}:{x:(bounds.x+bounds.right)/2,y:(bounds.y+bounds.bottom)/2};
    const rect=canvasRef.current.getBoundingClientRect();
    const point={x:(event.clientX-rect.left)/rect.width*realWidth,y:(event.clientY-rect.top)/rect.height*realDepth};
    rotationDragRef.current={original:structuredClone(originals),center,startAngle:Math.atan2(point.y-center.y,point.x-center.x)*180/Math.PI};
  };
  const removeStageplotItem = async (item) => {
    if (!window.confirm(`Delete "${item.label}" from the equipment library? This removes its saved design, custom shape, and Stageplot library entry.`)) return;
    setRemovingStageplotId(item.id);
    try {
      const response=await fetch(`${LIBRARY_API}/${encodeURIComponent(item.id)}?permanent=true`,{method:"DELETE"});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not remove Stageplot item");
      if (result.deleted !== true || result.id !== item.id) throw new Error("The library server did not delete this item. Restart npm run dev:all to load the updated server, then try again.");
      setLibrary(old=>old.filter(candidate=>candidate.id!==item.id));
      if (documentMode === "item" && activeLibraryId === item.id) { setActiveLibraryId(null); setAdvancedShapeRole(null); }
      flash("Item deleted from equipment library");
    } catch(error) {flash(error.message||"Could not remove Stageplot item");}
    finally {setRemovingStageplotId(null);}
  };
  const setPresetPlacementMode = async (preset, placementMode) => {
    setRemovingPresetId(preset.id);
    try {
      const data = {...preset,editor:{...preset.editor,placementMode}};
      const response = await fetch(LIBRARY_API+"/"+encodeURIComponent(preset.id),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save placement setting");
      setLibrary(old=>old.map(item=>item.id===preset.id?result:item));
      flash("Placement setting saved");
    } catch(error) { flash(error.message); }
    finally { setRemovingPresetId(null); }
  };
  const removeCustomPreset = async (preset) => {
    setRemovingPresetId(preset.id);
    try {
      const data=removeCustomShapeMembership(preset);
      const response=await fetch(`${LIBRARY_API}/${encodeURIComponent(preset.id)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not remove custom shape");
      setLibrary(old=>old.map(item=>item.id===preset.id?result:item));
      if(activeLibraryId===preset.id)setAdvancedShapeRole(null);
      flash("Custom shape removed");
    } catch(error) {flash(error.message||"Could not remove custom shape");}
    finally {setRemovingPresetId(null);}
  };
  const startStageNodeDrag = (event, index, handle = "node", zoneId = null) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    stageDragRef.current = { index, handle, zoneId };
    setSelectedStageNode(index);
    setSelectedZoneId(zoneId);
    setReferenceSelected(false);
  };
  const captureStageControl = (event) => {
    if (event.button !== 0 || !activeStageControls.length || event.shiftKey || event.ctrlKey) return;
    const matrix = canvasRef.current.getScreenCTM();
    if (!matrix) return;
    const radius = Math.hypot(realWidth,realDepth) / Math.SQRT2 * .007 * Math.hypot(matrix.a,matrix.b) + 9;
    const kind = nearestControl(activeStageControls,{x:event.clientX,y:event.clientY},point=>({x:matrix.a*point.x+matrix.c*point.y+matrix.e,y:matrix.b*point.x+matrix.d*point.y+matrix.f}),radius);
    if (kind) startStageNodeDrag(event,selectedStageNode,kind,selectedZoneId);
  };
  const stagePointer = (event, clamp = true) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const step =
      snapMode === "advanced" ? 0.01 : snapMode === "standard" ? 0.1 : 0;
    const snap = (value) => (step ? Math.round(value / step) * step : value);
    const x = ((event.clientX - rect.left) / rect.width) * realWidth;
    const y = ((event.clientY - rect.top) / rect.height) * realDepth;
    return {
      x: snap(clamp ? Math.max(0, Math.min(realWidth, x)) : x),
      y: snap(clamp ? Math.max(0, Math.min(realDepth, y)) : y),
    };
  };
  const stageSegmentClick = (event, index, zoneId = null) => {
    if ((!zoneId && stageBoundaryLocked) || (zoneId && zones.find(zone => zone.id === zoneId)?.locked)) return;
    event.stopPropagation();
    const updateNodes = (updater) =>
      zoneId
        ? setZones((old) =>
            old.map((zone) =>
              zone.id === zoneId
                ? { ...zone, nodes: updater(zone.nodes) }
                : zone,
            ),
          )
        : setStageNodes(updater);
    if (event.shiftKey) {
      const point = stagePointer(event, !zoneId);
      updateNodes((old) =>
        segmentMode(old[index]) === "line"
          ? [
              ...old.slice(0, index),
              { ...point, curveMode: "line" },
              ...old.slice(index),
            ]
          : old,
      );
      setSelectedStageNode(index);
    } else if (event.ctrlKey) {
      updateNodes((old) =>
        old.map((node, nodeIndex) =>
          nodeIndex === index
            ? {
                ...node,
                curveMode: "pointArc",
                curve: undefined,
                arcDepth: 0,
                arcX:
                  (old[(nodeIndex - 1 + old.length) % old.length].x + node.x) /
                  2,
                arcY:
                  (old[(nodeIndex - 1 + old.length) % old.length].y + node.y) /
                  2,
              }
            : node,
        ),
      );
      setSelectedStageNode(index);
    } else setSelectedStageNode(index);
    setSelectedZoneId(zoneId);
    setReferenceSelected(false);
  };
  const finishVectorDrawing = (closed = false) => {
    const draft = items.find(item=>item.id===vectorDrawing?.id);
    if (draft) {
      checkpoint();
      setItems(old=>old.map(item=>item.id===draft.id ? finishDrawnVector(item,closed) : item));
      setSelectedId(draft.id);
      setVectorNodeIndex(null);
    }
    setVectorDrawing(null);
    setVectorPreview(null);
  };
  const drawVectorPoint = (event) => {
    if (event.button !== 0 || !vectorDrawing) return;
    event.preventDefault();event.stopPropagation();
    const point = stagePointer(event,false);
    const draft = items.find(item=>item.id===vectorDrawing.id);
    if (!draft) {
      checkpoint();
      const id = nextId.current++;
      setItems(old=>[...old,{id,type:"vector",name:"Custom vector",x:point.x,y:point.y,width:.01,height:.01,nodes:[{x:0,y:0,curveMode:"line"}],open:true,collision:false,fill:"none",stroke:"#25261f",strokeWidth:2,rotation:0}]);
      setVectorDrawing({id});setSelectedId(id);
      return;
    }
    const matrix = canvasRef.current.getScreenCTM();
    const endpoint = matrix && drawingEndpoint(draft,{x:event.clientX,y:event.clientY},node=>({x:matrix.a*node.x+matrix.c*node.y+matrix.e,y:matrix.b*node.x+matrix.d*node.y+matrix.f}));
    if (endpoint) {finishVectorDrawing(endpoint==="closed");return;}
    const node={x:point.x-draft.x,y:point.y-draft.y,curveMode:"line"};
    if(Math.hypot(node.x-draft.nodes.at(-1).x,node.y-draft.nodes.at(-1).y)<1e-8)return;
    checkpoint();
    setItems(old=>old.map(item=>item.id===draft.id ? finishDrawnVector({...item,nodes:[...item.nodes,node]},false) : item));
  };
  const moveStageNode = (event) => {
    if (!stageDragRef.current || !canvasRef.current) return;
    if (stageDragRef.current.handle === "asset-move") {
      const point = stagePointer(event, false); const drag = stageDragRef.current; const dx = point.x - drag.start.x; const dy = point.y - drag.start.y;
      const translateNodes = nodes => nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy, cx: Number.isFinite(node.cx) ? node.cx + dx : node.cx, cy: Number.isFinite(node.cy) ? node.cy + dy : node.cy, arcX: Number.isFinite(node.arcX) ? node.arcX + dx : node.arcX, arcY: Number.isFinite(node.arcY) ? node.arcY + dy : node.arcY }));
      if (drag.assetType === "stage") setStageNodes(translateNodes(drag.original));
      if (drag.originals) {
        if (drag.originals["stage-boundary"]?.nodes) setStageNodes(translateNodes(drag.originals["stage-boundary"].nodes));
        setZones(old => old.map(zone => drag.originals[zone.id]?.nodes ? {...zone,nodes:translateNodes(drag.originals[zone.id].nodes)} : zone));
        setTextItems(old => old.map(item => drag.originals[item.id] ? {...item,x:drag.originals[item.id].x+dx,y:drag.originals[item.id].y+dy} : item));
        setReferenceImages(old => old.map(image => drag.originals[image.id] ? {...image,x:drag.originals[image.id].x+dx,y:drag.originals[image.id].y+dy} : image));
      } else {
        if (drag.assetType === "zone") setZones((old) => old.map((zone) => zone.id === drag.id ? { ...zone, nodes: translateNodes(drag.original) } : zone));
        if (drag.assetType === "text") setTextItems((old) => old.map((item) => item.id === drag.id ? { ...item, x: drag.original.x + dx, y: drag.original.y + dy } : item));
        if (drag.assetType === "image") setReferenceImages((old) => old.map((image) => image.id === drag.id ? { ...image, x: drag.original.x + dx, y: drag.original.y + dy } : image));
      }
      return;
    }
    if (stageDragRef.current.handle === "canvas-width" || stageDragRef.current.handle === "canvas-depth") {
      const drag = stageDragRef.current;
      const step = snapMode === "advanced" ? .01 : .1;
      const client = drag.handle === "canvas-width" ? event.clientX : event.clientY;
      const raw = drag.original + (client - drag.client) / drag.pixelsPerMeter;
      const size = Math.max(.1, snapMode === "off" ? raw : Math.round(raw / step) * step);
      if (drag.handle === "canvas-width") setRealWidth(size);
      else setRealDepth(size);
      return;
    }
    if (
      stageDragRef.current.handle === "image-move" ||
      stageDragRef.current.handle === "image-resize" ||
      stageDragRef.current.handle.startsWith("image-crop-")
    ) {
      const point = stagePointer(event, false);
      const drag = stageDragRef.current;
      setReferenceImages((old) =>
        old.map((image) => {
          if (image.id !== drag.imageId) return image;
          if (drag.handle.startsWith("image-crop-")) {
            const edge = drag.handle.slice("image-crop-".length);
            const crop = { left: 0, top: 0, right: 0, bottom: 0, ...image.crop };
            if (edge === "left") crop.left = Math.max(0, Math.min(.9 - crop.right, (point.x - image.x) / image.width));
            if (edge === "right") crop.right = Math.max(0, Math.min(.9 - crop.left, (image.x + image.width - point.x) / image.width));
            if (edge === "top") crop.top = Math.max(0, Math.min(.9 - crop.bottom, (point.y - image.y) / image.height));
            if (edge === "bottom") crop.bottom = Math.max(0, Math.min(.9 - crop.top, (image.y + image.height - point.y) / image.height));
            return { ...image, crop };
          }
          if (drag.handle === "image-move")
            return {
              ...image,
              x: drag.original.x + point.x - drag.start.x,
              y: drag.original.y + point.y - drag.start.y,
            };
          const width = Math.max(0.05, point.x - image.x);
          return (image.lockAspect ?? true)
            ? {
                ...image,
                width,
                height:
                  width / (image.aspectRatio || image.width / image.height),
              }
            : { ...image, width, height: Math.max(0.05, point.y - image.y) };
        }),
      );
      return;
    }
    const { index: targetIndex, handle, zoneId } = stageDragRef.current;
    const point = stagePointer(event, !zoneId);
    const updateNodes = (updater) =>
      zoneId
        ? setZones((old) =>
            old.map((zone) =>
              zone.id === zoneId
                ? { ...zone, nodes: updater(zone.nodes) }
                : zone,
            ),
          )
        : setStageNodes(updater);
    updateNodes((old) =>
      old.map((node, index) => {
        if (index !== targetIndex) return node;
        if (handle === "node") return { ...node, ...point };
        if (handle === "pointArc") {
          const previous = old[(index - 1 + old.length) % old.length];
          return {
            ...node,
            arcDepth: arcOffset(previous, node, point),
            arcX: undefined,
            arcY: undefined,
          };
        }
        if (handle === "smooth")
          return { ...node, cx: point.x, cy: point.y, bulge: undefined };
        if (handle === "midpoint") {
          const geometry = bezierGeometry(
            old[(index - 1 + old.length) % old.length],
            node,
          );
          const dx = point.x - geometry.midpoint.x;
          const dy = point.y - geometry.midpoint.y;
          return {
            ...node,
            mx: point.x,
            my: point.y,
            midInX: geometry.midIn.x + dx,
            midInY: geometry.midIn.y + dy,
            midOutX: geometry.midOut.x + dx,
            midOutY: geometry.midOut.y + dy,
          };
        }
        return { ...node, [`${handle}X`]: point.x, [`${handle}Y`]: point.y };
      }),
    );
  };
  const loadReferenceImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const width = Math.min(realWidth * 0.8, 5);
        const id = `image-${Date.now()}`;
        checkpoint();
        setReferenceImages((old) => [
          ...old,
          {
          id,
          name: file.name,
          zOrder: old.length + zones.length,
          dataUrl: reader.result,
          x: (realWidth - width) / 2,
          y: realDepth * 0.1,
          width,
          height: (width * image.height) / image.width,
          aspectRatio: image.width / image.height,
          lockAspect: true,
          opacity: 0.55,
          locked: false,
          crop: { left: 0, top: 0, right: 0, bottom: 0 },
          },
        ]);
        setSelectedId(null);
        setSelectedGroupId(null);
        setMultiSelectedIds([]);
        setSelectedReferenceId(id);
        setSelectedStageNode(null);
        setSelectedZoneId(null);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  const startReferenceDrag = (event, handle, imageOverride = referenceImage) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    checkpoint();
    setSelectedId(null);
    setSelectedGroupId(null);
    setMultiSelectedIds([]);
    const start = stagePointer(event, false);
    stageDragRef.current = { handle, start, original: { ...imageOverride }, imageId: imageOverride.id };
    setSelectedReferenceId(imageOverride.id);
    setSelectedStageNode(null);
  };
  const startReferenceCrop = (event) => {
    if (!event.ctrlKey || !referenceImage || referenceImage.locked) return;
    const point = stagePointer(event, false);
    const distances = { left: Math.abs(point.x - referenceImage.x), right: Math.abs(point.x - referenceImage.x - referenceImage.width), top: Math.abs(point.y - referenceImage.y), bottom: Math.abs(point.y - referenceImage.y - referenceImage.height) };
    const edge = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
    startReferenceDrag(event, `image-crop-${edge}`);
  };
  const startCanvasResize = (event, dimension) => {
    if (event.button !== 0) return;
    if (!canvasResizeEnabled || !event.ctrlKey) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    checkpoint();
    const rect = canvasRef.current.parentElement.getBoundingClientRect();
    if (!canvasResizeView) setCanvasResizeView({ pixelsPerMeter: rect.width / zoom / realWidth, width: realWidth, depth: realDepth });
    stageDragRef.current = { handle: dimension === "width" ? "canvas-width" : "canvas-depth", client: dimension === "width" ? event.clientX : event.clientY, original: dimension === "width" ? realWidth : realDepth, pixelsPerMeter: dimension === "width" ? rect.width / realWidth : rect.height / realDepth };
  };
  const startAssetMove = (event, asset, assetType) => {
    if (event.button !== 0) return;
    if (asset.locked || event.ctrlKey || event.shiftKey) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); checkpoint();
    const moveIds = selectedStageAssetIds.includes(asset.id) ? selectedStageAssetIds : [asset.id];
    const selectedAssets = [{id:"stage-boundary",assetType:"stage",nodes:stageNodes,locked:stageBoundaryLocked}, ...orderedAssets].filter(candidate => moveIds.includes(candidate.id) && !candidate.locked);
    const originals = selectedAssets.length > 1 ? Object.fromEntries(selectedAssets.map(candidate => [candidate.id, candidate.assetType === "zone" || candidate.assetType === "stage" ? {nodes:structuredClone(candidate.nodes)} : {x:candidate.x,y:candidate.y}])) : null;
    stageDragRef.current = { handle: "asset-move", assetType, id: asset.id, start: stagePointer(event, false), original: assetType === "zone" || assetType === "stage" ? structuredClone(asset.nodes) : { x: asset.x, y: asset.y }, originals };
    setSelectedStageAssetIds(moveIds);
    if (assetType === "zone") { setSelectedZoneId(asset.id); setSelectedTextId(null); }
    else if (assetType === "text") { setSelectedTextId(asset.id); setSelectedZoneId(null); }
    else { setSelectedTextId(null); setSelectedZoneId(null); }
    setSelectedReferenceId(null); setSelectedStageNode(null);
  };
  const updateBoundaryNode = (changes) =>
    selectedZoneId
      ? setZones((old) =>
          old.map((zone) =>
            zone.id === selectedZoneId
              ? {
                  ...zone,
                  nodes: zone.nodes.map((node, index) =>
                    index === selectedStageNode
                      ? { ...node, ...changes }
                      : node,
                  ),
                }
              : zone,
          ),
        )
      : setStageNodes((old) =>
          old.map((node, index) =>
            index === selectedStageNode ? { ...node, ...changes } : node,
          ),
        );
  const updateSelectedZone = (changes) =>
    setZones((old) =>
      old.map((zone) =>
        zone.id === selectedZoneId ? { ...zone, ...changes } : zone,
      ),
    );
  const reorderAsset = (draggedId, targetId) => {
    const ids = orderedAssets.map((asset) => asset.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const order = new Map(ids.map((id, index) => [id, ids.length - index - 1]));
    setReferenceImages((old) =>
      old.map((image) => ({ ...image, zOrder: order.get(image.id) })),
    );
    setZones((old) =>
      old.map((zone) => ({ ...zone, zOrder: order.get(zone.id) })),
    );
    setTextItems((old) =>
      old.map((item) => ({ ...item, zOrder: order.get(item.id) })),
    );
  };
  const toggleAssetLock = (asset) => {
    checkpoint();
    if (asset.assetType === "image") setReferenceImages((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item));
    if (asset.assetType === "zone") { setZones((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item)); if (selectedZoneId === asset.id) setSelectedStageNode(null); }
    if (asset.assetType === "text") setTextItems((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item));
  };
  const remove = () => {
    const ids = selectedGroupId
      ? selectedGroupItems.map((item) => item.id)
      : multiSelectedIds.length
        ? multiSelectedIds
        : selectedId
          ? [selectedId]
          : [];
    if (!ids.length) return;
    checkpoint();
    setItems((old) => old.filter((item) => !ids.includes(item.id)));
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
  };
  const groupSelected = () => {
    const ids = [
      ...new Set([...multiSelectedIds, ...(selectedId ? [selectedId] : [])]),
    ];
    if (ids.length < 2) return;
    checkpoint();
    const id = `group-${nextGroupId.current++}`;
    setItems((old) =>
      old.map((item) =>
        ids.includes(item.id)
          ? { ...item, editorGroupId: id, editorGroupName: "Group" }
          : item,
      ),
    );
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(id);
  };
  const ungroup = () => {
    if (!selectedGroupId) return;
    checkpoint();
    setItems((old) =>
      old.map((item) =>
        item.editorGroupId === selectedGroupId
          ? { ...item, editorGroupId: undefined, editorGroupName: undefined }
          : item,
      ),
    );
    setSelectedGroupId(null);
  };
  const reorder = (direction) => {
    const index = items.findIndex((x) => x.id === selectedId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    checkpoint();
    const copy = [...items];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setItems(copy);
  };
  const saveToLibrary = async () => {
    if (shapeSaving) return;
    if (documentMode === "stage") {
      await persistStage(stageData, projectSnapshot, activeLibraryId ? "Stage updated" : "Stage added to Stageplot");
      return;
    }
    if (!items.length) return flash("Add artwork before saving");
    if (!shapeName.trim()) return flash("Give the shape a name before saving");
    const choice = equipmentSaveChoice(library, activeLibraryId, shapeName);
    if (choice) {
      setSaveChoice({ ...choice, data: itemData, snapshot: projectSnapshot, newId: newAssetId() });
      return;
    }
    await persistEquipment(itemData, projectSnapshot);
  };
  const createRotationPart = () => {
    const ids = selectedGroupId ? selectedGroupItems.map(item=>item.id) : [...new Set([...multiSelectedIds,...(selectedId ? [selectedId] : [])])];
    if (!ids.length) return flash("Select one or more layers first");
    const name = window.prompt("Rotation part name", "Adjustable part")?.trim();
    if (!name) return;
    const members = items.filter(item=>ids.includes(item.id));
    const bounds = rotatedBounds(members);
    const tripod = members.find(item=>item.type==="tripod");
    const tripodHub = tripod ? objectPivot(tripod) : null;
    const id = `rotation-part-${Date.now()}`;
    checkpoint();
    setRotationParts(old=>[...old,{id,name,pivotX:tripod ? tripod.x+tripodHub.x : (bounds.x+bounds.right)/2,pivotY:tripod ? tripod.y+tripodHub.y : (bounds.y+bounds.bottom)/2,minRotation:-180,maxRotation:180,defaultRotation:0}]);
    setItems(old=>old.map(item=>ids.includes(item.id)?{...item,rotationPartId:id}:item));
    flash(`${name} rotation control added`);
  };
  const persistStage = async (data, snapshot, message) => {
    if (shapeSaving) return;
    setShapeSaving(true);
    try {
      const response = await fetch(`${STAGES_API}/${encodeURIComponent(data.id)}`, {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data,null,2)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      savedProject.current = snapshot;
      setShapeName(result.label);
      setActiveLibraryId(result.id);
      setDraftAssetId(result.id);
      setStageSaveAsOpen(false);
      await refreshLibrary();
      flash(message);
    } catch (error) { flash(error.message || "Could not save stage"); }
    finally { setShapeSaving(false); }
  };
  const saveStageAs = async () => {
    const label = stageSaveAsName.trim();
    if (!label) return;
    const id = newAssetId("stage");
    const snapshot = JSON.stringify({...JSON.parse(projectSnapshot),shapeName:label});
    await persistStage({...stageData,id,label},snapshot,"New stage version saved");
  };
  const persistEquipment = async (data, snapshot) => {
    if (shapeSaving) return;
    setShapeSaving(true);
    try {
      const response = await fetch(
        `${LIBRARY_API}/${encodeURIComponent(data.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      savedProject.current = snapshot;
      setActiveLibraryId(result.id);
      setSaveChoice(null);
      await refreshLibrary();
      flash("Shape saved to equipment library");
    } catch (error) {
      flash(error.message || "Could not save item");
    } finally { setShapeSaving(false); }
  };
  const editLibraryItem = (item) => {
    setVectorDrawing(null);setVectorPreview(null);
    setCanvasResizeView(null);
    resetProjectBaseline.current = true;
    setDocumentMode("item");
    setAdvancedShapeRole(item.editor?.advancedShapeRole || null);
    setActiveLibraryId(item.id);
    setShapeName(item.label);
    setGroupId(item.groupId || "");
    setRealWidth(item.dimensions.widthMeters);
    setRealDepth(item.dimensions.depthMeters);
    setItems(item.editor?.layers || []);
    setRotationParts(item.rotationParts || []);
    setCornerSnapping(Boolean(item.snapPoints?.length));
    setReferenceImages(item.editor?.referenceImages || []);
    setSelectedReferenceId(null);
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
    setHistory([]);
    setLibraryOpen(false);
    nextId.current = Math.max(
      20,
      ...(item.editor?.layers || []).map((layer) => layer.id + 1),
    );
    flash(`Editing ${item.label}`);
  };
  const editLibraryStage = (stage) => {
    setVectorDrawing(null);setVectorPreview(null);
    setCanvasResizeView(null);
    resetProjectBaseline.current = true;
    const source = stage.boundary.nodes;
    const normalized = source.map((node, index) => {
      const mode = segmentMode(node);
      if (mode !== "smooth" || Number.isFinite(node.bulge))
        return { ...node, curveMode: mode };
      const previous = source[(index - 1 + source.length) % source.length];
      const midpoint = segmentMidpoint(previous, node);
      const length = Math.hypot(node.x - previous.x, node.y - previous.y) || 1;
      return {
        ...node,
        curveMode: mode,
        bulge:
          ((node.cx ?? midpoint.x) - midpoint.x) *
            (-(node.y - previous.y) / length) +
          ((node.cy ?? midpoint.y) - midpoint.y) *
            ((node.x - previous.x) / length),
        cx: undefined,
        cy: undefined,
      };
    });
    setDocumentMode("stage");
    setActiveLibraryId(stage.id);
    setShapeName(stage.label);
    setRealWidth(stage.dimensions.widthMeters);
    setRealDepth(stage.dimensions.depthMeters);
    setStageNodes(normalized);
    setStageBoundaryLocked(stage.editor?.stageBoundaryLocked ?? false);
    setZones((stage.zones || []).map((zone, index) => ({ ...zone, zOrder: zone.zOrder ?? index })));
    setTextItems((stage.textItems || []).map((item, index) => ({ ...item, zOrder: item.zOrder ?? (stage.zones?.length || 0) + index })));
    setSelectedTextId(null);
    setSelectedZoneId(null);
    const savedImages = stage.editor?.referenceImages || (stage.editor?.referenceImage ? [{ ...stage.editor.referenceImage, id: "image-legacy", name: "Reference image" }] : []);
    setReferenceImages(savedImages.map((image, index) => ({ ...image, zOrder: image.zOrder ?? (stage.zones?.length || 0) + index })));
    setSelectedReferenceId(null);
    setSelectedStageNode(null);
    setLibraryOpen(false);
    setHistory([]);
  };
  const newItem = (mode) => {
    if (projectSnapshot !== savedProject.current && !window.confirm("This project has unsaved changes. Discard them and create a new " + (mode === "stage" ? "stage" : "equipment item") + "?")) return;
    setDocumentMode(mode);
    setDraftAssetId(newAssetId(mode === "stage" ? "stage" : "item"));
    setVectorDrawing(null);setVectorPreview(null);
    setNewItemOpen(false);
    setCanvasResizeView(null);
    resetProjectBaseline.current = true;
    setAdvancedShapeRole(null);
    const width = mode === "stage" ? 10 : 1;
    const depth = mode === "stage" ? 5 : 1;
    setActiveLibraryId(null);
    setShapeName(mode === "stage" ? "Untitled Stage" : "Untitled Item");
    setGroupId("");
    setItems([]);
    setRotationParts([]);
    setCornerSnapping(false);
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
    setHistory([]);
    setRealWidth(width);
    setRealDepth(depth);
    setStageNodes(defaultStageNodes(width, depth));
    setStageBoundaryLocked(false);
    setZones([]);
    setTextItems([]);
    setSelectedTextId(null);
    setSelectedZoneId(null);
    setReferenceImages([]);
    setSelectedReferenceId(null);
    setSelectedStageNode(null);
  };
  const updateManagedItem = async (item, changes) => {
    setRemovingStageplotId(item.id);
    try {
      const response = await fetch(LIBRARY_API+"/"+encodeURIComponent(item.id),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...item,...changes})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update item");
      setLibrary(old=>old.map(candidate=>candidate.id===item.id?result:candidate));
      if (activeLibraryId === item.id && documentMode === "item") {
        if (changes.label !== undefined) setShapeName(changes.label);
        if (changes.groupId !== undefined) setGroupId(changes.groupId || "");
        const baseline = JSON.parse(savedProject.current);
        if (baseline.documentMode === "item") {
          if (changes.label !== undefined) baseline.shapeName = changes.label;
          if (changes.groupId !== undefined) baseline.groupId = changes.groupId || "";
          savedProject.current = JSON.stringify(baseline);
        }
      }
      setEditingItemNameId(null);
      flash("Item updated");
    } catch(error) { flash(error.message); }
    finally { setRemovingStageplotId(null); }
  };
  const editManagedItem = item => {
    if (projectSnapshot !== savedProject.current && !window.confirm("This project has unsaved changes. Discard them and load " + item.label + " for editing?")) return;
    editLibraryItem(item);
    setManageStageplotOpen(false);
    setEditingItemNameId(null);
  };
  const saveManagedGroups = async updated => {
    setGroupsSaving(true);
    try {
      const response = await fetch(GROUPS_API,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(updated)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update groups");
      setGroups(result);
      setEditingEquipmentGroupId(null);
      if (groupId && !result.some(group=>group.id===groupId)) setGroupId("");
      flash("Equipment groups updated");
    } catch(error) { flash(error.message); }
    finally { setGroupsSaving(false); }
  };
  const addGroup = async () => {
    const label = window.prompt("Group name")?.trim();
    if (!label) return;
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!id || groups.some((group) => group.id === id))
      return flash("That group already exists");
    const updated = [...groups, { id, label }];
    try {
      const response = await fetch(GROUPS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!response.ok) throw new Error();
      setGroups(updated);
      setGroupId(id);
      flash("Group created");
    } catch {
      flash("Could not create group");
    }
  };
  const zoomViewport = (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    setZoom((value) => Math.max(0.25, Math.min(6, value * factor)));
  };
  const startPan = (event) => {
    if (vectorDrawing && event.button===0) {drawVectorPoint(event);return;}
    const occupied = documentMode === "item"
      ? ".shape-layer, .reference-image, .ordered-reference"
      : ".editable-zone, .ordered-reference, .stage-text, .stage-floor, .boundary-node, .segment-hit, .curve-control, .bezier-control";
    if (event.button === 0 && !event.target.closest?.(occupied)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = viewportRef.current.getBoundingClientRect();
      const start = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      marqueeRef.current = { start, worldStart: canvasWorldPoint(event), additive: event.shiftKey ? [...multiSelectedIds, ...(selectedId ? [selectedId] : []), ...selectedGroupItems.map(item=>item.id)] : [] };
      if (documentMode === "stage") marqueeRef.current.additive = event.shiftKey ? selectedStageAssetIds : [];
      setMarquee(selectionBox(start,start));
      return;
    }
    if (event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      px: event.clientX,
      py: event.clientY,
      x: pan.x,
      y: pan.y,
    };
  };
  const manageStage = async (stage, label) => {
    const deleting = label === undefined;
    if (deleting && !window.confirm(`Permanently delete ${stage.label}? Its stage-locked links will no longer work, and saved projects will no longer be able to load this stage.`)) return;
    setRemovingStageplotId(stage.id);
    try {
      const response = await fetch(`${STAGES_API}/${encodeURIComponent(stage.id)}`, deleting
        ? { method: "DELETE" }
        : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...stage, label: label.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update stage");
      setStageLibrary(old => deleting ? old.filter(candidate => candidate.id !== stage.id) : old.map(candidate => candidate.id === stage.id ? result : candidate));
      const editingCurrent = activeLibraryId === stage.id && documentMode === "stage";
      if (editingCurrent) {
        if (deleting) {
          setActiveLibraryId(null);
          setDraftAssetId(newAssetId("stage"));
          savedProject.current = "{}";
        } else {
          setShapeName(result.label);
          const baseline = JSON.parse(savedProject.current);
          if (baseline.documentMode === "stage") {
            baseline.shapeName = result.label;
            savedProject.current = JSON.stringify(baseline);
          }
        }
      }
      setEditingStageNameId(null);
      flash(deleting ? editingCurrent ? "Stage deleted; canvas retained as an unsaved copy" : "Stage deleted" : "Stage renamed; its link is unchanged");
    } catch (error) { flash(error.message); }
    finally { setRemovingStageplotId(null); }
  };
  const canvasWorldPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * realWidth, y: (event.clientY - rect.top) / rect.height * realDepth };
  };
  const movePan = (event) => {
    if (marqueeRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      setMarquee(selectionBox(marqueeRef.current.start, {x:event.clientX-rect.left,y:event.clientY-rect.top}));
      return;
    }
    if (!panRef.current) return;
    setPan({
      x: panRef.current.x + event.clientX - panRef.current.px,
      y: panRef.current.y + event.clientY - panRef.current.py,
    });
  };
  const finishViewportDrag = (event) => {
    if (marqueeRef.current) {
      const drag = marqueeRef.current;
      if (documentMode === "stage") {
        const box = selectionBox(drag.worldStart,canvasWorldPoint(event));
        const boundsFor = asset => {
          if (asset.assetType === "image") return {x:asset.x,y:asset.y,right:asset.x+asset.width,bottom:asset.y+asset.height};
          if (asset.assetType === "text") {
            const width = Math.max(asset.fontSize, (asset.text?.length || 1) * asset.fontSize * .6);
            return {x:asset.x-width/2,y:asset.y-asset.fontSize/2,right:asset.x+width/2,bottom:asset.y+asset.fontSize/2};
          }
          const xs=asset.nodes.map(node=>node.x), ys=asset.nodes.map(node=>node.y);
          return {x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
        };
        const selectableAssets = [...orderedAssets, {id:"stage-boundary",assetType:"stage",nodes:stageNodes,locked:stageBoundaryLocked}];
        const ids = [...new Set([...drag.additive,...selectableAssets.filter(asset=>!asset.locked && asset.id && containsBounds(box,boundsFor(asset))).map(asset=>asset.id)])];
        setSelectedStageAssetIds(ids);
        if (ids.length === 1) {
          const asset=selectableAssets.find(candidate=>candidate.id===ids[0]);
          setSelectedReferenceId(asset?.assetType==="image"?asset.id:null); setSelectedZoneId(asset?.assetType==="zone"?asset.id:null); setSelectedTextId(asset?.assetType==="text"?asset.id:null);
        } else { setSelectedReferenceId(null); setSelectedZoneId(null); setSelectedTextId(null); }
        setSelectedStageNode(null); marqueeRef.current=null; setMarquee(null); panRef.current=null; return;
      }
      const ids = [...new Set([...drag.additive, ...enclosedItems(items,selectionBox(drag.worldStart,canvasWorldPoint(event)),item=>{
        const layer = [...canvasRef.current.querySelectorAll(".shape-layer")].find(element=>element.dataset.shapeId===String(item.id));
        const bounds = layer?.firstElementChild?.getBoundingClientRect();
        const canvas = canvasRef.current.getBoundingClientRect();
        return bounds ? {x:(bounds.left-canvas.left)/canvas.width*realWidth,y:(bounds.top-canvas.top)/canvas.height*realDepth,right:(bounds.right-canvas.left)/canvas.width*realWidth,bottom:(bounds.bottom-canvas.top)/canvas.height*realDepth} : rotatedBounds([item]);
      })])];
      const members = items.filter(item=>ids.includes(item.id));
      const group = members[0]?.editorGroupId;
      const oneGroup = group && members.every(item=>item.editorGroupId===group);
      setSelectedGroupId(oneGroup ? group : null);
      setSelectedId(!oneGroup && ids.length===1 ? ids[0] : null);
      setMultiSelectedIds(!oneGroup && ids.length>1 ? ids : []);
      setSelectedReferenceId(null);
      marqueeRef.current = null;
      setMarquee(null);
    }
    panRef.current = null;
  };
  const resetView = () => {
    setCanvasResizeView(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  useEffect(() => {
    const keyDown = (event) => {
      if (event.key === "Escape" && vectorDrawing) {
        event.preventDefault();finishVectorDrawing(false);return;
      }
      if (
        event.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setVectorDrawing(null);setVectorPreview(null);
        undo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  });

  return (
    <MeasurementUnit.Provider value={documentMode === "stage" ? "m" : "cm"}>
    <div className="app">
      <header>
        <div className="brand">
          <span>S</span>
          <div>
            SHAPE STUDIO<small>FOR STAGEPLOT</small>
          </div>
        </div>
        <input
          className="title"
          value={shapeName}
          onChange={(e) => setShapeName(e.target.value)}
          aria-label="Shape name"
        />
        <div className="actions">
          <button onClick={()=>setHelpOpen(true)}>Help</button>
          <button onClick={() => setNewItemOpen(true)}>New item</button>
          <button
            onClick={() => {
              refreshLibrary();
              setManageStageplotOpen(true);
            }}
          >
            Library
          </button>
          {documentMode === "stage" && activeLibraryId && <button disabled={shapeSaving} onClick={()=>{setStageSaveAsName(`${shapeName} Copy`);setStageSaveAsOpen(true);}}>Save stage as</button>}
          <button className="accent" disabled={shapeSaving} onClick={saveToLibrary}>
            {shapeSaving ? "Saving..." : documentMode === "item" ? "Save shape" : activeLibraryId ? "Update stage" : "Add stage to Stageplot"}
          </button>
        </div>
      </header>
      <main>
        <aside className="palette">
          {documentMode === "stage" ? (
            <>
              <p className="eyebrow">ASSETS</p>
              <button
                className="group-button"
                onClick={() => imageFileRef.current?.click()}
              >
                Add background image
              </button>
              <button
                className="group-button"
                onClick={() => {
                  const id = `text-${Date.now()}`;
                  setTextItems((old) => [...old, { id, name: `Text ${old.length + 1}`, text: "Stage label", x: realWidth / 2, y: realDepth / 2, fontSize: 0.3, color: "#25261f", opacity: 1, locked: false, zOrder: orderedAssets.length }]);
                  setSelectedTextId(id);
                  setSelectedZoneId(null);
                  setSelectedReferenceId(null);
                  setSelectedStageNode(null);
                }}
              >
                Add text label
              </button>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/*"
                onChange={loadReferenceImage}
                hidden
              />
              <div className="layers asset-layers">
                {orderedAssets.map((asset) => (
                  <button
                    draggable={!asset.locked}
                    className={selectedStageAssetIds.includes(asset.id) || (asset.assetType === "image" ? selectedReferenceId === asset.id : asset.assetType === "text" ? selectedTextId === asset.id : selectedZoneId === asset.id) ? "active" : ""}
                    key={asset.id}
                    onDragStart={() => { assetDragRef.current = asset.id; }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => { if (assetDragRef.current) reorderAsset(assetDragRef.current, asset.id); assetDragRef.current = null; }}
                    onClick={() => {
                      if (asset.assetType === "image") { setSelectedReferenceId(asset.id); setSelectedZoneId(null); setSelectedTextId(null); }
                      else if (asset.assetType === "text") { setSelectedTextId(asset.id); setSelectedZoneId(null); setSelectedReferenceId(null); }
                      else { setSelectedZoneId(asset.id); setSelectedTextId(null); setSelectedReferenceId(null); }
                      setSelectedStageNode(null);
                      setSelectedStageAssetIds([asset.id]);
                    }}
                  >
                    <i style={{ background: asset.assetType === "image" ? "#d8d8d8" : asset.assetType === "text" ? asset.color : asset.fill || "#f7f6ef" }} />
                    <span className="asset-name">{asset.name || (asset.assetType === "image" ? "Background image" : asset.assetType === "text" ? "Text" : "Zone")}<span className="asset-lock" role="button" title={asset.locked ? "Unlock asset" : "Lock asset"} onClick={(event) => { event.stopPropagation(); toggleAssetLock(asset); }}>{asset.locked ? "🔒" : "🔓"}</span></span>
                    <small>{asset.assetType === "image" ? "image" : asset.assetType === "text" ? "text" : asset.label ? "label zone" : asset.solid ? "solid zone" : "aesthetic zone"}</small>
                  </button>
                ))}
              </div>
              <button className={`stage-boundary-toggle${selectedStageAssetIds.includes("stage-boundary") ? " selected" : ""}`} type="button" aria-expanded={stageNodesExpanded} onClick={()=>setStageNodesExpanded(value=>!value)}><span>STAGE BOUNDARY</span><small>{stageNodes.length} nodes</small><span className="asset-lock" role="button" title={stageBoundaryLocked ? "Unlock main stage" : "Lock main stage"} onClick={event=>{event.stopPropagation();checkpoint();setStageBoundaryLocked(value=>!value);setSelectedStageNode(null);setSelectedStageAssetIds([]);}}>{stageBoundaryLocked ? "🔒" : "🔓"}</span><b>{stageNodesExpanded ? "−" : "+"}</b></button>
              <p className="handle-help">
                <b>Shift-click</b> a highlighted edge to insert a node.{" "}
                <b>Ctrl-click</b> an edge to make it a smooth curve. Select a
                curved segment to change its handle mode.
              </p>
              {stageNodesExpanded && <div className="layers">
                {stageNodes.map((node, index) => (
                  <button
                    disabled={stageBoundaryLocked}
                    className={
                      !selectedZoneId && selectedStageNode === index
                        ? "active"
                        : ""
                    }
                    key={index}
                    onClick={() => {
                      setSelectedStageNode(index);
                      setSelectedZoneId(null);
                      setReferenceSelected(false);
                    }}
                  >
                    <i />
                    <span>Node {index + 1}</span>
                    <small>{segmentMode(node)}</small>
                  </button>
                ))}
              </div>}
              <p className="eyebrow advanced-title">ZONES</p>
              <button
                className="group-button"
                onClick={() => {
                  const id = `zone-${Date.now()}`;
                  const x = realWidth * 0.25;
                  const y = realDepth * 0.25;
                  setZones((old) => [
                    ...old,
                    {
                      id,
                      name: `Zone ${old.length + 1}`,
                      solid: false,
                      label: false,
                      locked: false,
                      fill: "#8eb6d8",
                      fillOpacity: 0.25,
                      stroke: "#447799",
                      strokeWidth: 2,
                      strokeOpacity: 1,
                      zOrder: old.length + referenceImages.length,
                      nodes: [
                        { x, y, curveMode: "line" },
                        { x: x + realWidth * 0.3, y, curveMode: "line" },
                        {
                          x: x + realWidth * 0.3,
                          y: y + realDepth * 0.3,
                          curveMode: "line",
                        },
                        { x, y: y + realDepth * 0.3, curveMode: "line" },
                      ],
                    },
                  ]);
                  setSelectedZoneId(id);
                  setSelectedStageNode(null);
                }}
              >
                Add zone
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">REFERENCE IMAGES</p>
              <button className="group-button" onClick={()=>imageFileRef.current?.click()}>Add background image</button>
              <input ref={imageFileRef} type="file" accept="image/*" onChange={loadReferenceImage} hidden />
              <div className="layers asset-layers">{referenceImages.map(image=><button key={image.id} draggable={!image.locked} onDragStart={(event)=>{assetDragRef.current=image.id;event.dataTransfer.setData("text/plain",image.id);}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(assetDragRef.current)reorderAsset(assetDragRef.current,image.id);assetDragRef.current=null;}} className={selectedReferenceId===image.id?"active":""} onClick={()=>{setSelectedReferenceId(image.id);setSelectedId(null);setSelectedGroupId(null);setMultiSelectedIds([]);}}><i style={{background:"#d8d8d8"}}/><span>{image.name}</span><small>{image.locked?"locked":"image"}</small></button>)}</div>
              <p className="eyebrow advanced-title">SHAPES</p>
              <div className="shape-grid">
                {PALETTE.map((tool) => (
                  <button key={tool.type} onClick={() => add(tool.type)}>
                    <b>{tool.glyph}</b>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
              <p className="eyebrow advanced-title">ADVANCED SHAPES</p>
              <div className="shape-grid advanced-grid">
                {ADVANCED_PALETTE.map(tool => <button key={tool.type} onClick={()=>add(tool.type)}><b>{tool.glyph}</b><span>{tool.label}</span></button>)}
              </div>
              <p className="eyebrow advanced-title">CUSTOM SHAPES</p>
              <div className="shape-grid custom-grid">{advancedPresets.map(preset=><button key={preset.id} title={preset.label} onClick={()=>addAdvancedPreset(preset)}><b><svg className="advanced-preset-preview" viewBox={`0 0 ${preset.dimensions.widthMeters} ${preset.dimensions.depthMeters}`}>{preset.editor.layers.map(layer=><Shape key={layer.id} item={layer}/>)}</svg></b><span>{preset.label}</span></button>)}</div>
              {!advancedPresets.length && <p className="handle-help">Save artwork as a custom shape to reuse it here.</p>}
              <button className="group-button manage-custom-button" onClick={()=>setManageCustomOpen(true)}>Manage custom shapes</button>
              <button className="group-button" onClick={()=>{refreshLibrary();setManageGroupsOpen(true);}}>Manage equipment groups</button>
              <p className="eyebrow layer-title">
                LAYERS <span>{items.length}</span>
              </p>
              <div className="layers">
                {[...items].reverse().map((item) => (
                  <button
                    className={
                      item.id === selectedId ||
                      multiSelectedIds.includes(item.id) ||
                      item.editorGroupId === selectedGroupId
                        ? "active"
                        : ""
                    }
                    key={item.id}
                    draggable
                    onDragStart={(event)=>{assetDragRef.current=item.id;event.dataTransfer.setData("text/plain",String(item.id));}}
                    onDragOver={(event)=>event.preventDefault()}
                    onDrop={(event)=>{event.preventDefault();const from=items.findIndex(layer=>layer.id===assetDragRef.current),to=items.findIndex(layer=>layer.id===item.id);if(from<0||from===to)return;checkpoint();const copy=[...items];copy.splice(to,0,copy.splice(from,1)[0]);setItems(copy);assetDragRef.current=null;}}
                    onClick={(event)=>{setVectorNodeIndex(null);selectLayer(event,item);}}
                  >
                    <i style={{ background: item.fill }} />{" "}
                    <span>
                      {item.editorGroupId ? `↳ ${item.name}` : item.name}
                    </span>
                    <small>{rotationParts.find(part=>part.id===item.rotationPartId)?.name || (item.editorGroupId ? "grouped" : item.type)}</small>
                  </button>
                ))}
              </div>
              <button className="group-button" disabled={!selectedId && !selectedGroupId && !multiSelectedIds.length} onClick={createRotationPart}>+ Rotation control from selection</button>
              {effectiveRotationParts.length > 0 && <><p className="eyebrow advanced-title">ROTATION CONTROLS</p>{effectiveRotationParts.map(part=><div className="rotation-part-card" key={part.id}>
                <input aria-label="Rotation part name" value={part.name} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,name:event.target.value}:value))}/>
                <div className="field-row"><label className="field">PIVOT X (CM)<CommittedNumberInput type="number" step="1" disabled={part.pivotLockedToTripod} value={part.pivotX} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,pivotX:+event.target.value}:value))}/></label><label className="field">PIVOT Y (CM)<CommittedNumberInput type="number" step="1" disabled={part.pivotLockedToTripod} value={part.pivotY} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,pivotY:+event.target.value}:value))}/></label></div>
                {part.pivotLockedToTripod && <p className="handle-help">Pivot locked to the tripod hub.</p>}
                <div className="field-row"><label className="field">MIN °<CommittedNumberInput type="number" step="1" value={part.minRotation} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,minRotation:+event.target.value}:value))}/></label><label className="field">MAX °<CommittedNumberInput type="number" step="1" value={part.maxRotation} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,maxRotation:+event.target.value}:value))}/></label></div>
                <button className="delete" onClick={()=>{checkpoint();setRotationParts(old=>old.filter(value=>value.id!==part.id));setItems(old=>old.map(item=>item.rotationPartId===part.id?{...item,rotationPartId:undefined}:item));}}>Remove control</button>
              </div>)}</>}
            </>
          )}
        </aside>
        <section className="workbench">
          <div className="toolbar">
            <span>
              CANVAS {realWidth} × {realDepth} M · GRID 0.1 M
            </span>
            <button onClick={undo} disabled={!history.length}>
              Undo {history.length}/10
            </button>
            <button
              onClick={() => setZoom((value) => Math.max(0.25, value / 1.2))}
            >
              −
            </button>
            <b>{Math.round(zoom * 100)}%</b>
            <button
              onClick={() => setZoom((value) => Math.min(6, value * 1.2))}
            >
              +
            </button>
            <button onClick={resetView}>Fit</button>
            {documentMode === "item" && <button disabled={!items.length} onClick={()=>{setPresetName(shapeName);setPresetDialogOpen(true);}}>Save as custom shape</button>}
            <label><input type="checkbox" checked={!canvasResizeEnabled} onChange={(event)=>setCanvasResizeEnabled(!event.target.checked)} /> Lock canvas size</label>
            <label>
              <input
                type="checkbox"
                checked={grid}
                onChange={(e) => setGrid(e.target.checked)}
              />{" "}
              Grid
            </label>
            <label>
              Snap{" "}
              <select
                value={snapMode}
                onChange={(e) => setSnapMode(e.target.value)}
              >
                <option value="standard">10 cm</option>
                <option value="advanced">Advanced · 1 cm</option>
                <option value="off">Off</option>
              </select>
            </label>
          </div>
          <div
            className="viewport"
            ref={viewportRef}
            onWheel={zoomViewport}
            onPointerDownCapture={event=>{if(event.button===1)startPan(event);}}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={finishViewportDrag}
            onPointerCancel={() => {
              panRef.current = null;
              marqueeRef.current = null;
              setMarquee(null);
            }}
          >
            <div
              className="canvas-shell"
              style={{
                aspectRatio: `${realWidth} / ${realDepth}`,
                width: canvasResizeView ? `${realWidth * canvasResizeView.pixelsPerMeter * (documentMode === "stage" ? zoom : 1)}px` : `min(${76 * (documentMode === "stage" ? zoom : 1)}%, ${(68 * realWidth) / realDepth * (documentMode === "stage" ? zoom : 1)}vh)`,
                height: canvasResizeView ? `${realDepth * canvasResizeView.pixelsPerMeter * (documentMode === "stage" ? zoom : 1)}px` : undefined,
                willChange: documentMode === "stage" ? "auto" : "transform",
                transform: `translate(${pan.x + (canvasResizeView ? (realWidth - canvasResizeView.width) * canvasResizeView.pixelsPerMeter * zoom / 2 : 0)}px, ${pan.y + (canvasResizeView ? (realDepth - canvasResizeView.depth) * canvasResizeView.pixelsPerMeter * zoom / 2 : 0)}px) scale(${documentMode === "stage" ? 1 : zoom})`,
              }}
            >
              <svg
                ref={canvasRef}
                className={`canvas ${grid ? "show-grid" : ""}`}
                viewBox={`0 0 ${realWidth} ${realDepth}`}
                onPointerDownCapture={event=>{if(vectorDrawing)drawVectorPoint(event);else captureStageControl(event);}}
                onPointerMove={
                  (event) => { if(vectorDrawing){setVectorPreview(stagePointer(event,false));return;} if (stageDragRef.current || documentMode === "stage") moveStageNode(event); else pointerMove(event); }
                }
                onPointerUp={() => {
                  dragRef.current = null;
                  handleRef.current = null;
                  rotationDragRef.current = null;
                  stageDragRef.current = null;
                }}
                onPointerCancel={() => {
                  dragRef.current = null;
                  handleRef.current = null;
                  rotationDragRef.current = null;
                  stageDragRef.current = null;
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  setSelectedId(null);
                  setSelectedReferenceId(null);
                  if (documentMode === "stage") {
                    setSelectedStageNode(null);
                    setReferenceSelected(false);
                  }
                }}
              >
                <defs>
                  <pattern
                    id="smallGrid"
                    width=".1"
                    height=".1"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M .1 0 L 0 0 0 .1"
                      fill="none"
                      stroke="#777"
                      strokeWidth=".003"
                    />
                  </pattern>
                  <pattern
                    id="grid"
                    width=".5"
                    height=".5"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width=".5" height=".5" fill="url(#smallGrid)" />
                    <path
                      d="M .5 0 L 0 0 0 .5"
                      fill="none"
                      stroke="#777"
                      strokeWidth=".006"
                    />
                  </pattern>
                </defs>
                {grid && (
                  <rect
                    width={realWidth}
                    height={realDepth}
                    fill="url(#grid)"
                  />
                )}
                {documentMode === "stage" && (
                  <path className={`stage-floor stage-floor-drag${stageBoundaryLocked ? " locked" : ""}`} d={stagePath(stageNodes)} onPointerDown={stageBoundaryLocked ? undefined : (event)=>startAssetMove(event,{id:"stage-boundary",nodes:stageNodes,locked:false},"stage")} />
                )}
                {documentMode === "stage" && (
                  <g className="ordered-stage-assets">
                    {[...orderedAssets].reverse().map((asset) =>
                      asset.assetType === "image" ? (
                        <svg key={asset.id} className={asset.locked ? "ordered-reference locked" : "ordered-reference"} x={asset.x} y={asset.y} width={asset.width} height={asset.height} viewBox={`${asset.crop?.left || 0} ${asset.crop?.top || 0} ${1 - (asset.crop?.left || 0) - (asset.crop?.right || 0)} ${1 - (asset.crop?.top || 0) - (asset.crop?.bottom || 0)}`} preserveAspectRatio="none" opacity={asset.opacity} overflow="hidden" onPointerDown={asset.locked ? undefined : (event) => startAssetMove(event, asset, "image")}>
                          <image href={asset.dataUrl} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
                        </svg>
                      ) : asset.assetType === "text" ? (
                        <text key={asset.id} x={asset.x} y={asset.y} fill={asset.color} fillOpacity={asset.opacity} fontSize={asset.fontSize} textAnchor="middle" dominantBaseline="middle" className={asset.locked ? "stage-text locked" : "stage-text"} onPointerDown={(event) => startAssetMove(event, asset, "text")}>{asset.text}</text>
                      ) : (
                        <path pointerEvents="none" key={asset.id} d={stagePath(asset.nodes)} fill={asset.fill || "#f7f6ef"} fillOpacity={asset.fillOpacity ?? 1} stroke={asset.stroke || "#71851f"} strokeOpacity={asset.strokeOpacity ?? 1} strokeWidth={asset.strokeWidth ?? 2} vectorEffect="non-scaling-stroke" />
                      ),
                    )}
                  </g>
                )}
                {documentMode === "stage" ? (
                  <g className="stage-boundary-editor">
                    {referenceImage && (
                      <g
                        className="reference-image"
                        onPointerDown={referenceImage.locked ? undefined : (event) => startAssetMove(event, referenceImage, "image")}
                      >
                        <image
                          opacity="0"
                          href={referenceImage.dataUrl}
                          x={referenceImage.x}
                          y={referenceImage.y}
                          width={referenceImage.width}
                          height={referenceImage.height}
                          preserveAspectRatio="none"
                        />
                        {referenceSelected && (
                          <>
                            <rect
                              className="reference-image-frame"
                              x={referenceImage.x}
                              y={referenceImage.y}
                              width={referenceImage.width}
                              height={referenceImage.height}
                              pointerEvents={referenceImage.locked ? "none" : "stroke"}
                              onPointerDown={startReferenceCrop}
                            />
                            <circle
                              className="image-resize"
                              cx={referenceImage.x + referenceImage.width}
                              cy={referenceImage.y + referenceImage.height}
                              r=".045"
                              onPointerDown={(event) =>
                                startReferenceDrag(event, "image-resize")
                              }
                            />
                          </>
                        )}
                      </g>
                    )}
                    {zones.map((zone) => (
                      <g key={zone.id} className={zone.locked ? "editable-zone locked" : "editable-zone"}>
                        <path className="zone-move-hit" d={stagePath(zone.nodes)} onPointerDown={(event) => startAssetMove(event, zone, "zone")} />
                        <path
                          d={stagePath(zone.nodes)}
                          fill="none"
                          stroke="none"
                          strokeWidth={zone.solid ? 2 : zone.strokeWidth}
                          vectorEffect="non-scaling-stroke"
                        />
                        {!zone.locked && zone.nodes.map((node, index) => {
                          const previous =
                            zone.nodes[
                              (index - 1 + zone.nodes.length) %
                                zone.nodes.length
                            ];
                          const mode = segmentMode(node);
                          const smooth = smoothControl(previous, node);
                          const bezier = bezierGeometry(previous, node);
                          const active =
                            selectedZoneId === zone.id &&
                            selectedStageNode === index;
                          return (
                            <g key={index}>
                              <path
                                className="segment-hit"
                                d={`M ${previous.x} ${previous.y} ${stageSegmentPath(previous, node)}`}
                                onClick={(event) =>
                                  stageSegmentClick(event, index, zone.id)
                                }
                              />
                              {active && mode === "smooth" && (
                                <>
                                  <path
                                    className="control-line"
                                    d={`M ${(previous.x + node.x) / 2} ${(previous.y + node.y) / 2} L ${smooth.x} ${smooth.y}`}
                                  />
                                  <circle
                                    className="curve-control"
                                    cx={smooth.x}
                                    cy={smooth.y}
                                    r=".045"
                                    onPointerDown={(event) =>
                                      startStageNodeDrag(
                                        event,
                                        index,
                                        "smooth",
                                        zone.id,
                                      )
                                    }
                                  />
                                </>
                              )}
                              {active && mode === "bezier" && (
                                <>
                                  <path
                                    className="control-line"
                                    d={`M ${previous.x} ${previous.y} L ${bezier.startOut.x} ${bezier.startOut.y} M ${bezier.midpoint.x} ${bezier.midpoint.y} L ${bezier.midIn.x} ${bezier.midIn.y} M ${bezier.midpoint.x} ${bezier.midpoint.y} L ${bezier.midOut.x} ${bezier.midOut.y} M ${node.x} ${node.y} L ${bezier.endIn.x} ${bezier.endIn.y}`}
                                  />
                                  <circle
                                    className="bezier-control"
                                    cx={bezier.startOut.x}
                                    cy={bezier.startOut.y}
                                    r=".035"
                                    onPointerDown={(event) =>
                                      startStageNodeDrag(
                                        event,
                                        index,
                                        "startOut",
                                        zone.id,
                                      )
                                    }
                                  />
                                  <circle
                                    className="bezier-control"
                                    cx={bezier.midIn.x}
                                    cy={bezier.midIn.y}
                                    r=".035"
                                    onPointerDown={(event) =>
                                      startStageNodeDrag(
                                        event,
                                        index,
                                        "midIn",
                                        zone.id,
                                      )
                                    }
                                  />
                                  <circle
                                    className="curve-control"
                                    cx={bezier.midpoint.x}
                                    cy={bezier.midpoint.y}
                                    r=".045"
                                    onPointerDown={(event) =>
                                      startStageNodeDrag(
                                        event,
                                        index,
                                        "midpoint",
                                        zone.id,
                                      )
                                    }
                                  />
                                  <circle
                                    className="bezier-control"
                                    cx={bezier.midOut.x}
                                    cy={bezier.midOut.y}
                                    r=".035"
                                    onPointerDown={(event) =>
                                      startStageNodeDrag(
                                        event,
                                        index,
                                        "midOut",
                                        zone.id,
                                      )
                                    }
                                  />
                                  <circle
                                    className="bezier-control"
                                    cx={bezier.endIn.x}
                                    cy={bezier.endIn.y}
                                    r=".035"
                                    onPointerDown={(event) =>
                                      startStageNodeDrag(
                                        event,
                                        index,
                                        "endIn",
                                        zone.id,
                                      )
                                    }
                                  />
                                </>
                              )}
                              <circle
                                className={
                                  active
                                    ? "boundary-node selected"
                                    : "boundary-node"
                                }
                                cx={node.x}
                                cy={node.y}
                                r=".04"
                                onPointerDown={(event) =>
                                  startStageNodeDrag(
                                    event,
                                    index,
                                    "node",
                                    zone.id,
                                  )
                                }
                              />
                            </g>
                          );
                        })}
                      </g>
                    ))}
                    {!stageBoundaryLocked && stageNodes.map((node, index) => {
                      const previous =
                        stageNodes[
                          (index - 1 + stageNodes.length) % stageNodes.length
                        ];
                      const mode = segmentMode(node);
                      const smooth = smoothControl(previous, node);
                      const bezier = bezierGeometry(previous, node);
                      return (
                        <g key={index}>
                          <path
                            className="segment-hit"
                            d={`M ${previous.x} ${previous.y} ${stageSegmentPath(previous, node)}`}
                            onClick={(event) => stageSegmentClick(event, index)}
                          />
                          {!selectedZoneId &&
                            selectedStageNode === index &&
                            mode === "smooth" && (
                              <>
                                <path
                                  className="control-line"
                                  d={`M ${(previous.x + node.x) / 2} ${(previous.y + node.y) / 2} L ${smooth.x} ${smooth.y}`}
                                />
                                <circle
                                  className="curve-control"
                                  cx={smooth.x}
                                  cy={smooth.y}
                                  r=".045"
                                  onPointerDown={(event) =>
                                    startStageNodeDrag(event, index, "smooth")
                                  }
                                />
                              </>
                            )}
                          {!selectedZoneId &&
                            selectedStageNode === index &&
                            mode === "bezier" && (
                              <>
                                <path
                                  className="control-line"
                                  d={`M ${previous.x} ${previous.y} L ${bezier.startOut.x} ${bezier.startOut.y} M ${bezier.midpoint.x} ${bezier.midpoint.y} L ${bezier.midIn.x} ${bezier.midIn.y} M ${bezier.midpoint.x} ${bezier.midpoint.y} L ${bezier.midOut.x} ${bezier.midOut.y} M ${node.x} ${node.y} L ${bezier.endIn.x} ${bezier.endIn.y}`}
                                />
                                <circle
                                  className="bezier-control"
                                  cx={bezier.startOut.x}
                                  cy={bezier.startOut.y}
                                  r=".035"
                                  onPointerDown={(event) =>
                                    startStageNodeDrag(event, index, "startOut")
                                  }
                                />
                                <circle
                                  className="bezier-control"
                                  cx={bezier.midIn.x}
                                  cy={bezier.midIn.y}
                                  r=".035"
                                  onPointerDown={(event) =>
                                    startStageNodeDrag(event, index, "midIn")
                                  }
                                />
                                <circle
                                  className="curve-control"
                                  cx={bezier.midpoint.x}
                                  cy={bezier.midpoint.y}
                                  r=".045"
                                  onPointerDown={(event) =>
                                    startStageNodeDrag(event, index, "midpoint")
                                  }
                                />
                                <circle
                                  className="bezier-control"
                                  cx={bezier.midOut.x}
                                  cy={bezier.midOut.y}
                                  r=".035"
                                  onPointerDown={(event) =>
                                    startStageNodeDrag(event, index, "midOut")
                                  }
                                />
                                <circle
                                  className="bezier-control"
                                  cx={bezier.endIn.x}
                                  cy={bezier.endIn.y}
                                  r=".035"
                                  onPointerDown={(event) =>
                                    startStageNodeDrag(event, index, "endIn")
                                  }
                                />
                              </>
                            )}
                          <circle
                            className={
                              !selectedZoneId && selectedStageNode === index
                                ? "boundary-node selected"
                                : "boundary-node"
                            }
                            cx={node.x}
                            cy={node.y}
                            r=".04"
                            onPointerDown={(event) =>
                              startStageNodeDrag(event, index)
                            }
                          />
                        </g>
                      );
                    })}
                  </g>
                ) : (
                  <>
                    <EquipmentReferences images={referenceImages} selectedImage={referenceImage} onDrag={startReferenceDrag} onCrop={startReferenceCrop} />
                    {items.map((item) => (
                      <Shape
                        key={item.id}
                        item={item}
                        selected={
                          !vectorDrawing && (item.id === selectedId ||
                          multiSelectedIds.includes(item.id))
                        }
                        onPointerDown={(e) => pointerDown(e, item)}
                        onHandlePointerDown={item.id === selectedId ? startHandleDrag : undefined}
                        vectorEditor={item.id === selectedId && item.type === "vector" ? <VectorEditor item={item} index={vectorNodeIndex} onSelect={setVectorNodeIndex} onDrag={startHandleDrag} onCurve={(index)=>update({nodes:item.nodes.map((node,i)=>i===index?{...node,curveMode:"pointArc",arcDepth:0}:node)})} onInsert={(index)=>{const nodes=[...item.nodes];nodes.splice(index,0,{...segmentMidpoint(nodes[(index-1+nodes.length)%nodes.length],nodes[index]),curveMode:"line"});update({nodes});setVectorNodeIndex(index);}} /> : null}
                      />
                    ))}
                    {cornerSnapping && [{x:0,y:0},{x:realWidth,y:0},{x:realWidth,y:realDepth},{x:0,y:realDepth}].map((point,index)=><circle key={`snap-${index}`} className="snap-point-guide" cx={point.x} cy={point.y} r=".025" pointerEvents="none"><title>Stageplot snap point</title></circle>)}
                    {items
                      .filter((item) => item.collision)
                      .map((item) => (
                        <CollisionGuide
                          key={`collision-${item.id}`}
                          item={item}
                        />
                      ))}
                    {groupBounds && (
                      <g><g className="rotation-handles"><line x1={(groupBounds.x+groupBounds.right)/2} y1={groupBounds.y} x2={(groupBounds.x+groupBounds.right)/2} y2={groupBounds.y-.1}/><circle cx={(groupBounds.x+groupBounds.right)/2} cy={groupBounds.y-.13} r=".03" onPointerDown={event=>startRotationDrag(event)}><title>Rotate group (Shift: 15-degree steps)</title></circle></g><rect
                        className="group-selection"
                        x={groupBounds.x - 0.03}
                        y={groupBounds.y - 0.03}
                        width={groupBounds.right - groupBounds.x + 0.06}
                        height={groupBounds.bottom - groupBounds.y + 0.06}
                      /></g>
                    )}
                  </>
                )}
                {documentMode === "stage" &&
                  stageNode &&
                  !selectedZone?.locked &&
                  segmentMode(stageNode) === "pointArc" &&
                  (() => {
                    const nodes = selectedZone?.nodes || stageNodes;
                    const previous =
                      nodes[
                        (selectedStageNode - 1 + nodes.length) % nodes.length
                      ];
                    const point = pointOnArc(previous, stageNode);
                    return (
                      <g>
                        <circle
                          className="curve-control point-on-arc"
                          cx={point.x}
                          cy={point.y}
                          r=".045"
                          onPointerDown={(event) =>
                            startStageNodeDrag(
                              event,
                              selectedStageNode,
                              "pointArc",
                              selectedZoneId,
                            )
                          }
                        />
                      </g>
                    );
                    })()}
                {canvasResizeEnabled && <><line className="canvas-resize-edge width" x1={realWidth} y1="0" x2={realWidth} y2={realDepth} onPointerDown={(event) => startCanvasResize(event, "width")} /><line className="canvas-resize-edge depth" x1="0" y1={realDepth} x2={realWidth} y2={realDepth} onPointerDown={(event) => startCanvasResize(event, "depth")} /></>}
                <g className="stage-control-overlay">{activeStageControls.map(([kind,point])=><g key={kind}>
                  <circle className="stage-control-hit" cx={point.x} cy={point.y} r=".7%" onPointerDown={event=>startStageNodeDrag(event,selectedStageNode,kind,selectedZoneId)} />
                  <circle className={['smooth','pointArc','midpoint'].includes(kind)?'curve-control':'bezier-control'} cx={point.x} cy={point.y} r=".7%" pointerEvents="none" />
                </g>)}</g>
                {vectorDrawing && <g className="vector-drawing-overlay">
                  <rect width={realWidth} height={realDepth} fill="transparent" />
                  {drawnVector && vectorPreview && <path className="vector-drawing-preview" d={`M ${drawnVector.x+drawnVector.nodes.at(-1).x} ${drawnVector.y+drawnVector.nodes.at(-1).y} L ${vectorPreview.x} ${vectorPreview.y}`} />}
                  {drawnVector?.nodes.map((node,index)=><circle key={index} cx={drawnVector.x+node.x} cy={drawnVector.y+node.y} r=".012" fill={index===0 ? "#d6ff46" : index===drawnVector.nodes.length-1 ? "#ffbf3f" : "white"} stroke="#35400f" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
                </g>}
              </svg>
              <div className="axis x">{documentMode === "stage" ? `${realWidth.toFixed(2)} m` : `${Math.round(realWidth * 100)} cm`}</div>
              <div className="axis y">{documentMode === "stage" ? `${realDepth.toFixed(2)} m` : `${Math.round(realDepth * 100)} cm`}</div>
            </div>
            <p className="canvas-help">
              {vectorDrawing ? "Click to add points · Click the first point to close · Click the last point or Esc to finish" : <>Scroll to zoom · Middle-drag to pan · Left-drag empty space to select · Dimensions are {documentMode === "stage" ? "metres" : "centimetres"}</>}
            </p>
            {marquee && <div className="selection-marquee" style={{left:marquee.x,top:marquee.y,width:marquee.right-marquee.x,height:marquee.bottom-marquee.y}} />}
          </div>
        </section>
        <aside className="inspector">
          <p className="eyebrow">INSPECTOR</p>
          {documentMode === "stage" ? (
            <>
              <p className="inspector-context">
                {stageNode
                  ? `Boundary node ${selectedStageNode + 1}`
                  : "Stage and boundary settings"}
              </p>
              <label className="field">
                STAGE NAME
                <input
                  value={shapeName}
                  onChange={(e) => setShapeName(e.target.value)}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  WIDTH ({documentMode === "stage" ? "M" : "CM"})
                  <CommittedNumberInput
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={realWidth}
                    onChange={(e) =>
                      setRealWidth(Math.max(0.01, +e.target.value))
                    }
                  />
                </label>
                <label className="field">
                  DEPTH ({documentMode === "stage" ? "M" : "CM"})
                  <CommittedNumberInput
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={realDepth}
                    onChange={(e) =>
                      setRealDepth(Math.max(0.01, +e.target.value))
                    }
                  />
                </label>
              </div>
              <label className="collision-toggle">
                <input type="checkbox" checked={canvasResizeEnabled} onChange={(event) => setCanvasResizeEnabled(event.target.checked)} />
                <span><b>Enable canvas resizing</b><small>Shows Ctrl-drag handles on the right and bottom edges.</small></span>
              </label>
              {selectedZone && (
                <>
                  <p className="eyebrow advanced-title">ZONE</p>
                  <label className="field">
                    ZONE NAME
                    <input
                      value={selectedZone.name}
                      onChange={(e) =>
                        updateSelectedZone({ name: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">ZONE TYPE<select value={selectedZone.label ? "label" : selectedZone.solid ? "solid" : "aesthetic"} onChange={(e) => updateSelectedZone({ solid: e.target.value === "solid", label: e.target.value === "label" })}><option value="aesthetic">Aesthetic</option><option value="solid">Solid (collision)</option><option value="label">Label (outside stage)</option></select></label>
                  {(
                    <>
                      <div className="field-row colors">
                        <label className="field">
                          FILL
                          <ColourPicker
                            value={selectedZone.fill}
                            onChange={(e) =>
                              updateSelectedZone({ fill: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          LINE
                          <ColourPicker
                            value={selectedZone.stroke}
                            onChange={(e) =>
                              updateSelectedZone({ stroke: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <label className="field">
                        FILL TRANSPARENCY{" "}
                        <span>
                          {Math.round((1 - selectedZone.fillOpacity) * 100)}%
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step=".05"
                          value={1 - selectedZone.fillOpacity}
                          onChange={(e) =>
                            updateSelectedZone({
                              fillOpacity: 1 - +e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        LINE THICKNESS <span>{selectedZone.strokeWidth}px</span>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step=".5"
                          value={selectedZone.strokeWidth}
                          onChange={(e) =>
                            updateSelectedZone({ strokeWidth: +e.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        LINE TRANSPARENCY{" "}
                        <span>
                          {Math.round((1 - selectedZone.strokeOpacity) * 100)}%
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step=".05"
                          value={1 - selectedZone.strokeOpacity}
                          onChange={(e) =>
                            updateSelectedZone({
                              strokeOpacity: 1 - +e.target.value,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  <button
                    className="delete"
                    onClick={() => {
                      setZones((old) =>
                        old.filter((zone) => zone.id !== selectedZoneId),
                      );
                      setSelectedZoneId(null);
                      setSelectedStageNode(null);
                    }}
                  >
                    Delete zone
                  </button>
                </>
              )}
              {selectedText && (
                <>
                  <p className="eyebrow advanced-title">TEXT</p>
                  <label className="field">NAME<input value={selectedText.name} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, name: e.target.value } : item))} /></label>
                  <label className="field">TEXT<input value={selectedText.text} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, text: e.target.value } : item))} /></label>
                  <label className="field">SIZE ({documentMode === "stage" ? "M" : "CM"})<CommittedNumberInput type="number" min="0.05" step="0.05" value={selectedText.fontSize} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, fontSize: Math.max(.05, +e.target.value) } : item))} /></label>
                  <label className="field">COLOUR<ColourPicker value={selectedText.color} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, color: e.target.value } : item))} /></label>
                  <label className="field">TRANSPARENCY <span>{Math.round((1 - selectedText.opacity) * 100)}%</span><input type="range" min="0" max="1" step=".05" value={1 - selectedText.opacity} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, opacity: 1 - +e.target.value } : item))} /></label>
                  <button className="delete" onClick={() => { setTextItems((old) => old.filter((item) => item.id !== selectedText.id)); setSelectedTextId(null); }}>Delete text</button>
                </>
              )}
              {referenceSelected && <ReferenceInspector referenceImage={referenceImage} setReferenceImage={setReferenceImage} />}
              {stageNode && (
                <>
                  <div className="field-row">
                    <label className="field">
                      NODE X ({documentMode === "stage" ? "M" : "CM"})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={stageNode.x}
                        onChange={(e) =>
                          updateBoundaryNode({ x: +e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      NODE Y ({documentMode === "stage" ? "M" : "CM"})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={stageNode.y}
                        onChange={(e) =>
                          updateBoundaryNode({ y: +e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    INCOMING SEGMENT
                    <select
                      value={segmentMode(stageNode)}
                      onChange={(e) =>
                        updateBoundaryNode({
                          curveMode: e.target.value,
                          curve: undefined,
                          bulge:
                            e.target.value === "smooth" ? 0 : stageNode.bulge,
                        })
                      }
                    >
                      <option value="line">Straight line</option>
                      <option value="pointArc">Point on Arc</option>
                      <option value="smooth">Smooth curve</option>
                      <option value="bezier">Bézier</option>
                    </select>
                  </label>
                  {segmentMode(stageNode) === "pointArc" && (
                    <p className="handle-help">The amber point stays at the parameter midpoint of the arc.</p>
                  )}
                  {segmentMode(stageNode) === "smooth" && (
                    <p className="handle-help">
                      The amber quadratic control point can be dragged freely.
                    </p>
                  )}
                  {segmentMode(stageNode) === "bezier" && (
                    <p className="handle-help">
                      Drag the four small Bézier handles at the endpoints and
                      midpoint. Drag the amber midpoint node to reposition the
                      centre of the curve.
                    </p>
                  )}
                  <button
                    className="delete"
                    disabled={
                      (selectedZone?.nodes.length || stageNodes.length) <= 3
                    }
                    onClick={() => {
                      if (selectedZoneId)
                        setZones((old) =>
                          old.map((zone) =>
                            zone.id === selectedZoneId
                              ? {
                                  ...zone,
                                  nodes: zone.nodes.filter(
                                    (_, index) => index !== selectedStageNode,
                                  ),
                                }
                              : zone,
                          ),
                        );
                      else
                        setStageNodes((old) =>
                          old.filter((_, index) => index !== selectedStageNode),
                        );
                      setSelectedStageNode(null);
                    }}
                  >
                    Delete boundary node
                  </button>
                </>
              )}
              {stageNode && (
                <>
                  <div className="field-row">
                    <label className="field">
                      NODE X ({documentMode === "stage" ? "M" : "CM"})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={stageNode.x}
                        onChange={(e) =>
                          updateBoundaryNode({ x: +e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      NODE Y ({documentMode === "stage" ? "M" : "CM"})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={stageNode.y}
                        onChange={(e) =>
                          updateBoundaryNode({ y: +e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    INCOMING SEGMENT
                    <select
                      value={segmentMode(stageNode)}
                      onChange={(e) =>
                        updateBoundaryNode({
                          curveMode: e.target.value,
                          curve: undefined,
                          bulge:
                            e.target.value === "smooth" ? 0 : stageNode.bulge,
                        })
                      }
                    >
                      <option value="line">Straight line</option>
                      <option value="pointArc">Point on Arc</option>
                      <option value="smooth">Smooth curve</option>
                      <option value="bezier">Bézier</option>
                    </select>
                  </label>
                  {segmentMode(stageNode) === "pointArc" && (
                    <p className="handle-help">
                      The amber point stays centered between the segment
                      endpoints. Drag it perpendicular to the line between them
                      to change the arc depth.
                    </p>
                  )}
                  {segmentMode(stageNode) === "smooth" && (
                    <p className="handle-help">
                      The amber quadratic control point can be dragged freely
                      and is not locked to the segment midpoint.
                    </p>
                  )}
                  {segmentMode(stageNode) === "bezier" && (
                    <p className="handle-help">
                      Drag the four small Bézier handles at the endpoints and
                      midpoint. Drag the amber midpoint node to reposition the
                      centre of the curve.
                    </p>
                  )}
                  <button
                    className="delete"
                    disabled={
                      (selectedZone?.nodes.length || stageNodes.length) <= 3
                    }
                    onClick={() => {
                      if (selectedZoneId)
                        setZones((old) =>
                          old.map((zone) =>
                            zone.id === selectedZoneId
                              ? {
                                  ...zone,
                                  nodes: zone.nodes.filter(
                                    (_, index) => index !== selectedStageNode,
                                  ),
                                }
                              : zone,
                          ),
                        );
                      else
                        setStageNodes((old) =>
                          old.filter((_, index) => index !== selectedStageNode),
                        );
                      setSelectedStageNode(null);
                    }}
                  >
                    Delete boundary node
                  </button>
                </>
              )}
              <div className="canvas-summary">
                <b>{stageNodes.length}</b>
                <span>boundary nodes</span>
                <b>{sampleStageBoundary(stageNodes).length}</b>
                <span>collision samples</span>
              </div>
              <p className="footprint-help">
                The green path is the exact visual boundary. Curves are sampled
                into collision points when the stage is saved.
              </p>
            </>
          ) : selectedGroupId ? (
            <>
              <p className="inspector-context">Selected group</p>
              <div className="group-card">
                <b>{selectedGroupItems[0]?.editorGroupName || "Group"}</b>
                <span>{selectedGroupItems.length} layers</span>
              </div>
              <p className="footprint-help">
                Drag the round handle above the group to rotate all its layers
                together. Hold Shift for 15-degree steps. Ungroup to edit
                individual layers.
              </p>
              <button className="ungroup" onClick={ungroup}>
                Ungroup layers
              </button>
              <button className="delete" onClick={remove}>
                Delete group
              </button>
            </>
          ) : multiSelectedIds.length > 1 ? (
            <>
              <p className="inspector-context">Multiple layers selected</p>
              <div className="group-card">
                <b>{multiSelectedIds.length}</b>
                <span>layers ready to group</span>
              </div>
              <button className="group-button" onClick={groupSelected}>
                Group selected layers
              </button>
              <p className="footprint-help">
                Hold Shift while clicking shapes or layer names to change the
                selection.
              </p>
            </>
          ) : referenceSelected ? (
            <><p className="inspector-context">Equipment reference image</p><ReferenceInspector referenceImage={referenceImage} setReferenceImage={setReferenceImage}/></>
          ) : !selected ? (
            <>
              <p className="inspector-context">
                Canvas and real-world item settings
              </p>
              <label className="field">
                ITEM NAME
                <input
                  value={shapeName}
                  onChange={(e) => setShapeName(e.target.value)}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  WIDTH ({documentMode === "stage" ? "M" : "CM"})
                  <CommittedNumberInput
                    type="number"
                    min="0.01"
                    step="0.1"
                    disabled={!canvasResizeEnabled} value={realWidth}
                    onChange={(e) =>
                      setRealWidth(Math.max(0.01, +e.target.value))
                    }
                  />
                </label>
                <label className="field">
                  DEPTH ({documentMode === "stage" ? "M" : "CM"})
                  <CommittedNumberInput
                    type="number"
                    min="0.01"
                    step="0.1"
                    disabled={!canvasResizeEnabled} value={realDepth}
                    onChange={(e) =>
                      setRealDepth(Math.max(0.01, +e.target.value))
                    }
                  />
                </label>
              </div>
              <label className="field">
                ITEM GROUP
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">Uncategorised</option>
                  {groups.map((group) => (
                    <option value={group.id} key={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="add-group" onClick={addGroup}>
                + Create group
              </button>
              <label className="collision-toggle">
                <input type="checkbox" checked={cornerSnapping} onChange={(event)=>{checkpoint();setCornerSnapping(event.target.checked);}} />
                <span><b>Corner snapping in Stageplot</b><small>Adds snap points to all four item-canvas corners. Off by default.</small></span>
              </label>
              <div className="canvas-summary">
                <b>{items.length}</b>
                <span>vector layers</span>
                <b>{items.filter((item) => item.collision).length}</b>
                <span>collision layers</span>
              </div>
              <p className="footprint-help">
                Changing the canvas dimensions changes its physical boundary and
                aspect ratio. Existing layer coordinates and sizes remain
                unchanged.
              </p>
            </>
          ) : (
            <>
              <p className="inspector-context">{selected.type === "compound" ? "Custom shape ? artwork is not editable" : "Selected vector layer"}</p>
              <label className="field">
                LAYER NAME
                <input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  X ({documentMode === "stage" ? "M" : "CM"})
                  <CommittedNumberInput
                    type="number"
                    step="0.01"
                    value={+selected.x.toFixed(3)}
                    onChange={(e) => update({ x: +e.target.value })}
                  />
                </label>
                <label className="field">
                  Y ({documentMode === "stage" ? "M" : "CM"})
                  <CommittedNumberInput
                    type="number"
                    step="0.01"
                    value={+selected.y.toFixed(3)}
                    onChange={(e) => update({ y: +e.target.value })}
                  />
                </label>
              </div>
              {selected.type === "text" ? <>
                <label className="field">TEXT<textarea rows="4" value={selected.text} onChange={event=>update({text:event.target.value})} /></label>
                <label className="field">TEXT SIZE ({documentMode === "stage" ? "M" : "CM"})<LiveNumberInput centimetres key={`text-size-${selected.id}`} min={.01} step=".01" value={selected.fontSize} onChange={fontSize=>update({fontSize})}/></label>
                <div className="field-row"><label><input type="checkbox" checked={selected.bold} onChange={event=>update({bold:event.target.checked})}/> Bold</label><label><input type="checkbox" checked={selected.italic} onChange={event=>update({italic:event.target.checked})}/> Italic</label></div>
                <label className="field">HORIZONTAL ALIGNMENT<select value={selected.textAlign} onChange={event=>update({textAlign:event.target.value})}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
                <label className="field">LINE SPACING<LiveNumberInput key={`text-spacing-${selected.id}`} min={.1} step=".1" value={selected.lineSpacing} onChange={lineSpacing=>update({lineSpacing})}/></label>
                <label className="field">TEXT COLOUR<ColourPicker value={selected.fill} onChange={event=>update({fill:event.target.value})}/></label>
                <p className="handle-help">Text, size and spacing update live. Enter adds a line. Bounds follow the text automatically.</p>
              </> : selected.type === "circle" ? <div className="field-row">
                <label className="field">RADIUS ({documentMode === "stage" ? "M" : "CM"})<CommittedNumberInput type="number" min=".01" step=".01" value={+(selected.width/2).toFixed(3)} onChange={(e)=>update({width:Math.max(.02,+e.target.value*2),height:Math.max(.02,+e.target.value*2)})}/></label>
                <label className="field">DIAMETER ({documentMode === "stage" ? "M" : "CM"})<CommittedNumberInput type="number" min=".02" step=".01" value={+selected.width.toFixed(3)} onChange={(e)=>update({width:Math.max(.02,+e.target.value),height:Math.max(.02,+e.target.value)})}/></label>
              </div> : selected.type === "tripod" ? (
                <label className="field">
                  LEG RADIUS ({documentMode === "stage" ? "M" : "CM"})
                  <CommittedNumberInput
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      +(
                        selected.legRadius ?? selected.width / Math.sqrt(3)
                      ).toFixed(3)
                    }
                    onChange={(e) => updateTripodRadius(+e.target.value)}
                  />
                </label>
              ) : (
                <div className="field-row">
                  <label className="field">
                    WIDTH ({documentMode === "stage" ? "M" : "CM"})
                    <CommittedNumberInput
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={+selected.width.toFixed(3)}
                      onChange={(e) => update({ width: +e.target.value })}
                    />
                  </label>
                  <label className="field">
                    HEIGHT ({documentMode === "stage" ? "M" : "CM"})
                    <CommittedNumberInput
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={+selected.height.toFixed(3)}
                      onChange={(e) => update({ height: +e.target.value })}
                    />
                  </label>
                </div>
              )}
              {["rect","roundRect","line","triangle"].includes(selected.type) && <button className="group-button" onClick={()=>{update(convertToVector(selected));setVectorNodeIndex(null);}}>Convert to editable vector</button>}
              {selected.type === "vector" && <>
                <p className="handle-help">Drag points to edit the boundary. Shift-click a straight edge to add a point; Ctrl-click an edge for Point on Arc. Select a point to edit its incoming curve.</p>
                <button className="group-button" onClick={()=>{const index=selected.open ? Math.max(1,vectorNodeIndex ?? 1) : vectorNodeIndex ?? 0,nodes=[...selected.nodes];nodes.splice(index,0,{...segmentMidpoint(nodes[(index-1+nodes.length)%nodes.length],nodes[index]),curveMode:"line"});update({nodes});setVectorNodeIndex(index);}}>Add point</button>
                {selected.nodes[vectorNodeIndex] && <>
                  <div className="field-row">{["x","y"].map(axis=><label className="field" key={axis}>POINT {axis.toUpperCase()} ({documentMode === "stage" ? "M" : "CM"})<CommittedNumberInput type="number" step=".01" value={selected.nodes[vectorNodeIndex][axis]} onChange={event=>update({nodes:selected.nodes.map((node,i)=>i===vectorNodeIndex?{...node,[axis]:+event.target.value}:node)})}/></label>)}</div>
                  <label className="field">INCOMING SEGMENT<select disabled={selected.open && vectorNodeIndex===0} value={segmentMode(selected.nodes[vectorNodeIndex])} onChange={event=>update({nodes:selected.nodes.map((node,i)=>i===vectorNodeIndex?{...node,curveMode:event.target.value}:node)})}><option value="line">Straight line</option><option value="pointArc">Point on Arc</option><option value="smooth">Smooth curve</option><option value="bezier">Bezier</option></select></label>
                  <button className="delete" disabled={selected.nodes.length<=(selected.open?2:3)} onClick={()=>{update({nodes:selected.nodes.filter((_,i)=>i!==vectorNodeIndex)});setVectorNodeIndex(null);}}>Delete point</button>
                </>}
              </>}
              {selected.type === "polygon" && (
                <label className="field">
                  NUMBER OF SIDES <span>{selected.sides}</span>
                  <input
                    type="range"
                    min="3"
                    max="16"
                    step="1"
                    value={selected.sides}
                    onChange={(e) => update({ sides: +e.target.value })}
                  />
                </label>
              )}
              {selected.type === "trapezoid" && (
                <>
                  <div className="field-row">
                    <label className="field">
                      LEFT INSET ({documentMode === "stage" ? "M" : "CM"})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={+(selected.leftInset || 0).toFixed(3)}
                        onChange={(e) => update({ leftInset: +e.target.value })}
                      />
                    </label>
                    <label className="field">
                      RIGHT INSET ({documentMode === "stage" ? "M" : "CM"})
                      <CommittedNumberInput
                        type="number"
                        step="0.01"
                        value={+(selected.rightInset || 0).toFixed(3)}
                        onChange={(e) =>
                          update({ rightInset: +e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    SLEW ({documentMode === "stage" ? "M" : "CM"})
                    <CommittedNumberInput
                      type="number"
                      step="0.01"
                      value={+(selected.slew || 0).toFixed(3)}
                      onChange={(e) => update({ slew: +e.target.value })}
                    />
                  </label>
                  <p className="handle-help">
                    Drag either corner beyond the selection box to widen or
                    invert the top edge. Drag the raised centre handle for
                    unrestricted slew.
                  </p>
                </>
              )}
              {selected.type === "arc" && (
                <p className="handle-help">
                  Drag either endpoint to reposition it. Drag the centre control
                  handle toward or away from the line to change the arc depth.
                </p>
              )}
              <label className="field">
                ROTATION <span>{selected.rotation}°</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selected.rotation}
                  onChange={(e) => update({ rotation: +e.target.value })}
                />
              </label>
              {selected.type !== "compound" && selected.type !== "text" && <>
              <div className="field-row colors">
                <label className="field">
                  FILL
                  <ColourPicker
                    value={selected.fill}
                    onChange={(e) => update({ fill: e.target.value })}
                  />
                </label>
                <label className="field">
                  STROKE
                  <ColourPicker
                    value={selected.stroke}
                    onChange={(e) => update({ stroke: e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                STROKE WIDTH <span>{selected.strokeWidth}px</span>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step=".5"
                  value={selected.strokeWidth}
                  onChange={(e) => update({ strokeWidth: +e.target.value })}
                />
              </label>
              <label className="collision-toggle">
                <input
                  type="checkbox"
                  checked={selected.collision ?? false}
                  onChange={(e) => update({ collision: e.target.checked })}
                />
                <span>
                  <b>Physical collision shape</b>
                  <small>
                    Use this layer’s exact vector perimeter for placement.
                  </small>
                </span>
              </label>
              </>}
              <label className="collision-toggle">
                <input type="checkbox" checked={selected.toggleable ?? false} onChange={(e)=>update({toggleable:e.target.checked})} />
                <span><b>Toggleable in Stageplot</b><small>Adds a per-placement show/hide control for this item part.</small></span>
              </label>
              <div className="layer-actions">
                <button onClick={() => reorder(-1)}>Send back</button>
                <button onClick={() => reorder(1)}>Bring forward</button>
              </div>
              <button className="delete" onClick={remove}>
                Delete layer
              </button>
            </>
          )}
        </aside>
      </main>
      {libraryOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setLibraryOpen(false)
          }
        >
          <section
            className="library-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Load existing Stageplot item"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">STAGEPLOT LIBRARY</p>
                <h2>Load existing</h2>
              </div>
              <button onClick={() => setLibraryOpen(false)} aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
            </div>
            {libraryError && <p className="library-error">{libraryError}</p>}
            <div className="modal-library">
              {documentMode === "stage" ? (
                <section className="modal-group">
                  <h3>Stages</h3>
                  <div>
                    {stageLibrary.map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => editLibraryStage(stage)}
                      >
                        <span className="library-thumb">
                          <svg
                            viewBox={`0 0 ${stage.dimensions.widthMeters} ${stage.dimensions.depthMeters}`}
                          >
                            <path
                              d={stagePath(stage.boundary.nodes)}
                              fill="#f3f2eb"
                              stroke="#67752c"
                              strokeWidth=".04"
                            />
                          </svg>
                        </span>
                        <span>
                          <b>{stage.label}</b>
                          <small>
                            {stage.dimensions.widthMeters.toFixed(2)} ×{" "}
                            {stage.dimensions.depthMeters.toFixed(2)} m ·{" "}
                            {stage.boundary.nodes.length} nodes
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                [...groups, { id: null, label: "Uncategorised" }].map(
                  (group) => {
                    const groupItems = library.filter(
                      (item) => (item.groupId || null) === group.id,
                    );
                    return groupItems.length ? (
                      <section className="modal-group" key={group.id || "none"}>
                        <h3>{group.label}</h3>
                        <div>
                          {groupItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => editLibraryItem(item)}
                            >
                              <span className="library-thumb">
                                <svg
                                  viewBox={`0 0 ${item.dimensions.widthMeters} ${item.dimensions.depthMeters}`}
                                >
                                  {(item.shapes || []).map((shape) => (
                                    <Shape key={shape.id} item={shape} />
                                  ))}
                                </svg>
                              </span>
                              <span>
                                <b>{item.label}</b>
                                <small>
                                  {Math.round(item.dimensions.widthMeters * 100)} ×{" "}
                                  {Math.round(item.dimensions.depthMeters * 100)} cm ·{" "}
                                  {item.shapes?.length || 0} layers
                                </small>
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null;
                  },
                )
              )}
            </div>
          </section>
        </div>
      )}
      {saveChoice && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !shapeSaving)setSaveChoice(null);}}>
        <section className="library-modal preset-modal" role="dialog" aria-modal="true" aria-label="Choose how to save equipment">
          <div className="modal-header"><h2>{saveChoice.renamed ? "Save renamed item" : "Item already exists"}</h2><button disabled={shapeSaving} onClick={()=>setSaveChoice(null)} aria-label="Close">&times;</button></div>
          <div className="preset-modal-body">
            <p className="handle-help">{saveChoice.renamed ? <>You are editing “{saveChoice.target.label}” and changed its name to “{saveChoice.data.label}”. Update the original, or keep it and save a new item?</> : <>An equipment item named “{saveChoice.target.label}” already exists. Replace its artwork and settings, or save a separate item named “{saveChoice.data.label}”?</>}</p>
            <button className="group-button" autoFocus disabled={shapeSaving} onClick={()=>persistEquipment({...saveChoice.data,id:saveChoice.target.id,stageplotPublished:isPublishedItem(saveChoice.target)},saveChoice.snapshot)}>Update existing item</button>
            <button className="group-button" disabled={shapeSaving} onClick={()=>persistEquipment({...saveChoice.data,id:saveChoice.newId,stageplotPublished:false},saveChoice.snapshot)}>Save as new item</button>
            <button disabled={shapeSaving} onClick={()=>setSaveChoice(null)}>Cancel</button>
          </div>
        </section>
      </div>}
      {stageSaveAsOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !shapeSaving)setStageSaveAsOpen(false);}}>
        <section className="library-modal save-choice-modal" role="dialog" aria-modal="true" aria-label="Save stage as">
          <div className="modal-header"><h2>Save stage as</h2><button disabled={shapeSaving} onClick={()=>setStageSaveAsOpen(false)} aria-label="Close">&times;</button></div>
          <form className="preset-modal-body" onSubmit={event=>{event.preventDefault();saveStageAs();}}>
            <p className="handle-help">This creates a new stage with its own permanent link. The original stage will not be changed.</p>
            <label className="field">NEW STAGE NAME<input autoFocus value={stageSaveAsName} onChange={event=>setStageSaveAsName(event.target.value)} disabled={shapeSaving}/></label>
            <div className="modal-actions"><button type="submit" className="group-button" disabled={shapeSaving || !stageSaveAsName.trim()}>{shapeSaving ? "Saving..." : "Save new stage"}</button><button type="button" disabled={shapeSaving} onClick={()=>setStageSaveAsOpen(false)}>Cancel</button></div>
          </form>
        </section>
      </div>}
      {newItemOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setNewItemOpen(false);}}>
        <section className="library-modal preset-modal" role="dialog" aria-modal="true" aria-label="Create new item">
          <div className="modal-header"><h2>New item</h2><button onClick={()=>setNewItemOpen(false)} aria-label="Close">&times;</button></div>
          <div className="preset-modal-body"><p className="handle-help">What would you like to create?</p><button className="group-button" autoFocus onClick={()=>newItem("item")}>Equipment item</button><button className="group-button" onClick={()=>newItem("stage")}>Stage</button></div>
        </section>
      </div>}
      {manageStageplotOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !removingStageplotId)setManageStageplotOpen(false);}}>
        <section className="library-modal equipment-management-modal" role="dialog" aria-modal="true" aria-label="Library">
          <div className="modal-header"><h2>Library</h2><button disabled={Boolean(removingStageplotId)} onClick={()=>setManageStageplotOpen(false)} aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>
          <div className="preset-modal-body custom-shape-list"><p className="handle-help">Manage saved equipment and stages here. Custom shapes are building blocks and live in Custom shapes, not this library.</p>
            <label className="management-search">Search library<input type="search" placeholder="Search equipment, groups or stages" value={managedItemSearch} onChange={event=>setManagedItemSearch(event.target.value)}/></label>
            {matchingManagedItems.length ? managedEquipmentSections.map(group=><section className="managed-equipment-section" key={group.id || "uncategorised"}><h3>{group.label}</h3>{group.items.map(item=><div className="equipment-management-row" key={item.id}>
              <span className="managed-item-thumbnail"><svg role="img" aria-label={"Preview of " + item.label} viewBox={"0 0 " + item.dimensions.widthMeters + " " + item.dimensions.depthMeters}>{(item.shapes || []).map((shape,index)=><Shape key={shape.id || index} item={shape}/>)}</svg></span>
              <div className="managed-item-name">{editingItemNameId===item.id ? <form onSubmit={event=>{event.preventDefault();if(itemNameDraft.trim())updateManagedItem(item,{label:itemNameDraft.trim()});}}><input aria-label={"Item name for " + item.label} autoFocus value={itemNameDraft} onChange={event=>setItemNameDraft(event.target.value)} disabled={Boolean(removingStageplotId)}/><button disabled={Boolean(removingStageplotId) || !itemNameDraft.trim()}>Save</button><button type="button" disabled={Boolean(removingStageplotId)} onClick={()=>setEditingItemNameId(null)}>Cancel</button></form> : <><span>{item.label}</span><button className="pencil-button" disabled={Boolean(removingStageplotId)} aria-label={"Rename " + item.label} title="Rename item" onClick={()=>{setEditingItemNameId(item.id);setItemNameDraft(item.label);}}><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m4 16-1 5 5-1L20 8l-4-4Z M14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button></>}</div>
              <select aria-label={"Equipment group for " + item.label} value={item.groupId || ""} disabled={Boolean(removingStageplotId)} onChange={event=>updateManagedItem(item,{groupId:event.target.value || null})}><option value="">Uncategorised</option>{groups.map(group=><option key={group.id} value={group.id}>{group.label}</option>)}</select>
              <label className="publish-equipment-toggle"><input type="checkbox" checked={isPublishedItem(item)} disabled={Boolean(removingStageplotId)} onChange={event=>updateManagedItem(item,{stageplotPublished:event.target.checked})}/>Add to Stageplot Library</label>
              <button disabled={Boolean(removingStageplotId)} onClick={()=>editManagedItem(item)}>EDIT</button>
              <button className="remove-item-button" disabled={Boolean(removingStageplotId)} title={"Delete " + item.label} aria-label={"Delete " + item.label} onClick={()=>removeStageplotItem(item)}>&times;</button>
            </div>)}</section>) : <p className="empty">{equipmentItems.length ? "No equipment matches your search." : "No equipment saved yet."}</p>}
            <section className="managed-equipment-section managed-stages-section"><h3>Stages</h3>
              {matchingManagedStages.length ? matchingManagedStages.map(stage=><div className="managed-stage-row" key={stage.id}>
                <span className="managed-item-thumbnail"><svg role="img" aria-label={"Preview of " + stage.label} viewBox={`0 0 ${stage.dimensions.widthMeters} ${stage.dimensions.depthMeters}`}><path d={stagePath(stage.boundary.nodes)} fill="#e9f5bc" stroke="#71851f" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></span>
                <div className="managed-item-name">{editingStageNameId === stage.id ? <form onSubmit={event=>{event.preventDefault();if(stageNameDraft.trim())manageStage(stage,stageNameDraft);}}><input autoFocus aria-label={"Stage name for " + stage.label} value={stageNameDraft} onChange={event=>setStageNameDraft(event.target.value)} disabled={Boolean(removingStageplotId)}/><button disabled={Boolean(removingStageplotId) || !stageNameDraft.trim()}>Save</button><button type="button" disabled={Boolean(removingStageplotId)} onClick={()=>setEditingStageNameId(null)}>Cancel</button></form> : <><span>{stage.label}</span><button className="pencil-button" disabled={Boolean(removingStageplotId)} aria-label={"Rename " + stage.label} title="Rename stage" onClick={()=>{setEditingStageNameId(stage.id);setStageNameDraft(stage.label);}}><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m4 16-1 5 5-1L20 8l-4-4Z M14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button></>}<small>{stage.dimensions.widthMeters.toFixed(2)} × {stage.dimensions.depthMeters.toFixed(2)} m</small></div>
                <button disabled={Boolean(removingStageplotId)} onClick={()=>{
                  if(projectSnapshot!==savedProject.current && !window.confirm("This project has unsaved changes. Discard them and load " + stage.label + " for editing?"))return;
                  editLibraryStage(stage);setManageStageplotOpen(false);
                }}>EDIT</button>
                <button className="remove-item-button" disabled={Boolean(removingStageplotId)} title={"Delete " + stage.label} aria-label={"Delete " + stage.label} onClick={()=>manageStage(stage)}>&times;</button>
              </div>) : <p className="empty">{stageLibrary.length ? "No stages match your search." : "No stages saved yet."}</p>}
            </section>
          </div>
        </section>
      </div>}
      {manageGroupsOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !groupsSaving)setManageGroupsOpen(false);}}>
        <section className="library-modal equipment-management-modal" role="dialog" aria-modal="true" aria-label="Manage equipment groups">
          <div className="modal-header"><h2>Manage equipment groups</h2><button disabled={groupsSaving} onClick={()=>setManageGroupsOpen(false)} aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>
          <div className="preset-modal-body custom-shape-list"><p className="handle-help">Renaming a group updates its name for every item in that group. Counts show published Stageplot items and unpublished saved designs separately. Only groups with neither can be deleted.</p>
            <label className="management-search">Search equipment groups<input type="search" placeholder="Search groups" value={managedGroupSearch} onChange={event=>setManagedGroupSearch(event.target.value)}/></label>
            {matchingManagedGroups.length ? matchingManagedGroups.map(group=>{const members=equipmentItems.filter(item=>item.groupId===group.id);const count=members.length;const publishedCount=members.filter(isPublishedItem).length;const savedCount=count-publishedCount;return <div className="equipment-group-row" key={group.id}>
              {editingEquipmentGroupId===group.id ? <form onSubmit={event=>{event.preventDefault();if(equipmentGroupDraft.trim())saveManagedGroups(groups.map(candidate=>candidate.id===group.id?{...candidate,label:equipmentGroupDraft.trim()}:candidate));}}><input aria-label={"Group name for " + group.label} autoFocus value={equipmentGroupDraft} onChange={event=>setEquipmentGroupDraft(event.target.value)} disabled={groupsSaving}/><button disabled={groupsSaving || !equipmentGroupDraft.trim()}>Save</button><button type="button" disabled={groupsSaving} onClick={()=>setEditingEquipmentGroupId(null)}>Cancel</button></form> : <><span>{group.label}</span><button disabled={groupsSaving} onClick={()=>{setEditingEquipmentGroupId(group.id);setEquipmentGroupDraft(group.label);}}>Rename</button></>}
              <small>{publishedCount} published{savedCount>0 && <> ? {savedCount} saved design{savedCount===1?"":"s"}</>}</small><button className="remove-item-button" disabled={groupsSaving || count>0} title={count?"Move all items out of this group before deleting it":"Delete empty group"} onClick={()=>saveManagedGroups(groups.filter(candidate=>candidate.id!==group.id))}>Delete</button>
            </div>;}) : <p className="empty">{groups.length ? "No groups match your search." : "No equipment groups."}</p>}
          </div>
        </section>
      </div>}
      {manageCustomOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !removingPresetId)setManageCustomOpen(false);}}><section className="library-modal preset-modal" role="dialog" aria-modal="true" aria-label="Manage custom shapes"><div className="modal-header"><h2>Manage custom shapes</h2><button disabled={Boolean(removingPresetId)} onClick={()=>setManageCustomOpen(false)} aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div><div className="preset-modal-body custom-shape-list">{advancedPresets.length?advancedPresets.map(preset=><div className="custom-shape-row" key={preset.id}><span>{preset.label}</span><select aria-label={`Placement mode for ${preset.label}`} value={preset.editor.placementMode || "layers"} disabled={Boolean(removingPresetId)} onChange={event=>setPresetPlacementMode(preset,event.target.value)}><option value="layers">Separate editable layers</option><option value="single">Single non-editable layer</option></select><button disabled={Boolean(removingPresetId)} title={`Remove ${preset.label}`} aria-label={`Remove ${preset.label}`} onClick={()=>removeCustomPreset(preset)}>&times;</button></div>):<p className="empty">No custom shapes saved.</p>}</div></section></div>}
      {presetDialogOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !presetSaving)setPresetDialogOpen(false);}}>
        <section className="library-modal preset-modal" role="dialog" aria-modal="true" aria-label="Save as advanced shape">
          <div className="modal-header"><div><p className="eyebrow">REUSABLE ARTWORK</p><h2>Save as advanced shape</h2></div><button disabled={presetSaving} onClick={()=>setPresetDialogOpen(false)} aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>
          <div className="preset-modal-body">
            <label className="field">PRESET NAME<input autoFocus value={presetName} onChange={event=>setPresetName(event.target.value)} /></label>
            <p className="handle-help">Save the current artwork to Custom shapes. Choose separate editable layers or a single non-editable layer in Manage custom shapes. Both can be resized and rotated.</p>
            <button className="group-button" disabled={presetSaving || !presetName.trim()} onClick={saveAdvancedPreset}>{presetSaving ? "Saving..." : "Save custom shape"}</button>
            <button className="delete" disabled={presetSaving} onClick={()=>setPresetDialogOpen(false)}>Cancel</button>
          </div>
        </section>
      </div>}
      {sessionError && <div className="session-warning" role="alert">{sessionError}</div>}
      {toast && <div className="toast">{toast}</div>}
      {helpOpen&&<StudioHelp onClose={()=>setHelpOpen(false)}/>} 
    </div>
    </MeasurementUnit.Provider>
  );
}

export default App;
