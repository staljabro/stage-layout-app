import {appPrompt,appConfirm,currentDialog} from '../app-dialogs.js'
import {CurtainArtwork} from '../stage-curtain.jsx'
import {stageLineAssets,stageLineBounds,normaliseCurtain,resizeCurtain} from '../stage-curtain.js'
import {wholeDegrees} from '../rotation-angle.js'
import {equipmentFolders as normaliseEquipmentFolders,syncEquipmentFolders} from '../equipment-layer-model.js'
import {StageLayerList} from './stage-layer-list.jsx'
import {LayerLock} from './layer-lock.jsx'
import {LayerEye} from './layer-eye.jsx'
import {stageAssetVisible} from '../layer-visibility.js'
import {equipmentSession,normaliseLayerCollision} from './equipment-session.js'
import {EquipmentSaveDialog} from './equipment-save-dialog.jsx'
import {useEquipmentPlacement} from './use-equipment-placement.jsx'
import {fixedEquipmentSnapshot} from '../stage-equipment.js'
import {SaveStatus} from '../workspace-ui.jsx'
import {StockInspector} from './stock-inspector.jsx'
import {Shape} from './artwork.jsx'
import {polygonPoints,hexagonPoints,trapezoidPoints,pointsAttribute,tripodGeometry} from './artwork-geometry.js'
import {LibraryManagement} from './library-management.jsx'
import { FixedEquipmentArtwork } from '../equipment-artwork.jsx';
import {AccountModal} from '../account-modal.jsx'
import { SubmissionReview } from '../studio-workflow.jsx'
import { accountRequest } from '../account-api.js'
import { API_BASE, apiFetch } from '../account-api.js'
import { AccountButton, AppNavigation, useAccount } from '../accounts.jsx'
import { stageGroupIds, copyStageGroups } from "../zone-groups.js";
import { createContext, useContext, useEffect, useEffectEvent, useCallback, useMemo, useRef, useState } from "react";
import { segmentMode, segmentMidpoint, smoothControl, arcOffset, pointOnArc, bezierGeometry, stageSegmentPath, stagePath, sampleStageBoundary } from "../stage-geometry.js";
import { isPublishedItem, isEquipmentItem, assetProfiles } from "../../tools/library-membership.mjs";
import { objectPivot, normalizeRotation, rotateObjects, rotatedBounds, lockTripodPartPivots } from "./rotation.js";
import { sizeText } from "../text-layout.js";
import { convertToVector, vectorPath } from "./vector-conversion.js";
import { equipmentSaveChoice, newAssetId } from "./equipment-save.js";
import { toCentimetres, fromCentimetres } from "./measurements.js";
import { readSessionDraft, useSessionDraft } from "../session-draft.js";
import { selectionBox, enclosedItems, containsBounds } from "../marquee.js";
import { stageControlPoints, nearestControl } from "./stage-controls.js";
import { drawingEndpoint, finishDrawnVector } from "./vector-drawing.js";
import { subtractLayers, unionLayers, vectorFromCutRing } from "./shape-cut.js";
import { boundaryBounds, translateBoundaryNodes, resizeRectangularZone } from "./stage-zone.js";
import { advancedPresetId, instantiateAdvancedShape, removeCustomShapeMembership } from "./advanced-shapes.js";
import { EventHelp,StudioHelp,EquipmentHelp } from "../help-dialog.jsx";
import { APP_VERSION } from "../version.js";
import { AppMark } from "../app-mark.jsx";
import { normalizeZoneFolders, putZonesInFolder, removeZonesFromFolders } from "./stage-zone-folders.js";
import {normaliseComponents} from '../equipment-components.js'
import {normaliseCrop,validImageDataUrl,resizeCroppedImage} from '../image-layer.js'
import {prepareEquipmentImages} from '../prepare-equipment-images.js'
import {OrganisationBranding} from '../organisation-branding.jsx'
import {StageplotPrintHeading} from './stageplot-print.jsx'
import {useStageplotPrint} from './stageplot-print.js'

const LIBRARY_API = `${API_BASE}/items`;
const STAGES_API = `${API_BASE}/stages`;
const GROUPS_API = `${API_BASE}/groups`;
const MeasurementUnit = createContext("cm");

function ToolbarIcon({name}) {
  const path=name==="undo"?<><path d="M9 7 4 12l5 5"/><path d="M4 12h9a7 7 0 0 1 7 7"/></>:<><path d="m15 7 5 5-5 5"/><path d="M20 12h-9a7 7 0 0 0-7 7"/></>;
  return <svg className="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">{path}</svg>;
}

function MultiCollisionControl({ layers, onChange }) {
  const enabled=layers.filter(layer=>layer.collision===true).length;
  const value=enabled===layers.length?true:enabled===0?false:"mixed";
  return <button type="button" className="studio-tri-state" role="checkbox" aria-checked={value==="mixed"?"mixed":value} onClick={()=>onChange(value!==true)}><span className={`studio-tri-box ${value==="mixed"?"mixed":value?"checked":""}`}>{value==="mixed"?"×":value?"✓":""}</span><span><b>Physical collision shape</b><small>{value==="mixed"?"Mixed values — click to enable collision for every selected layer.":value?"All selected layers contribute to collision.":"Selected layers do not contribute to collision."}</small></span></button>;
}

function ComponentsEditor({value,onChange}) {
  const components=Array.isArray(value)?value:[]
  const move=(index,offset)=>{const next=[...components],target=index+offset;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];onChange(next)}
  return <section className="equipment-components-editor">
    <h4>Components</h4><p className="component-description">Requirements included with this item. Each placement can turn them off or add notes.</p>
    <div className="component-definitions">{components.map((component,index)=><div className="component-definition" key={component.id}>
      <span className="component-number">{index+1}</span><input aria-label={`Component ${index+1}`} maxLength="200" value={component.label} onChange={event=>onChange(components.map(entry=>entry.id===component.id?{...entry,label:event.target.value}:entry))}/>
      <div className="component-actions"><button type="button" aria-label={`Move ${component.label} up`} disabled={!index} onClick={()=>move(index,-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 6-6 6 6M12 6v12"/></svg></button><button type="button" aria-label={`Move ${component.label} down`} disabled={index===components.length-1} onClick={()=>move(index,1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 6 6 6-6M12 6v12"/></svg></button><button type="button" className="component-remove" aria-label={`Delete ${component.label}`} onClick={()=>onChange(components.filter(entry=>entry.id!==component.id))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>
    </div>)}</div><button className="component-add" disabled={components.length>=100} onClick={()=>onChange([...components,{id:`component-${Date.now()}`,label:'New component'}])}>+ Add component</button>
  </section>
}

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
  { type: "circle", label: "Circle", glyph: "○" },
  { type: "ellipse", label: "Ellipse", glyph: "⬭" },
  { type: "triangle", label: "Triangle", glyph: "△" },
  { type: "line", label: "Line", glyph: "╱" },
  { type: "text", label: "Text", glyph: "T" },
  { type: "tripod", label: "Tripod base", glyph: "Y" },
];

const ADVANCED_PALETTE = [
  { type: "arc", label: "Arc", glyph: "\u2312" },
  { type: "collisionVector", label: "Collision shape", glyph: "◇" },
  { type: "trapezoid", label: "Trapezoid", glyph: "▱" },
  { type: "polygon", label: "Polygon", glyph: "⬠" },
];

const DEFAULTS = {
  text: { width: .4, height: .2, text: "Text", fontSize: .2, bold: false, italic: false, textAlign: "left", lineSpacing: 1.2 },
  vector: { width: .6, height: .4 },
  collisionVector: { width: .6, height: .4 },
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
      <circle className={index===i?"boundary-node selected":"boundary-node"} cx={node.x} cy={node.y} r=".012" onPointerDown={event=>{onSelect(i);onDrag(event,`vector:${i}:node`);}} />
      {index===i && handles.map(([kind,point])=><circle key={kind} className={kind==="midpoint"||kind==="pointArc"||kind==="smooth"?"curve-control":"bezier-control"} cx={point.x} cy={point.y} r=".012" onPointerDown={event=>onDrag(event,`vector:${i}:${kind}`)} />)}
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

function DesignEditor({embeddedStage=null,embeddedEquipment=null,equipmentOnly=false}) {
  const {user}=useAccount();
  const equipmentEmbedded=Boolean(embeddedEquipment);
  const fetch=useCallback((url,options={})=>{
    if(equipmentEmbedded&&url.startsWith(LIBRARY_API)){
      const target=url.replace(LIBRARY_API,API_BASE+'/workspace/equipment');
      if(options.method==='PUT'){const data=JSON.parse(options.body);return apiFetch(target,{...options,body:JSON.stringify({data,revision:data.revision})})}
      return apiFetch(target,options)
    }
    return apiFetch(url,options)
  },[equipmentEmbedded]);
  const [equipmentSaveOpen,setEquipmentSaveOpen]=useState(false);
  const readOnlyStage=embeddedStage?.canEditStage===false;
  const [layoutEquipment,setLayoutEquipment]=useState(embeddedStage?.layoutEquipment||[]);
  const [layoutNotes,setLayoutNotes]=useState(embeddedStage?.notes||'');
  const [availableEquipment,setAvailableEquipment]=useState(embeddedStage?.data.availableEquipment||[]);
  const [stageBoundaryVisible,setStageBoundaryVisible]=useState(embeddedStage?.data.boundary.visible!==false);
  const [stockMode,setStockMode]=useState(embeddedStage?.stockMode===true),[saveError,setSaveError]=useState('');
  const saveLock=useRef(false);
  const isManager=["owner","admin"].includes(user?.role);
  const [managedTab,setManagedTab]=useState(()=>isManager&&new URLSearchParams(window.location.search).get('section')==='reviews'?'reviews':'items');
  const [submissions,setSubmissions]=useState([]);
  const [reviewIds,setReviewIds]=useState(null);
  const [personalSource,setPersonalSource]=useState(null);
  const [editingSubmission,setEditingSubmission]=useState(null);
  const [submissionSaveOpen,setSubmissionSaveOpen]=useState(false);
  const [reviewerMessage,setReviewerMessage]=useState('');
  const [submissionFeedback,setSubmissionFeedback]=useState(null);
  const pendingUpdates=(kind,id)=>submissions.filter(s=>s.status==='pending'&&s.kind===kind&&s.target_id===id);
  const draftStatus=(kind,asset)=>{
    const proposal=submissions.find(s=>s.kind===kind&&s.asset_id===asset.id);
    return {label:({pending:'Pending review',rejected:'Declined',approved:'Published'}[proposal?.status] || 'Draft'),note:proposal?.review_note || ''};
  };
  const showManagedAsset=asset=>!isManager || !asset.ownerId || !submissions.some(s=>s.status==='pending'&&s.asset_id===asset.id);

  const editable=asset=>embeddedEquipment?asset.canEdit===true:asset.ownerId ? asset.ownerId===user?.id : isManager;
  const submitAsset=async(kind,asset)=>{try{await accountRequest("/submissions","POST",{kind,assetId:asset.id});await refreshLibrary();flash("Proposal submitted or updated. Your personal draft is still usable.")}catch(error){flash(error.message)}};
  const sessionKey=embeddedEquipment?'equipment-canvas:'+embeddedEquipment.data.id:embeddedStage?'canvas:'+(embeddedStage.sessionId||embeddedStage.data.id):'shape-studio:'+user?.id+':draft';
  const [recovery,setRecovery]=useState(()=>embeddedStage||embeddedEquipment?readSessionDraft(sessionKey):null);
  const [session] = useState(() => embeddedEquipment?equipmentSession(embeddedEquipment.data):embeddedStage ? {documentMode:'stage',shapeName:embeddedStage.data.label,realWidth:embeddedStage.data.dimensions.widthMeters,realDepth:embeddedStage.data.dimensions.depthMeters,stageNodes:embeddedStage.data.boundary.nodes,zones:embeddedStage.data.zones||[],fixedEquipment:syncEquipmentFolders(embeddedStage.data.fixedEquipment||[],normaliseEquipmentFolders(embeddedStage.data.fixedEquipment||[],embeddedStage.data.equipmentFolders||[])),textItems:embeddedStage.data.textItems||[],referenceImages:embeddedStage.data.editor?.referenceImages||[],stageLines:stageLineAssets(embeddedStage.data),zoneFolders:normalizeZoneFolders(embeddedStage.data.editor?.assetFolders||embeddedStage.data.layerFolders,[...(embeddedStage.data.zones||[]),...(embeddedStage.data.textItems||[]),...(embeddedStage.data.editor?.referenceImages||[]),...stageLineAssets(embeddedStage.data)]),stageBoundaryLocked:readOnlyStage||embeddedStage.data.editor?.stageBoundaryLocked||false,items:[]} : (()=>{const stored=readSessionDraft(sessionKey);return equipmentOnly&&stored.documentMode==='stage'?{}:stored;})());
  const [equipmentFolders,setEquipmentFolders]=useState(()=>session.equipmentFolders||embeddedStage?.layerFolders||embeddedStage?.data.equipmentFolders||[]);
  const [documentMode, setDocumentMode] = useState(session.documentMode ?? "item");
  const [shapeName, setShapeName] = useState(session.shapeName ?? "Untitled Item");
  const [realWidth, setRealWidth] = useDimensionState(session.realWidth ?? 1);
  const [realDepth, setRealDepth] = useDimensionState(session.realDepth ?? 1);
  const [groupId, setGroupId] = useState(session.groupId ?? "");
  const [items, setItems] = useDimensionState((session.items ?? []).map(layer=>{const normalized=normaliseLayerCollision(layer);return normalized.type==="text"?sizeText(normalized):normalized;}));
  const [itemFolders,setItemFolders]=useState(()=>normalizeZoneFolders(session.itemFolders,session.items??[]));
  const [rotationParts, setRotationParts] = useState(session.rotationParts ?? []);
  const [components,setComponents]=useState(()=>normaliseComponents(session.components));
  const [cornerSnapping, setCornerSnapping] = useState(session.cornerSnapping ?? false);
  const [selectedId, setSelectedId] = useState(null);
  const [vectorNodeIndex, setVectorNodeIndex] = useState(null);
  const [vectorDrawing, setVectorDrawing] = useState(session.vectorDrawing ?? null);
  const [vectorPreview, setVectorPreview] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [history, setHistory] = useState([]);
  const [future,setFuture]=useState([]);
  const [rotationReadout,setRotationReadout]=useState(null);
  const [snapMode, setSnapMode] = useState(session.snapMode ?? "standard");
  const [grid, setGrid] = useState(session.grid ?? true);
  const [toast, setToast] = useState("");
  const [helpOpen,setHelpOpen]=useState(false);
  const [library, setLibrary] = useState(()=>embeddedEquipment?[...embeddedEquipment.library.filter(item=>item.id!==embeddedEquipment.data.id),embeddedEquipment.data]:[]);
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
  const [manageStageplotOpen, setManageStageplotOpen] = useState(()=>!embeddedStage&&!embeddedEquipment&&new URLSearchParams(window.location.search).get('section')!=='studio');
  useEffect(()=>{if(embeddedStage||embeddedEquipment)return;const url=new URL(window.location.href);url.searchParams.set('section',manageStageplotOpen?(managedTab==='reviews'?'reviews':'library'):'studio');window.history.replaceState(null,'',url.href)},[embeddedStage,embeddedEquipment,manageStageplotOpen,managedTab]);
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
  const [referenceImages, setReferenceImages] = useDimensionState(session.documentMode==='stage'?session.referenceImages??[]:[]);
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const [fixedEquipment,setFixedEquipment]=useState(session.fixedEquipment ?? []);
  const [zones, setZones] = useState(session.zones ?? []);
  const [zoneFolders, setZoneFolders] = useState(() => normalizeZoneFolders(session.zoneFolders, [...(session.referenceImages??[]),...(session.zones??[]),...(session.textItems??[]),...(session.stageLines??[])]));
  const [textItems, setTextItems] = useState(session.textItems ?? []);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [stageLines,setStageLines]=useState(session.stageLines??[]);
  const [selectedStageLineId,setSelectedStageLineId]=useState(null);
  const [canvasResizeEnabled, setCanvasResizeEnabled] = useState(session.canvasResizeEnabled ?? false);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedStageAssetIds, setSelectedStageAssetIds] = useState([]);
  const [stageMoveMode, setStageMoveMode] = useState(false);
  const [stageNodesExpanded, setStageNodesExpanded] = useState(false);
  const [stageBoundaryLocked, setStageBoundaryLocked] = useState(session.stageBoundaryLocked ?? false);
  const [groups, setGroups] = useState(embeddedEquipment?.groups||[]);
  const [activeLibraryId, setActiveLibraryId] = useState(session.activeLibraryId ?? null);
  const [draftAssetId, setDraftAssetId] = useState(() => session.draftAssetId ?? newAssetId(session.documentMode === "stage" ? "stage" : "item"));
  const [libraryError, setLibraryError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [zoom, setZoom] = useState(session.zoom ?? 1);
  const [pan, setPan] = useState(session.pan ?? { x: 0, y: 0 });
  const [canvasResizeView, setCanvasResizeView] = useState(session.canvasResizeView ?? null);
  const [studioUi,setStudioUi]=useState(session.studioUi??{item:{leftOpen:true,rightOpen:true,leftWidth:238,rightWidth:250,search:'',filter:'all',sections:{}},stage:{leftOpen:true,rightOpen:true,leftWidth:238,rightWidth:250,search:'',filter:'all',sections:{}}});
  const [panelResize,setPanelResize]=useState(null);
  const [createMenu,setCreateMenu]=useState(null);
  useEffect(()=>{
    if(!createMenu)return;
    const close=event=>{if(!event.target.closest?.(".creation-menu-wrap"))setCreateMenu(null);};
    window.addEventListener("pointerdown",close);
    return()=>window.removeEventListener("pointerdown",close);
  },[createMenu]);
  const nextId = useRef(Math.max(session.nextId || 20, ...(session.items || []).map(item=>(Number(item.id)||0)+1)));
  const nextGroupId = useRef(session.nextGroupId || 1);
  const canvasRef = useRef(null);
  useStageplotPrint(canvasRef,Boolean(embeddedStage));
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const handleRef = useRef(null);
  const rotationDragRef = useRef(null);
  const panRef = useRef(null);
  const marqueeRef = useRef(null);
  const [marquee, setMarquee] = useState(null);
  const stageDragRef = useRef(null);
  const imageFileRef = useRef(null);
  const artworkImageFileRef=useRef(null);
  const assetDragRef = useRef(null);
  const clipboardRef = useRef(null);
  const clipboardId = useRef(1);
  const projectSnapshot = JSON.stringify(documentMode === "item"
    ? {documentMode,shapeName,realWidth,realDepth,groupId,items,itemFolders,rotationParts,components,cornerSnapping,referenceImages,advancedShapeRole}
    : {documentMode,shapeName,realWidth,realDepth,stageNodes,stageBoundaryLocked,stageBoundaryVisible,fixedEquipment,layoutEquipment,equipmentFolders,layoutNotes,availableEquipment,zones,zoneFolders,textItems,stageLines,referenceImages});
  useEffect(() => {
    if (savedProject.current === null || resetProjectBaseline.current) {
      savedProject.current = projectSnapshot;
      resetProjectBaseline.current = false;
    }
  });
  const onNavigationStateChange=embeddedStage?.onNavigationStateChange;
  useEffect(()=>{onNavigationStateChange?.({dirty:projectSnapshot!==savedProject.current,busy:shapeSaving})},[onNavigationStateChange,projectSnapshot,shapeSaving]);
  const sessionError = useSessionDraft(sessionKey, {
    documentMode, shapeName, realWidth, realDepth, groupId, items, itemFolders, rotationParts, components, cornerSnapping, referenceImages,layoutEquipment,equipmentFolders,layoutNotes,availableEquipment,projectSnapshot,
    advancedShapeRole, stageNodes, fixedEquipment, zones, zoneFolders, textItems, stageLines, stageBoundaryLocked, stageBoundaryVisible, activeLibraryId, draftAssetId, snapMode, grid,studioUi,
    zoom, pan, canvasResizeEnabled, canvasResizeView, vectorDrawing,
    savedProject: savedProject.current ?? projectSnapshot, nextId: nextId.current, nextGroupId: nextGroupId.current,
  });
  const currentUi=studioUi[documentMode]||{};
  const updateCurrentUi=useCallback(changes=>setStudioUi(old=>({...old,[documentMode]:{...old[documentMode],...changes}})),[documentMode]);
  useEffect(()=>{
    if(!panelResize)return;
    const move=event=>{const delta=event.clientX-panelResize.startX;updateCurrentUi(panelResize.side==="left"?{leftWidth:Math.max(190,Math.min(430,panelResize.startWidth+delta))}:{rightWidth:Math.max(220,Math.min(470,panelResize.startWidth-delta))});};
    const finish=()=>setPanelResize(null);
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",finish);
    return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);};
  },[panelResize,updateCurrentUi]);
  const reviewSubmissions=submissions.filter(submission=>(!equipmentOnly||submission.kind==='items')&&submission.status==='pending').map(submission=>({...submission,isUpdate:(submission.kind==='items'?library:stageLibrary).some(asset=>!asset.ownerId&&asset.id===submission.target_id)}));
  const equipmentItems = library.filter(isEquipmentItem);
  const matchingManagedStages = stageLibrary.filter(showManagedAsset).filter(stage => stage.label.toLowerCase().includes(managedItemSearch.trim().toLowerCase())).sort((a,b)=>a.label.localeCompare(b.label));
  const matchingManagedItems = equipmentItems.filter(showManagedAsset).filter(item => {
    const groupName = groups.find(group=>group.id===item.groupId)?.label || "Uncategorised";
    return (item.label + " " + groupName).toLowerCase().includes(managedItemSearch.trim().toLowerCase());
  }).sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:"base"}));
  const managedEquipmentSections = [...groups, {id:null,label:"Uncategorised"}].map(group => ({...group,items:matchingManagedItems.filter(item => (groups.some(candidate=>candidate.id===item.groupId) ? item.groupId : null) === group.id)})).filter(group=>group.items.length);
  const matchingManagedGroups = groups.filter(group=>group.label.toLowerCase().includes(managedGroupSearch.trim().toLowerCase()));
  const advancedPresets = library.filter(item => item.editor?.advancedShapeRole && item.editor?.layers?.length);
  const selected = items.find((item) => item.id === selectedId);
  const drawnVector = items.find(item=>item.id===vectorDrawing?.id);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const selectedText = textItems.find((item) => item.id === selectedTextId);
  const selectedStageLine=stageLines.find(item=>item.id===selectedStageLineId);
  const referenceImage = referenceImages.find(
    (image) => image.id === selectedReferenceId,
  );
  const referenceSelected = Boolean(referenceImage);
  const orderedAssets = [
    ...referenceImages.map((asset) => ({ ...asset, assetType: "image" })),
    ...zones.map((asset) => ({ ...asset, assetType: "zone" })),
    ...textItems.map((asset) => ({ ...asset, assetType: "text" })),
    ...stageLines.map((asset)=>({...asset,assetType:"line"})),
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
  const selectedZoneBounds=selectedZone?boundaryBounds(selectedZone.nodes):null;
  const selectedZoneAnchor=selectedZoneBounds?selectedZone.anchorMode==="centre"?{x:selectedZoneBounds.centreX,y:selectedZoneBounds.centreY}:{x:selectedZoneBounds.x,y:selectedZoneBounds.y}:null;
  const directlySelectedStageIds=[...new Set([...selectedStageAssetIds,...(selectedZoneId?[selectedZoneId]:[]),...(selectedTextId?[selectedTextId]:[]),...(selectedStageLineId?[selectedStageLineId]:[]),...(selectedReferenceId?[selectedReferenceId]:[])])];
  const selectedStageAssets=orderedAssets.filter(asset=>directlySelectedStageIds.includes(asset.id));
  const stageGroupId=selectedStageAssets[0]?.editorGroupId;
  const selectedStageGroup=stageGroupId && selectedStageAssets.every(asset=>asset.editorGroupId===stageGroupId) ? orderedAssets.filter(asset=>asset.editorGroupId===stageGroupId) : [];
  const updateStageGroup=changes=>{checkpoint();const update=old=>old.map(asset=>asset.editorGroupId===stageGroupId?{...asset,...changes}:asset);setZones(update);setTextItems(update);setStageLines(update);setReferenceImages(update);};
  const groupStageAssets=()=>{checkpoint();const ids=new Set(selectedStageAssets.flatMap(asset=>stageGroupIds(orderedAssets,asset.id))),id='stage-group-'+Date.now()+'-'+nextGroupId.current++;const update=old=>old.map(asset=>ids.has(asset.id)?{...asset,editorGroupId:id,editorGroupName:'Stage group',editorGroupToggleable:false}:asset);setZones(update);setTextItems(update);setStageLines(update);setReferenceImages(update);setSelectedStageAssetIds([...ids]);setSelectedZoneId(null);setSelectedTextId(null);setSelectedStageLineId(null);setSelectedReferenceId(null);};
  const hasStageInspectorSelection=Boolean(selectedZone||selectedText||selectedStageLine||referenceSelected||stageNode||selectedStageAssetIds.length);
  const activeStageControls = documentMode === "stage" && !stageMoveMode && !selectedZone?.locked && selectedZone?.zoneShape!=="rectangle" && (selectedZone || !stageBoundaryLocked) ? stageControlPoints(selectedZone?.nodes || stageNodes, selectedStageNode) : [];
  const selectedGroupItems = selectedGroupId
    ? items.filter((item) => item.editorGroupId === selectedGroupId)
    : [];
  const groupBounds = rotatedBounds(selectedGroupItems);
  const effectiveRotationParts = lockTripodPartPivots(rotationParts,items);

  
  const vectorShapes = useMemo(
    () =>
      items.filter(item=>!item.collisionOnly&&stageAssetVisible({...item,visible:item.editorVisible},itemFolders)).map(function toVectorShape({ id, name, collision, collisionOnly, editorVisible, editorLocked, ...shape }) { return ({
        ...shape,
        ...(shape.type === "vector" ? {type:"path",d:vectorPath(shape)} : {}),
        ...(shape.type === "compound" ? {children:shape.children.filter(child=>!child.collisionOnly).map(toVectorShape)} : {}),
        id: String(id),
        name,
        ...(shape.editorGroupId && shape.editorGroupToggleable ? {toggleable:true,toggleName:shape.editorGroupName || "Group"} : {}),
      }); }),
    [items,itemFolders],
  );
  const collisionShapes = useMemo(
    () => items.filter(item=>stageAssetVisible({...item,visible:item.editorVisible},itemFolders)).flatMap(collisionLayers),
    [items,itemFolders],
  );
  const itemData = useMemo(
    () => ({
      schema: "stageplot-item@3",
      revision: library.find(item=>item.id===activeLibraryId)?.revision,
      profiles: assetProfiles(library.find(item=>item.id===activeLibraryId) || {}),
      id: activeLibraryId || draftAssetId,
      label: shapeName.trim() || "Untitled Item",
      groupId: advancedShapeRole ? null : groupId || null,
      stockQuantity: library.find(item=>item.id===activeLibraryId)?.stockQuantity ?? null,
      dimensions: { widthMeters: realWidth, depthMeters: realDepth },
      shapes: vectorShapes,
      collisionShapes,
      snapPoints: cornerSnapping ? [{x:0,y:0},{x:realWidth,y:0},{x:realWidth,y:realDepth},{x:0,y:realDepth}] : [],
      rotationParts: effectiveRotationParts,
      components:normaliseComponents(components),
      editor: { layers: items, layerFolders:itemFolders.map(folder=>({...folder,assetIds:folder.zoneIds,zoneIds:undefined})), referenceImages:[], ...(advancedShapeRole ? {advancedShapeRole} : {}), ...(library.find(item=>item.id===activeLibraryId)?.editor?.placementMode ? {placementMode:library.find(item=>item.id===activeLibraryId).editor.placementMode} : {}) },
    }),
    [
      activeLibraryId, draftAssetId,
      library,
      shapeName,
      groupId,
      realWidth,
      realDepth,
      vectorShapes,
      collisionShapes,
      cornerSnapping,
      effectiveRotationParts,
      components,
      items,
      itemFolders,
      advancedShapeRole,
    ],
  );
  
  const plannerUrl = "https://stageplot.braithwaite.work/";
  const copyManagedStageLink = async (stage,profile) => {
    try {
      const url=new URL(plannerUrl);
      if(!["http:","https:"].includes(url.protocol))throw new Error("Invalid public planner URL");
      url.search="";url.hash="";url.searchParams.set("stage",stage.visibility==="link-only"?stage.shareToken:stage.id);
      if(profile==="empire")url.searchParams.set("profile","empire");
      try{await navigator.clipboard.writeText(url.href);flash("Stage-locked link copied")}catch{(await appPrompt("Copy this stage-locked link:",url.href))}
    }catch{flash("Unable to create the stage link")}
  };
  const stageData = useMemo(
    () => ({
      schema: "stageplot-stage@1",
      revision: stageLibrary.find(stage=>stage.id===activeLibraryId)?.revision,
      shareEquipmentIds: stageLibrary.find(stage=>stage.id===activeLibraryId)?.shareEquipmentIds || [],
      id: activeLibraryId || draftAssetId,
      label: shapeName.trim() || "Untitled Stage",
      profiles: assetProfiles(stageLibrary.find(stage=>stage.id===activeLibraryId) || {profiles:[]}),
      visibility: stageLibrary.find(stage=>stage.id===activeLibraryId)?.visibility || (activeLibraryId ? "listed" : "draft"),
      dimensions: { widthMeters: realWidth, depthMeters: realDepth },
      boundary: { closed: true, nodes: stageNodes, visible:stageBoundaryVisible },
      layerFolders:zoneFolders.map(folder=>({...folder,assetIds:folder.zoneIds})),
      collisionBoundary: sampleStageBoundary(stageNodes),
      zones: zones.map((zone) => ({
        ...zone,
        collisionBoundary: zone.solid
          ? sampleStageBoundary(zone.nodes)
          : undefined,
      })),
      textItems,
      fixedEquipment:fixedEquipment.map(item=>fixedEquipmentSnapshot(item,String(item.id))),
      availableEquipment,
      equipmentFolders:normaliseEquipmentFolders(fixedEquipment,equipmentFolders).map(folder=>({...folder,itemIds:folder.itemIds.map(String)})),
      details: [],
      curtains:stageLines.filter(line=>line.type==="curtain"),
      editor: { referenceImages, dimensionLines:stageLines.filter(line=>line.type!=="curtain"), stageBoundaryLocked, assetFolders:zoneFolders.map(folder=>({...folder,assetIds:folder.zoneIds,zoneIds:undefined})) },
    }),
    [
      activeLibraryId, draftAssetId,
      shapeName,
      realWidth,
      realDepth,
      stageNodes,
      stageLibrary,
      fixedEquipment,equipmentFolders,availableEquipment,
      stageBoundaryLocked,stageBoundaryVisible,
      zones,
      textItems,
      stageLines,
      referenceImages,
      zoneFolders,
    ],
  );

  const embedded=Boolean(embeddedStage||embeddedEquipment);
  const refreshLibrary = useCallback(async () => {
    if(embedded)return;
    try {
      const [itemsResponse, groupsResponse, stagesResponse] = await Promise.all(
        [fetch(`${LIBRARY_API}?scope=all`), fetch(GROUPS_API), fetch(`${STAGES_API}?scope=all`)],
      );
      if (!itemsResponse.ok || !groupsResponse.ok || !stagesResponse.ok)
        throw new Error("Library server unavailable");
      setLibrary(await itemsResponse.json());
      setGroups(await groupsResponse.json());
      setStageLibrary(await stagesResponse.json());
      setSubmissions(await accountRequest("/submissions"));
      setLibraryError("");
    } catch {
      setLibraryError("Start the library server with npm run dev:all");
    }
  },[embedded,fetch]);
  useEffect(() => {
    refreshLibrary();
    window.addEventListener("focus",refreshLibrary);
    return ()=>window.removeEventListener("focus",refreshLibrary);
  }, [refreshLibrary]);

  const editorSnapshot=()=>({
        items: structuredClone(items),
        itemFolders: structuredClone(itemFolders),
        rotationParts: structuredClone(rotationParts),
        components:structuredClone(components),
        cornerSnapping,
        referenceImages: structuredClone(referenceImages),
        stageNodes: structuredClone(stageNodes),
        stageBoundaryLocked,stageBoundaryVisible,
        fixedEquipment: structuredClone(fixedEquipment),layoutEquipment:structuredClone(layoutEquipment),equipmentFolders:structuredClone(equipmentFolders),availableEquipment:structuredClone(availableEquipment),layoutNotes,
        zones: structuredClone(zones),
        zoneFolders: structuredClone(zoneFolders),
        textItems: structuredClone(textItems),
        stageLines: structuredClone(stageLines),
        realWidth,
        realDepth,
        shapeName,
        groupId,
      });
  const checkpoint = () => {setHistory(old=>[...old.slice(-9),editorSnapshot()]);setFuture([]);};
  const restoreSnapshot=previous=>{
    if(!previous)return;
    setItems(previous.items);setItemFolders(previous.itemFolders||[]);
    setRotationParts(previous.rotationParts || []);
    setComponents(normaliseComponents(previous.components));
    setCornerSnapping(previous.cornerSnapping ?? false);
    setReferenceImages(documentMode==='stage'?previous.referenceImages||[]:[]);
    if(previous.stageBoundaryVisible!==undefined)setStageBoundaryVisible(previous.stageBoundaryVisible);
    if (previous.stageNodes) setStageNodes(previous.stageNodes);
    if (previous.stageBoundaryLocked !== undefined) setStageBoundaryLocked(previous.stageBoundaryLocked);
    if (previous.fixedEquipment) setFixedEquipment(previous.fixedEquipment);
    if(previous.equipmentFolders)setEquipmentFolders(previous.equipmentFolders);
    if(previous.layoutEquipment)setLayoutEquipment(previous.layoutEquipment);
    if(previous.availableEquipment)setAvailableEquipment(previous.availableEquipment);
    if(previous.layoutNotes!==undefined)setLayoutNotes(previous.layoutNotes);
    if (previous.zones) setZones(previous.zones);
    if (previous.zoneFolders) setZoneFolders(previous.zoneFolders);
    if (previous.textItems) setTextItems(previous.textItems);
    if (previous.stageLines) setStageLines(previous.stageLines);
    setRealWidth(previous.realWidth);setRealDepth(previous.realDepth);setShapeName(previous.shapeName);setGroupId(previous.groupId);
    setSelectedReferenceId(null);setSelectedStageLineId(null);setSelectedId(null);setMultiSelectedIds([]);setSelectedGroupId(null);setSelectedStageAssetIds([]);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture(old=>[...old.slice(-9),editorSnapshot()]);restoreSnapshot(previous);
    setHistory((old) => old.slice(0, -1));
  };
  const redo=()=>{const next=future.at(-1);if(!next)return;setHistory(old=>[...old.slice(-9),editorSnapshot()]);restoreSnapshot(next);setFuture(old=>old.slice(0,-1));};
  const update = (changes) => {
    if(changes.rotation!==undefined)changes={...changes,rotation:wholeDegrees(changes.rotation)};
    checkpoint();
    setItems((old) =>
      old.map((item) =>
        item.id === selectedId ? resizeShape(item,item.collisionOnly?{...changes,collision:true}:changes) : item,
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
      const id = advancedShapeRole && activeLibraryId ? activeLibraryId : embeddedEquipment?newAssetId("shape"):advancedPresetId("custom", libraryId(presetName));
      const existing = library.find(item => item.id === id);
      const data = await prepareEquipmentImages({...itemData,id,groupId:null,profiles:existing ? assetProfiles(existing) : [],label:presetName.trim(),editor:{...itemData.editor,advancedShapeRole:"custom",placementMode:existing?.editor?.placementMode || "layers"}});
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
    const collisionOnly=type === "collisionVector";
    const item = {
      id: nextId.current++,
      type: collisionOnly ? "vector" : type,
      name: definition.label,
      x: realWidth / 2 - size.width / 2,
      y: realDepth / 2 - size.height / 2,
      ...size,
      ...(["vector","collisionVector"].includes(type) ? {nodes:defaultStageNodes(size.width,size.height)} : {}),
      ...(collisionOnly ? {collisionOnly:true} : {}),
      fill: collisionOnly ? "#d7d9d6" : "#e9f5bc",
      stroke: collisionOnly ? "#777b77" : "#25261f",
      strokeWidth: 2,
      rotation: 0,
      toggleable: false,
      collision: collisionOnly,
    };
    setItems((old) => [...old, type === "text" ? sizeText({...normaliseLayerCollision(item), fill:"#25261f", stroke:"none", strokeWidth:0}) : normaliseLayerCollision(item)]);
    setSelectedId(item.id);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
  };
  const placement=useEquipmentPlacement({enabled:Boolean(embeddedStage),value:readOnlyStage?layoutEquipment:fixedEquipment,onChange:readOnlyStage?setLayoutEquipment:setFixedEquipment,library:embeddedStage?.equipment||[],groups:embeddedStage?.groups||[],folders:equipmentFolders,onFoldersChange:setEquipmentFolders,canvasRef,stage:{...stageData,availableEquipment},checkpoint,onSelect:()=>{setStockMode(false);setSelectedStageNode(null);setSelectedZoneId(null);setSelectedTextId(null);setSelectedStageLineId(null);setSelectedReferenceId(null);setSelectedStageAssetIds([])},visitor:readOnlyStage,onCreateEquipment:embeddedStage?.onCreateEquipment,notes:layoutNotes,onNotesChange:setLayoutNotes,reviewNote:embeddedStage?.reviewNote,status:embeddedStage?.statusLabel,project:embeddedStage?.layoutName||shapeName,snapMode,organisationId:embeddedStage?.organisationId,organisation:embeddedStage?.organisation});
  const pointerDown = (event, item) => {
    if (event.button !== 0) return;
    if (item.editorLocked || item.editorVisible === false) return;
    if (item.type === "text") event.preventDefault();
    setSelectedReferenceId(null);
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if(event.altKey){
      event.preventDefault();checkpoint();
      const sourceIds=multiSelectedIds.includes(item.id)?multiSelectedIds:item.editorGroupId?items.filter(candidate=>candidate.editorGroupId===item.editorGroupId).map(candidate=>candidate.id):[item.id];
      const groupMap=new Map();
      const copies=items.filter(candidate=>sourceIds.includes(candidate.id)).map(source=>{let editorGroupId=source.editorGroupId;if(editorGroupId){if(!groupMap.has(editorGroupId))groupMap.set(editorGroupId,`group-${nextGroupId.current++}`);editorGroupId=groupMap.get(editorGroupId);}return {...structuredClone(source),id:nextId.current++,editorGroupId};});
      const ids=copies.map(copy=>copy.id);setItems(old=>[...old,...copies]);setSelectedGroupId(null);setSelectedId(ids.length===1?ids[0]:null);setMultiSelectedIds(ids.length>1?ids:[]);
      dragRef.current={groupId:"selection",px:event.clientX,py:event.clientY,members:copies.map(copy=>({id:copy.id,x:copy.x,y:copy.y})),historyCommitted:true};
      return;
    }
    if (!event.shiftKey && multiSelectedIds.length > 1 && multiSelectedIds.includes(item.id)) {
      dragRef.current = { groupId: "selection", px: event.clientX, py: event.clientY, members: items.filter(member=>multiSelectedIds.includes(member.id)).map(member=>({id:member.id,x:member.x,y:member.y})) };
      return;
    }
    if (item.editorGroupId) {
      const members = items.filter(
        (candidate) => candidate.editorGroupId === item.editorGroupId,
      );
      if (event.shiftKey) {
        const current=[...new Set([...multiSelectedIds,...(selectedId?[selectedId]:[]),...selectedGroupItems.map(member=>member.id)])];
        const memberIds=members.map(member=>member.id),removing=memberIds.every(id=>current.includes(id));
        const next=removing?current.filter(id=>!memberIds.includes(id)):[...new Set([...current,...memberIds])];
        setSelectedGroupId(null);setSelectedId(next.length===1?next[0]:null);setMultiSelectedIds(next.length>1?next:[]);dragRef.current=null;return;
      }
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
        setSelectedGroupId(null);
        dragRef.current=null;
        return;
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
      if(event.shiftKey){
        const members=items.filter(candidate=>candidate.editorGroupId===item.editorGroupId).map(candidate=>candidate.id);
        const current=[...new Set([...multiSelectedIds,...(selectedId?[selectedId]:[]),...selectedGroupItems.map(member=>member.id)])];
        const removing=members.every(id=>current.includes(id)),next=removing?current.filter(id=>!members.includes(id)):[...new Set([...current,...members])];
        setSelectedGroupId(null);setSelectedId(next.length===1?next[0]:null);setMultiSelectedIds(next.length>1?next:[]);return;
      }
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
      setRotationReadout({x:event.clientX,y:event.clientY,degrees});
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
            if(original.type==='image')return resizeCroppedImage(original,handle,localX,localY,snapValue);
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
    if (!(await appConfirm(`Delete "${item.label}" from the equipment library? It will be hidden from the library. You can restore it from Submissions & recovery.`))) return;
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
    if(stageDragRef.current.handle==="curtain-endpoint") {
      const drag=stageDragRef.current,point=stagePointer(event,false);
      setStageLines(old=>old.map(line=>line.id===drag.original.id?resizeCurtain(drag.original,drag.end,point):line));
      return;
    }
    if (stageDragRef.current.handle === "asset-move") {
      const point = stagePointer(event, false); const drag = stageDragRef.current; const dx = point.x - drag.start.x; const dy = point.y - drag.start.y;
      const translateNodes = nodes => translateBoundaryNodes(nodes,dx,dy);
      if (drag.assetType === "stage") setStageNodes(translateNodes(drag.original));
      if (drag.originals) {
        if (drag.originals["stage-boundary"]?.nodes) setStageNodes(translateNodes(drag.originals["stage-boundary"].nodes));
        setZones(old => old.map(zone => drag.originals[zone.id]?.nodes ? {...zone,nodes:translateNodes(drag.originals[zone.id].nodes)} : zone));
        setTextItems(old => old.map(item => drag.originals[item.id] ? {...item,x:drag.originals[item.id].x+dx,y:drag.originals[item.id].y+dy} : item));
        setStageLines(old=>old.map(item=>drag.originals[item.id]?{...item,x:drag.originals[item.id].x+dx,y:drag.originals[item.id].y+dy}:item));
        setReferenceImages(old => old.map(image => drag.originals[image.id] ? {...image,x:drag.originals[image.id].x+dx,y:drag.originals[image.id].y+dy} : image));
      } else {
        if (drag.assetType === "zone") setZones((old) => old.map((zone) => zone.id === drag.id ? { ...zone, nodes: translateNodes(drag.original) } : zone));
        if (drag.assetType === "text") setTextItems((old) => old.map((item) => item.id === drag.id ? { ...item, x: drag.original.x + dx, y: drag.original.y + dy } : item));
        if (drag.assetType === "line") setStageLines(old=>old.map(item=>item.id===drag.id?{...item,x:drag.original.x+dx,y:drag.original.y+dy}:item));
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
  const loadArtworkImage=event=>{
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    if(file.size>12_000_000){flash('Images must be smaller than 12 MB.');return}
    const reader=new FileReader()
    reader.onload=()=>{
      if(!validImageDataUrl(reader.result)){flash('Choose a PNG, JPEG, WebP, GIF or AVIF image.');return}
      const image=new Image()
      image.onload=()=>{
        const width=Math.min(realWidth*.8,realWidth),height=Math.min(realDepth*.8,width*image.height/image.width),id=nextId.current++
        checkpoint();setItems(old=>[...old,{id,type:'image',name:file.name||'Image',dataUrl:reader.result,x:(realWidth-width)/2,y:(realDepth-height)/2,width,height,rotation:0,opacity:1,crop:{left:0,right:0,top:0,bottom:0},collision:false,editorVisible:true}]);setSelectedId(id);setMultiSelectedIds([]);setSelectedGroupId(null);setSelectedReferenceId(null)
      }
      image.onerror=()=>flash('The image could not be read.')
      image.src=reader.result
    }
    reader.readAsDataURL(file)
  }
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
    if (asset.locked || event.ctrlKey) return;
    if(event.shiftKey){event.preventDefault();event.stopPropagation();const current=selectedStageAssetIds,members=stageGroupIds(orderedAssets,asset.id),next=members.every(id=>current.includes(id))?current.filter(id=>!members.includes(id)):[...new Set([...current,...members])];setSelectedStageAssetIds(next);setSelectedReferenceId(null);setSelectedZoneId(null);setSelectedTextId(null);setSelectedStageLineId(null);setSelectedStageNode(null);return;}
    if(event.altKey&&assetType!=="stage"){
      event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);checkpoint();
      const sources=selectedStageAssetIds.includes(asset.id)?orderedAssets.filter(candidate=>selectedStageAssetIds.includes(candidate.id)):orderedAssets.filter(candidate=>stageGroupIds(orderedAssets,asset.id).includes(candidate.id));
      const copies=copyStageGroups(sources.map(source=>({...structuredClone(source),id:`copy-${Date.now()}-${clipboardId.current++}`,zOrder:orderedAssets.length+clipboardId.current})),()=>`stage-group-${Date.now()}-${nextGroupId.current++}`);
      setZones(old=>[...old,...copies.filter(candidate=>candidate.assetType==="zone").map(({assetType:ignored,...copy})=>copy)]);
      setTextItems(old=>[...old,...copies.filter(candidate=>candidate.assetType==="text").map(({assetType:ignored,...copy})=>copy)]);
      setStageLines(old=>[...old,...copies.filter(candidate=>candidate.assetType==="line").map(({assetType:ignored,...copy})=>copy)]);
      setReferenceImages(old=>[...old,...copies.filter(candidate=>candidate.assetType==="image").map(({assetType:ignored,...copy})=>copy)]);
      const ids=copies.map(copy=>copy.id),originals=Object.fromEntries(copies.map(copy=>[copy.id,copy.assetType==="zone"?{nodes:structuredClone(copy.nodes)}:{x:copy.x,y:copy.y}]));
      stageDragRef.current={handle:"asset-move",assetType,id:copies.find((_,index)=>sources[index].id===asset.id)?.id,start:stagePointer(event,false),originals};
      setSelectedStageAssetIds(ids);setSelectedStageNode(null);
      const active=copies.find((_,index)=>sources[index].id===asset.id);
      setSelectedZoneId(active?.assetType==="zone"?active.id:null);setSelectedTextId(active?.assetType==="text"?active.id:null);setSelectedStageLineId(active?.assetType==="line"?active.id:null);setSelectedReferenceId(active?.assetType==="image"?active.id:null);
      return;
    }
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); checkpoint();
    const moveIds = selectedStageAssetIds.includes(asset.id) ? selectedStageAssetIds : stageGroupIds(orderedAssets,asset.id);
    const selectedAssets = [{id:"stage-boundary",assetType:"stage",nodes:stageNodes,locked:stageBoundaryLocked}, ...orderedAssets].filter(candidate => moveIds.includes(candidate.id) && !candidate.locked);
    const originals = selectedAssets.length > 1 ? Object.fromEntries(selectedAssets.map(candidate => [candidate.id, candidate.assetType === "zone" || candidate.assetType === "stage" ? {nodes:structuredClone(candidate.nodes)} : {x:candidate.x,y:candidate.y}])) : null;
    stageDragRef.current = { handle: "asset-move", assetType, id: asset.id, start: stagePointer(event, false), original: assetType === "zone" || assetType === "stage" ? structuredClone(asset.nodes) : { x: asset.x, y: asset.y }, originals };
    setSelectedStageAssetIds(moveIds);
    if (assetType === "zone") { setSelectedZoneId(asset.id); setSelectedTextId(null); }
    else if (assetType === "text") { setSelectedTextId(asset.id); setSelectedZoneId(null); }
    else { setSelectedTextId(null); setSelectedZoneId(null); }
    setSelectedStageLineId(assetType==="line"?asset.id:null);
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
  const updateSelectedZoneAnchor=(axis,value)=>{
    if(!selectedZone||!selectedZoneAnchor||!Number.isFinite(value))return;
    const dx=axis==="x"?value-selectedZoneAnchor.x:0,dy=axis==="y"?value-selectedZoneAnchor.y:0;
    checkpoint();setZones(old=>old.map(zone=>zone.id===selectedZone.id?{...zone,nodes:translateBoundaryNodes(zone.nodes,dx,dy)}:zone));
  };
  const reorderAsset = (draggedId, targetId) => {
    const movingIds=Array.isArray(draggedId)?draggedId:[draggedId];if(movingIds.includes(targetId))return;
    const ordered=orderedAssets.map(asset=>asset.id),moving=ordered.filter(id=>movingIds.includes(id)),ids=ordered.filter(id=>!movingIds.includes(id)),to=ids.indexOf(targetId);if(!moving.length||to<0)return;
    ids.splice(to,0,...moving);
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
    setStageLines(old=>old.map(item=>({...item,zOrder:order.get(item.id)})));
  };
  const toggleAssetLock = (asset) => {
    checkpoint();
    if (asset.assetType === "image") setReferenceImages((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item));
    if (asset.assetType === "zone") { setZones((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item)); if (selectedZoneId === asset.id) setSelectedStageNode(null); }
    if (asset.assetType === "text") setTextItems((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item));
    if(asset.assetType==="line")setStageLines(old=>old.map(item=>item.id===asset.id?{...item,locked:!item.locked}:item));
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
    setItemFolders(old=>removeZonesFromFolders(old,ids));
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
  };
  const copySelected = () => {
    if(documentMode==="stage"){
      const assets=orderedAssets.filter(asset=>selectedStageAssetIds.includes(asset.id));
      if(!assets.length)return;
      clipboardRef.current={mode:"stage",assets:structuredClone(assets),pasteCount:0};flash(`${assets.length} stage part${assets.length===1?"":"s"} copied`);return;
    }
    const ids=selectedGroupId?selectedGroupItems.map(item=>item.id):multiSelectedIds.length?multiSelectedIds:selectedId?[selectedId]:[];
    if(!ids.length)return;
    clipboardRef.current={mode:"item",items:structuredClone(items.filter(item=>ids.includes(item.id))),pasteCount:0};flash(`${ids.length} layer${ids.length===1?"":"s"} copied`);
  };
  const pasteSelected = () => {
    const clipboard=clipboardRef.current;
    if(!clipboard||clipboard.mode!==documentMode)return;
    checkpoint();clipboard.pasteCount+=1;const offset=.1*clipboard.pasteCount;
    if(documentMode==="item"){
      const groupMap=new Map();
      const copies=clipboard.items.map(item=>{let editorGroupId=item.editorGroupId;if(editorGroupId){if(!groupMap.has(editorGroupId))groupMap.set(editorGroupId,`group-${nextGroupId.current++}`);editorGroupId=groupMap.get(editorGroupId);}return {...structuredClone(item),id:nextId.current++,x:item.x+offset,y:item.y+offset,editorGroupId};});
      setItems(old=>[...old,...copies]);const ids=copies.map(item=>item.id);setSelectedGroupId(null);setSelectedId(ids.length===1?ids[0]:null);setMultiSelectedIds(ids.length>1?ids:[]);flash(`${ids.length} layer${ids.length===1?"":"s"} pasted`);return;
    }
    const copies=copyStageGroups(clipboard.assets.map(asset=>{const id=`copy-${Date.now()}-${clipboardId.current++}`,copy={...structuredClone(asset),id,zOrder:orderedAssets.length+clipboardId.current};if(copy.assetType==="zone")copy.nodes=translateBoundaryNodes(copy.nodes,offset,offset);else {copy.x+=offset;copy.y+=offset;}return copy;}),()=>`stage-group-${Date.now()}-${nextGroupId.current++}`);
    setZones(old=>[...old,...copies.filter(asset=>asset.assetType==="zone").map(({assetType,...asset})=>asset)]);
    setTextItems(old=>[...old,...copies.filter(asset=>asset.assetType==="text").map(({assetType,...asset})=>asset)]);
    setStageLines(old=>[...old,...copies.filter(asset=>asset.assetType==="line").map(({assetType,...asset})=>asset)]);
    setReferenceImages(old=>[...old,...copies.filter(asset=>asset.assetType==="image").map(({assetType,...asset})=>asset)]);
    setSelectedStageAssetIds(copies.map(asset=>asset.id));setSelectedZoneId(null);setSelectedTextId(null);setSelectedStageLineId(null);setSelectedReferenceId(null);flash(`${copies.length} stage part${copies.length===1?"":"s"} pasted`);
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
          ? { ...item, editorGroupId: id, editorGroupName: "Group", editorGroupToggleable: false }
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
          ? { ...item, editorGroupId: undefined, editorGroupName: undefined, editorGroupToggleable: undefined }
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
  const saveToLibrary = async (submit=false) => {
    if(embeddedEquipment){if(!items.length)return flash('Add artwork before saving');setSaveError('');setEquipmentSaveOpen(true);return;}
    if(embeddedStage){if(saveLock.current)return;saveLock.current=true;setShapeSaving(true);setSaveError('');try{await embeddedStage.onSave({...embeddedStage.data,...stageData,id:embeddedStage.data.id,layoutEquipment,layoutFolders:equipmentFolders,notes:layoutNotes},submit===true);savedProject.current=projectSnapshot;flash(readOnlyStage?(submit===true?'Submitted for review':'Layout saved'):'Stage version saved');}catch(error){setSaveError(error.message);flash(error.message);}finally{saveLock.current=false;setShapeSaving(false);}return;}
    if (shapeSaving) return;
    if(editingSubmission){setReviewerMessage(editingSubmission.review_note || '');setSubmissionSaveOpen(true);return;}
    if(personalSource){
      try {
        const copy=await accountRequest('/'+personalSource.kind+'/'+personalSource.asset.id+'/fork','POST',{});
        const data={...(documentMode==='stage'?stageData:itemData),id:copy.id,revision:copy.revision,profiles:copy.profiles};
        if(documentMode==='stage')await persistStage(data,projectSnapshot,'Personal copy saved');else await persistEquipment(data,projectSnapshot);
      }catch(error){flash(error.message)}
      return;
    }
    if (documentMode === "stage") {
      await persistStage(stageData, projectSnapshot, activeLibraryId ? "Stage updated" : "Stage added to Stageplot");
      return;
    }
    if (!items.length) return flash("Add artwork before saving");
    if (!shapeName.trim()) return flash("Give the shape a name before saving");
    const choice = equipmentSaveChoice(library, activeLibraryId, shapeName);
    if(choice && !editable(choice.target)){await persistEquipment({...itemData,id:newAssetId(),revision:undefined,personal:true},projectSnapshot);return;}
    if (choice) {
      setSaveChoice({ ...choice, data: itemData, snapshot: projectSnapshot, newId: newAssetId() });
      return;
    }
    await persistEquipment(itemData, projectSnapshot);
  };
  const saveEmbeddedEquipment=async options=>{
    if(saveLock.current)return;saveLock.current=true;setShapeSaving(true);setSaveError('');
    try{const saved=await embeddedEquipment.onSave(await prepareEquipmentImages(itemData),options);if(saved?.id){setLibrary(old=>[...old.filter(item=>item.id!==saved.id),saved]);setActiveLibraryId(saved.id);setDraftAssetId(saved.id)}savedProject.current=projectSnapshot;setEquipmentSaveOpen(false);flash(options.submit?'Private equipment saved and submitted for review':'Equipment saved')}
    catch(error){setSaveError(error.message)}finally{saveLock.current=false;setShapeSaving(false)}
  };
  const cutSelected = (retainCutter=false) => {
    if(multiSelectedIds.length!==2)return;
    const selectedLayers=items.filter(item=>multiSelectedIds.includes(item.id));
    if(selectedLayers.length!==2)return;
    const [bottom,cutter]=selectedLayers;
    try {
      const rings=subtractLayers(bottom,cutter);
      checkpoint();
      const results=rings.map((ring,index)=>vectorFromCutRing(bottom,ring,index===0?bottom.id:nextId.current++));
      const selectedSet=new Set(retainCutter?[bottom.id]:[bottom.id,cutter.id]),insertAt=items.findIndex(item=>item.id===bottom.id);
      const remaining=items.filter(item=>!selectedSet.has(item.id));remaining.splice(Math.max(0,insertAt),0,...results);setItems(remaining);
      const ids=results.map(item=>item.id);setSelectedId(ids.length===1?ids[0]:null);setMultiSelectedIds(ids.length>1?ids:[]);setSelectedGroupId(null);setVectorNodeIndex(null);
      flash(results.length?`Cut created ${results.length} editable vector${results.length===1?'':'s'}${retainCutter?' and retained the cutter':''}`:'The cutter removed the entire lower layer');
    } catch(error){flash(error.message||'These layers could not be cut');}
  };
  const mergeSelected=()=>{
    if(multiSelectedIds.length<2)return;
    const selectedLayers=items.filter(item=>multiSelectedIds.includes(item.id));
    try{
      const ring=unionLayers(selectedLayers),base=selectedLayers[0],merged={...vectorFromCutRing(base,ring,base.id),name:`${base.name||"Layer"} merged`};
      checkpoint();const selectedSet=new Set(multiSelectedIds),insertAt=items.findIndex(item=>item.id===base.id),remaining=items.filter(item=>!selectedSet.has(item.id));remaining.splice(Math.max(0,insertAt),0,merged);setItems(remaining);setItemFolders(old=>old.map(folder=>({...folder,zoneIds:folder.zoneIds.filter(id=>!selectedSet.has(id)||id===base.id)})));setSelectedId(base.id);setMultiSelectedIds([]);setSelectedGroupId(null);setVectorNodeIndex(null);flash(`${selectedLayers.length} layers merged into one editable vector`);
    }catch(error){flash(error.message||"These layers could not be merged");}
  };
  const createRotationPart = async () => {
    const ids = selectedGroupId ? selectedGroupItems.map(item=>item.id) : [...new Set([...multiSelectedIds,...(selectedId ? [selectedId] : [])])];
    if (!ids.length) return flash("Select one or more layers first");
    const name = (await appPrompt("Rotation part name", "Adjustable part"))?.trim();
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
      setPersonalSource(null);
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
    await persistStage({...stageData,id,label,visibility:"draft"},snapshot,"New stage version saved");
  };
  const persistEquipment = async (data, snapshot) => {
    if (shapeSaving) return;
    setShapeSaving(true);
    try {
      data=await prepareEquipmentImages(data);
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
      setPersonalSource(null);
      savedProject.current = snapshot;
      setActiveLibraryId(result.id);
      setSaveChoice(null);
      await refreshLibrary();
      flash("Shape saved to equipment library");
    } catch (error) {
      flash(error.message || "Could not save item");
    } finally { setShapeSaving(false); }
  };
  const editLibraryItem = async (item, preview=false, propose=false) => {
    let newPersonal=false;
    setEditingSubmission(null);
    if(!preview && (propose || !editable(item))){
      const ownCopy=(library).find(a=>a.ownerId===user.id&&a.proposedReplacementId===item.id);
      if(ownCopy)item=ownCopy;else newPersonal=true;
    }
    setPersonalSource(newPersonal?{kind:'items',asset:item}:null);
    setVectorDrawing(null);setVectorPreview(null);
    setCanvasResizeView(null);
    resetProjectBaseline.current = true;
    setDocumentMode("item");
    setAdvancedShapeRole(item.editor?.advancedShapeRole || null);
    setActiveLibraryId(preview||newPersonal?null:item.id);
    if(preview||newPersonal)setDraftAssetId(newAssetId());
    setShapeName(preview?item.label+" - Review copy":item.label);
    setGroupId(item.groupId || "");
    setRealWidth(item.dimensions.widthMeters);
    setRealDepth(item.dimensions.depthMeters);
    setItems((item.editor?.layers || []).map(layer=>{const normalized=layer.collisionOnly?{...layer,collision:true}:layer;return normalized.type==="text"?sizeText(normalized):normalized;}));
    setItemFolders(normalizeZoneFolders(item.editor?.layerFolders, item.editor?.layers || []));
    setRotationParts(item.rotationParts || []);
    setComponents(normaliseComponents(item.components));
    setCornerSnapping(Boolean(item.snapPoints?.length));
    setReferenceImages([]);
    setSelectedReferenceId(null);
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
    setHistory([]);setFuture([]);
    setLibraryOpen(false);
    nextId.current = Math.max(
      20,
      ...(item.editor?.layers || []).map((layer) => layer.id + 1),
    );
    flash(`Editing ${item.label}`);
  };
  const editLibraryStage = async (stage, preview=false, propose=false) => {
    let newPersonal=false;
    setEditingSubmission(null);
    if(!preview && (propose || !editable(stage))){
      const ownCopy=(stageLibrary).find(a=>a.ownerId===user.id&&a.proposedReplacementId===stage.id);
      if(ownCopy)stage=ownCopy;else newPersonal=true;
    }
    setPersonalSource(newPersonal?{kind:'stages',asset:stage}:null);
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
    setActiveLibraryId(preview||newPersonal?null:stage.id);
    if(preview||newPersonal)setDraftAssetId(newAssetId("stage"));
    setShapeName(preview?stage.label+" - Review copy":stage.label);
    setRealWidth(stage.dimensions.widthMeters);
    setRealDepth(stage.dimensions.depthMeters);
    setStageNodes(normalized);
    setStageBoundaryLocked(stage.editor?.stageBoundaryLocked ?? false);
    setFixedEquipment(structuredClone(stage.fixedEquipment || []));
    setZones((stage.zones || []).map((zone, index) => ({ ...zone, zOrder: zone.zOrder ?? index })));
    setTextItems((stage.textItems || []).map((item, index) => ({ ...item, zOrder: item.zOrder ?? (stage.zones?.length || 0) + index })));
    setStageLines(stageLineAssets(stage).map((item,index)=>({...item,zOrder:item.zOrder??(stage.zones?.length||0)+(stage.textItems?.length||0)+index})));
    setSelectedStageLineId(null);
    setSelectedTextId(null);
    setSelectedZoneId(null);
    const savedImages = stage.editor?.referenceImages || (stage.editor?.referenceImage ? [{ ...stage.editor.referenceImage, id: "image-legacy", name: "Reference image" }] : []);
    setReferenceImages(savedImages.map((image, index) => ({ ...image, zOrder: image.zOrder ?? (stage.zones?.length || 0) + index })));
    setZoneFolders(normalizeZoneFolders(stage.editor?.assetFolders || stage.editor?.zoneFolders, [...savedImages, ...(stage.zones || []), ...(stage.textItems || []), ...stageLineAssets(stage)]));
    setSelectedReferenceId(null);
    setSelectedStageNode(null);
    setLibraryOpen(false);
    setHistory([]);setFuture([]);
  };
  const stageDraftOpened=useRef(false);
  const openLinkedStage=useEffectEvent(async ()=>{
    if(equipmentOnly||embeddedStage)return;
    const id=new URLSearchParams(window.location.search).get('stageDraft');
    if(!id||stageDraftOpened.current||!stageLibrary.length)return;
    const draft=stageLibrary.find(stage=>stage.id===id);
    if(!draft){flash('The stage draft is unavailable. Open it from the library.');stageDraftOpened.current=true;return;}
    stageDraftOpened.current=true;
    if(projectSnapshot!==savedProject.current&&!(await appConfirm('Open the new stage draft and replace the current Studio document? Save your current work first if needed.')))return;
    editLibraryStage(draft);
    const url=new URL(window.location.href);url.searchParams.delete('stageDraft');window.history.replaceState(null,'',url.href);
  });
  useEffect(()=>{openLinkedStage()},[stageLibrary]);
  const newItem = async (mode) => {
    if (projectSnapshot !== savedProject.current && !(await appConfirm("This project has unsaved changes. Discard them and create a new " + (mode === "stage" ? "stage" : "equipment item") + "?"))) return;
    setPersonalSource(null);setEditingSubmission(null);setSubmissionSaveOpen(false);
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
    setItemFolders([]);
    setRotationParts([]);
    setComponents([]);
    setCornerSnapping(false);
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
    setHistory([]);setFuture([]);
    setRealWidth(width);
    setRealDepth(depth);
    setStageNodes(defaultStageNodes(width, depth));
    setStageBoundaryLocked(false);
    setFixedEquipment([]);
    setZones([]);
    setZoneFolders([]);
    setTextItems([]);
    setStageLines([]);
    setSelectedStageLineId(null);
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
  const editManagedItem = async item => {
    if (projectSnapshot !== savedProject.current && !(await appConfirm("This project has unsaved changes. Discard them and load " + item.label + " for editing?"))) return;
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
    const label = (await appPrompt("Group name"))?.trim();
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
    const next = Math.max(0.25, Math.min(6, zoom * factor));
    const rect = viewportRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    setPan({x:x-(x-pan.x)*next/zoom,y:y-(y-pan.y)*next/zoom});
    setZoom(next);
  };
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", zoomViewport, {passive:false});
    return () => viewport.removeEventListener("wheel", zoomViewport);
  });
  const startPan = (event) => {
    if(embeddedStage&&(readOnlyStage||placement.selected)&&event.button===0&&!event.target.closest?.('.placed-equipment, .equipment-controls')){placement.beginMarquee(event);return}
    if (vectorDrawing && event.button===0) {drawVectorPoint(event);return;}
    const occupied = documentMode === "item"
      ? ".shape-layer, .reference-image, .ordered-reference"
      : ".placed-equipment, .equipment-controls, .editable-zone, .ordered-reference, .stage-text, .stage-floor, .boundary-node, .segment-hit, .curve-control, .bezier-control";
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
  const manageStage = async (stage, label, changes = {}) => {
    const deleting = label === undefined;
    if (deleting && !(await appConfirm(`Move ${stage.label} to deleted assets? Its share links will stop working. You can restore it from Submissions & recovery.`))) return;
    setRemovingStageplotId(stage.id);
    try {
      const response = await fetch(`${STAGES_API}/${encodeURIComponent(stage.id)}`, deleting
        ? { method: "DELETE" }
        : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...stage, ...changes, label: label.trim() }) });
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
      flash(deleting ? editingCurrent ? "Stage deleted; canvas retained as an unsaved copy" : "Stage deleted" : changes.resetShareLink ? "Stage link reset; previous links no longer work" : "Stage updated");
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
          if(asset.assetType==="line"){
            return stageLineBounds(asset);
            
          }
          const xs=asset.nodes.map(node=>node.x), ys=asset.nodes.map(node=>node.y);
          return {x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
        };
        const selectableAssets = [...orderedAssets, {id:"stage-boundary",assetType:"stage",nodes:stageNodes,locked:stageBoundaryLocked}];
        const ids = [...new Set([...drag.additive,...selectableAssets.filter(asset=>!asset.locked && asset.id && containsBounds(box,boundsFor(asset))).flatMap(asset=>stageGroupIds(orderedAssets,asset.id))])];
        setSelectedStageAssetIds(ids);
        if (ids.length === 1) {
          const asset=selectableAssets.find(candidate=>candidate.id===ids[0]);
          setSelectedReferenceId(asset?.assetType==="image"?asset.id:null); setSelectedZoneId(asset?.assetType==="zone"?asset.id:null); setSelectedTextId(asset?.assetType==="text"?asset.id:null);setSelectedStageLineId(asset?.assetType==="line"?asset.id:null);
        } else { setSelectedReferenceId(null); setSelectedZoneId(null); setSelectedTextId(null);setSelectedStageLineId(null); }
        setSelectedStageNode(null); marqueeRef.current=null; setMarquee(null); panRef.current=null; return;
      }
      const ids = [...new Set([...drag.additive, ...enclosedItems(items,selectionBox(drag.worldStart,canvasWorldPoint(event)),item=>{
        if(item.type==='image')return rotatedBounds([item]);
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
  const removeStageSelection = () => {
    if(readOnlyStage)return;
    if(selectedStageNode!==null){
      const nodes=selectedZone?.nodes||stageNodes;
      if(nodes.length<=3)return flash("A closed boundary needs at least three nodes");
      checkpoint();
      if(selectedZoneId)setZones(old=>old.map(zone=>zone.id===selectedZoneId?{...zone,nodes:zone.nodes.filter((_,index)=>index!==selectedStageNode)}:zone));
      else setStageNodes(old=>old.filter((_,index)=>index!==selectedStageNode));
      setSelectedStageNode(null);return;
    }
    const ids=new Set([...selectedStageAssetIds,...(selectedZoneId?[selectedZoneId]:[]),...(selectedTextId?[selectedTextId]:[]),...(selectedStageLineId?[selectedStageLineId]:[]),...(selectedReferenceId?[selectedReferenceId]:[])]);
    ids.delete("stage-boundary");
    if(!ids.size)return;
    checkpoint();
    setZones(old=>old.filter(zone=>!ids.has(zone.id)));setZoneFolders(old=>removeZonesFromFolders(old,[...ids]));setTextItems(old=>old.filter(item=>!ids.has(item.id)));setStageLines(old=>old.filter(item=>!ids.has(item.id)));setReferenceImages(old=>old.filter(image=>!ids.has(image.id)));
    setSelectedStageAssetIds([]);setSelectedZoneId(null);setSelectedTextId(null);setSelectedStageLineId(null);setSelectedReferenceId(null);setSelectedStageNode(null);
  };
  useEffect(() => {
    const keyDown = (event) => {
      if(currentDialog())return;
      if (event.key === "Escape" && stageMoveMode) {
        event.preventDefault();setStageMoveMode(false);return;
      }
      if (event.key === "Escape" && vectorDrawing) {
        event.preventDefault();finishVectorDrawing(false);return;
      }
      if (
        event.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
      )
        return;
      if (!readOnlyStage && documentMode === "stage" && event.key.toLowerCase() === "m" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();setStageMoveMode(true);setSelectedStageNode(null);flash("Move tool active · drag whole stage assets · Esc to exit");return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
        event.preventDefault();setVectorDrawing(null);setVectorPreview(null);redo();return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setVectorDrawing(null);setVectorPreview(null);
        undo();
        return;
      }
      if(readOnlyStage)return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") { event.preventDefault();copySelected();return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") { event.preventDefault();pasteSelected();return; }
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) {
        const amount=event.shiftKey?.1:.01,dx=event.key==="ArrowLeft"?-amount:event.key==="ArrowRight"?amount:0,dy=event.key==="ArrowUp"?-amount:event.key==="ArrowDown"?amount:0;
        if(documentMode==="item"){
          const ids=selectedGroupId?selectedGroupItems.map(item=>item.id):multiSelectedIds.length?multiSelectedIds:selectedId?[selectedId]:[];
          if(ids.length){event.preventDefault();checkpoint();setItems(old=>old.map(item=>ids.includes(item.id)&&!item.editorLocked?{...item,x:item.x+dx,y:item.y+dy}:item));}
        }else{
          const ids=selectedStageAssetIds;
          if(ids.length){event.preventDefault();checkpoint();setZones(old=>old.map(zone=>ids.includes(zone.id)&&!zone.locked?{...zone,nodes:zone.nodes.map(node=>({...node,x:node.x+dx,y:node.y+dy}))}:zone));setTextItems(old=>old.map(item=>ids.includes(item.id)&&!item.locked?{...item,x:item.x+dx,y:item.y+dy}:item));setStageLines(old=>old.map(item=>ids.includes(item.id)&&!item.locked?{...item,x:item.x+dx,y:item.y+dy}:item));setReferenceImages(old=>old.map(item=>ids.includes(item.id)&&!item.locked?{...item,x:item.x+dx,y:item.y+dy}:item));}
        }
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if(documentMode==="stage")removeStageSelection();else remove();
      }
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  });

  useEffect(()=>{if(documentMode!=="stage")setStageMoveMode(false);},[documentMode]);

  const selectStageAsset = (event, asset) => {
    if(event.shiftKey){const current=selectedStageAssetIds,members=stageGroupIds(orderedAssets,asset.id),next=members.every(id=>current.includes(id))?current.filter(id=>!members.includes(id)):[...new Set([...current,...members])];setSelectedStageAssetIds(next);setSelectedReferenceId(null);setSelectedZoneId(null);setSelectedTextId(null);setSelectedStageLineId(null);setSelectedStageNode(null);return;}
    if (asset.assetType === "image") { setSelectedReferenceId(asset.id); setSelectedZoneId(null); setSelectedTextId(null); }
    else if (asset.assetType === "text") { setSelectedTextId(asset.id); setSelectedZoneId(null); setSelectedReferenceId(null); }
    else if(asset.assetType==="line"){setSelectedStageLineId(asset.id);setSelectedZoneId(null);setSelectedTextId(null);setSelectedReferenceId(null);}
    else { setSelectedZoneId(asset.id); setSelectedTextId(null); setSelectedReferenceId(null); }
    if(asset.assetType!=="line")setSelectedStageLineId(null);
    setSelectedStageNode(null);
    setSelectedStageAssetIds(stageGroupIds(orderedAssets,asset.id));
  };

  const alignItemSelection=(axis,edge)=>{
    const ids=selectedGroupId?selectedGroupItems.map(item=>item.id):multiSelectedIds;
    const layers=items.filter(item=>ids.includes(item.id)&&!item.editorLocked);if(layers.length<2)return;
    const values=layers.map(item=>axis==="x"?(edge==="start"?item.x:edge==="end"?item.x+item.width:item.x+item.width/2):(edge==="start"?item.y:edge==="end"?item.y+item.height:item.y+item.height/2));
    const target=edge==="start"?Math.min(...values):edge==="end"?Math.max(...values):values.reduce((sum,value)=>sum+value,0)/values.length;
    checkpoint();setItems(old=>old.map(item=>{if(!ids.includes(item.id)||item.editorLocked)return item;const current=axis==="x"?(edge==="start"?item.x:edge==="end"?item.x+item.width:item.x+item.width/2):(edge==="start"?item.y:edge==="end"?item.y+item.height:item.y+item.height/2);return {...item,[axis]:item[axis]+target-current};}));
  };
  const distributeItemSelection=axis=>{
    const ids=selectedGroupId?selectedGroupItems.map(item=>item.id):multiSelectedIds,layers=items.filter(item=>ids.includes(item.id)&&!item.editorLocked).sort((a,b)=>(a[axis]+(axis==="x"?a.width:a.height)/2)-(b[axis]+(axis==="x"?b.width:b.height)/2));if(layers.length<3)return;
    const size=item=>axis==="x"?item.width:item.height,first=layers[0][axis]+size(layers[0])/2,last=layers.at(-1)[axis]+size(layers.at(-1))/2,positions=new Map(layers.map((item,index)=>[item.id,first+(last-first)*index/(layers.length-1)-size(item)/2]));checkpoint();setItems(old=>old.map(item=>positions.has(item.id)?{...item,[axis]:positions.get(item.id)}:item));
  };
  const addStageText=()=>{const id=`text-${Date.now()}`;checkpoint();setTextItems(old=>[...old,{id,name:`Text ${old.length+1}`,text:"Stage label",x:realWidth/2,y:realDepth/2,fontSize:.3,color:"#25261f",opacity:1,locked:false,toggleable:false,zOrder:orderedAssets.length}]);setSelectedTextId(id);setSelectedStageLineId(null);setSelectedZoneId(null);setSelectedReferenceId(null);setSelectedStageNode(null);setSelectedStageAssetIds([id]);};
  const addStageCurtain=()=>{const id=`curtain-${Date.now()}`;checkpoint();setStageLines(old=>[...old,normaliseCurtain({id,name:`Curtain ${old.filter(line=>line.type==="curtain").length+1}`,x:realWidth/2-Math.min(4,realWidth)/2,y:realDepth/2,length:Math.min(4,realWidth),locked:false,zOrder:orderedAssets.length})]);setSelectedStageLineId(id);setSelectedTextId(null);setSelectedZoneId(null);setSelectedReferenceId(null);setSelectedStageNode(null);setSelectedStageAssetIds([id]);};
  const addStageDimension=()=>{const id=`dimension-${Date.now()}`;checkpoint();setStageLines(old=>[...old,{id,name:`Dimension ${old.length+1}`,x:realWidth/2-.5,y:realDepth/2,length:1,rotation:0,color:"#287aa5",locked:false,zOrder:orderedAssets.length}]);setSelectedStageLineId(id);setSelectedTextId(null);setSelectedZoneId(null);setSelectedReferenceId(null);setSelectedStageNode(null);setSelectedStageAssetIds([id]);};
  const addStageZone=(rectangular=false)=>{const id=`zone-${Date.now()}`,x=realWidth*.25,y=realDepth*.25;checkpoint();setZones(old=>[...old,{id,zoneShape:rectangular?"rectangle":undefined,name:`${rectangular?"Rectangular zone":"Zone"} ${old.length+1}`,solid:false,label:false,locked:false,toggleable:false,fill:"#8eb6d8",fillMode:"single",fill2:"#25261f",stripeSpacing:.5,fillOpacity:.25,stroke:"#447799",strokeWidth:2,strokeOpacity:1,zOrder:orderedAssets.length,nodes:[{x,y,curveMode:"line"},{x:x+realWidth*.3,y,curveMode:"line"},{x:x+realWidth*.3,y:y+realDepth*.3,curveMode:"line"},{x,y:y+realDepth*.3,curveMode:"line"}]}]);setSelectedZoneId(id);setSelectedStageLineId(null);setSelectedTextId(null);setSelectedReferenceId(null);setSelectedStageAssetIds([id]);setSelectedStageNode(null);};

  const autosaveCurrent=useEffectEvent(()=>saveToLibrary());
  useEffect(()=>{if(!embeddedStage?.autosave||shapeSaving||projectSnapshot===savedProject.current||saveError)return;const timer=setTimeout(()=>autosaveCurrent(),1200);return()=>clearTimeout(timer)},[embeddedStage?.autosave,shapeSaving,projectSnapshot,saveError]);
  return (
    <MeasurementUnit.Provider value={documentMode === "stage" ? "m" : "cm"}>
    <div className={embeddedStage?`app unified-canvas ${readOnlyStage?'visitor-canvas':'stage-canvas'}`:"app"}>
      {embeddedStage?<header><div className="brand"><AppMark/><div>STAGEPLOT<small>{readOnlyStage?'PERFORMANCE LAYOUT':'STAGE AND EQUIPMENT'}</small></div></div><input className="title" aria-label={readOnlyStage?'Performance name':'Stage name'} readOnly={readOnlyStage} value={readOnlyStage?embeddedStage.layoutName:shapeName} onChange={event=>setShapeName(event.target.value)}/><div className="actions">{embeddedStage.onDashboard&&<button onClick={embeddedStage.onDashboard}>Dashboard</button>}{embeddedStage.onClaim&&<button onClick={embeddedStage.onClaim}>Save to my dashboard</button>}{embeddedStage.onSignIn&&<button onClick={embeddedStage.onSignIn}>Sign in to keep this layout</button>}{embeddedStage.guest&&<button onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);flash('Edit link copied')}catch{(await appPrompt('Copy your private edit link',window.location.href))}}}>Copy my edit link</button>}{!embeddedStage.guest&&<button disabled={shapeSaving} onClick={async ()=>{if(projectSnapshot===savedProject.current||(await appConfirm('Leave without saving your latest changes?')))embeddedStage.onBack()}}>{embeddedStage.backLabel||'Back to workspace'}</button>}<SaveStatus busy={shapeSaving} error={saveError} dirty={projectSnapshot!==savedProject.current}/>{!readOnlyStage&&<button onClick={()=>{placement.clear();setStockMode(value=>!value)}}>Available equipment</button>}<button onClick={()=>setHelpOpen(true)}>Help</button>{embeddedStage.onShare&&<button onClick={embeddedStage.onShare}>Share stage</button>}{embeddedStage.onReview&&<button onClick={()=>embeddedStage.onReview({...embeddedStage.data,...stageData,id:embeddedStage.data.id})}>Decide on public stage</button>}{embeddedStage.canSubmit&&<button disabled={shapeSaving} onClick={()=>saveToLibrary(true)}>Submit stage to public library</button>}<button onClick={()=>window.print()}>Export PDF</button><button className="accent" disabled={shapeSaving} onClick={()=>saveToLibrary()}>{readOnlyStage?'Save now':embeddedStage.review?'Save review edits':'Save stage version'}</button>{readOnlyStage&&<button className="accent" disabled={shapeSaving} onClick={()=>saveToLibrary(true)}>Submit for review</button>}</div></header>:embeddedEquipment?<header className="equipment-author-header"><div className="brand"><AppMark/><div>STAGEPLOT<small>{embeddedEquipment.review?'PUBLIC EQUIPMENT REVIEW':'EQUIPMENT DESIGN'}</small></div></div><input className="title" aria-label="Equipment name" value={shapeName} onChange={event=>setShapeName(event.target.value)}/><div className="actions"><button disabled={shapeSaving} onClick={async ()=>{if(projectSnapshot===savedProject.current||(await appConfirm('Leave this editor? Unsaved work will remain recoverable in this browser.')))embeddedEquipment.onBack()}}>Back to library</button><SaveStatus busy={shapeSaving} dirty={projectSnapshot!==savedProject.current}/><button onClick={()=>setHelpOpen(true)}>Help</button><button className="accent" disabled={shapeSaving} onClick={()=>saveToLibrary()}>{embeddedEquipment.review?'Review / save':'Save equipment'}</button></div></header>:<>      <header>
        <div className="brand">
          <AppMark studio />
          <div>
            SHAPE STUDIO<small>STAGEPLOT · {APP_VERSION}</small>
          </div>
        </div>
        <input
          className="title"
          value={manageStageplotOpen?'Equipment library':shapeName}
          readOnly={manageStageplotOpen}
          onChange={(e) => setShapeName(e.target.value)}
          aria-label="Shape name"
        />
        <div className="actions"><AccountButton/><AppNavigation studio/>{(documentMode==='stage'?stageLibrary:library).find(a=>a.id===activeLibraryId&&a.ownerId===user.id)&&<button onClick={()=>{const kind=documentMode==='stage'?'stages':'items';submitAsset(kind,(kind==='stages'?stageLibrary:library).find(a=>a.id===activeLibraryId))}}>Submit saved draft</button>}
          <button onClick={()=>setHelpOpen(true)}>Help</button>
          <button hidden={manageStageplotOpen} onClick={() => setNewItemOpen(true)}>New item</button>
          <button
            onClick={() => {
              refreshLibrary();
              setManageStageplotOpen(!manageStageplotOpen);
            }}
          >
            {manageStageplotOpen?'Equipment Studio':'Equipment library'}
          </button>
          {documentMode === "stage" && activeLibraryId && <button disabled={shapeSaving} onClick={()=>{setStageSaveAsName(`${shapeName} Copy`);setStageSaveAsOpen(true);}}>Save stage as</button>}
          <button className="accent" hidden={manageStageplotOpen} disabled={shapeSaving} onClick={saveToLibrary}>
            {shapeSaving ? "Saving..." : personalSource ? "Save personal copy" : (documentMode==='stage'?stageLibrary:library).find(a=>a.id===activeLibraryId&&a.ownerId===user.id) ? "Update personal copy" : editingSubmission ? "Save submission changes" : activeLibraryId ? (documentMode==='item'?"Update shape":"Update stage") : documentMode==='item'?"Save shape":"Save stage"}
          </button>
        </div>
      </header></>}
      {embeddedStage?.organisation&&<div className="canvas-organisation-branding"><OrganisationBranding organisation={embeddedStage.organisation}/></div>}
      {embeddedStage&&<StageplotPrintHeading organisation={embeddedStage.organisation} layoutName={embeddedStage.layoutName} stageName={shapeName}/>}
      <main inert={manageStageplotOpen} aria-hidden={manageStageplotOpen||undefined} className={panelResize?"resizing":""} style={{gridTemplateColumns:`${currentUi.leftOpen!==false?(currentUi.leftWidth||238):0}px 6px minmax(0,1fr) 6px ${currentUi.rightOpen!==false?(currentUi.rightWidth||250):0}px`}}>
        <aside className={`palette${currentUi.leftOpen===false?" panel-collapsed":""}`}><div hidden={readOnlyStage} onPointerDownCapture={()=>placement.clear()}>
          {documentMode === "stage" ? (
            <>
              <p className="eyebrow palette-create-control">ASSETS</p>
              <button
                className="group-button palette-create-control"
                onClick={() => imageFileRef.current?.click()}
              >
                Add background image
              </button>
              <button
                className="group-button palette-create-control"
                onClick={() => {
                  const id = `text-${Date.now()}`;
                  setTextItems((old) => [...old, { id, name: `Text ${old.length + 1}`, text: "Stage label", x: realWidth / 2, y: realDepth / 2, fontSize: 0.3, color: "#25261f", opacity: 1, locked: false, toggleable: false, zOrder: orderedAssets.length }]);
                  setSelectedTextId(id);
                  setSelectedStageLineId(null);
                  setSelectedStageAssetIds([id]);
                  setSelectedZoneId(null);
                  setSelectedReferenceId(null);
                  setSelectedStageNode(null);
                }}
              >
                Add text label
              </button>
              <button className="group-button palette-create-control" onClick={()=>{const id=`dimension-${Date.now()}`;checkpoint();setStageLines(old=>[...old,{id,name:`Dimension ${old.length+1}`,x:realWidth/2-.5,y:realDepth/2,length:1,rotation:0,color:"#287aa5",locked:false,zOrder:orderedAssets.length}]);setSelectedStageLineId(id);setSelectedTextId(null);setSelectedZoneId(null);setSelectedReferenceId(null);setSelectedStageNode(null);setSelectedStageAssetIds([id]);}}>
                Add dimension line
              </button>
              <button className="group-button palette-create-control" onClick={addStageCurtain}>Add curtain</button>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/*"
                onChange={loadReferenceImage}
                hidden
              />
              <details className="stage-layers" open><summary>Stage layers <small>{orderedAssets.length+1}</small></summary>
              <StageLayerList assets={orderedAssets} folders={zoneFolders} selected={selectedStageAssetIds} select={selectStageAsset} onLock={toggleAssetLock} changeAssets={(ids,changes)=>{checkpoint();if(changes.visible===false||changes.editorGroupVisible===false){setSelectedZoneId(null);setSelectedTextId(null);setSelectedReferenceId(null);setSelectedStageLineId(null);setSelectedStageAssetIds([])}const apply=old=>old.map(asset=>ids.includes(asset.id)?{...asset,...changes}:asset);setZones(apply);setTextItems(apply);setStageLines(apply);setReferenceImages(apply)}} changeFolders={next=>{checkpoint();setZoneFolders(next);setSelectedZoneId(null);setSelectedTextId(null);setSelectedReferenceId(null);setSelectedStageLineId(null);setSelectedStageAssetIds([])}} onDrag={id=>{assetDragRef.current=id}} onDrop={(target,folderId)=>{const id=assetDragRef.current;if(id==null)return;const ids=Array.isArray(id)?id:stageGroupIds(orderedAssets,id);checkpoint();if(folderId)setZoneFolders(old=>putZonesInFolder(old,ids,folderId));else{reorderAsset(ids,target);setZoneFolders(old=>removeZonesFromFolders(old,ids))}assetDragRef.current=null}}/>
              <button className={`stage-boundary-toggle${selectedStageAssetIds.includes("stage-boundary") ? " selected" : ""}`} type="button" aria-expanded={stageNodesExpanded} onClick={()=>setStageNodesExpanded(value=>!value)}><span>STAGE BOUNDARY</span><small>{stageNodes.length} nodes</small><LayerLock asSpan label="Stage boundary" locked={stageBoundaryLocked} onClick={event=>{event.stopPropagation();checkpoint();setStageBoundaryLocked(value=>!value);setSelectedStageNode(null);setSelectedStageAssetIds([]);}}/><LayerEye asSpan label="Stage boundary" visible={stageBoundaryVisible} onClick={()=>{checkpoint();setStageBoundaryVisible(value=>!value)}}/><b>{stageNodesExpanded ? "−" : "+"}</b></button>
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
                      setSelectedStageLineId(null);
                      setReferenceSelected(false);
                    }}
                  >
                    <i />
                    <span>Node {index + 1}</span>
                    <small>{segmentMode(node)}</small>
                  </button>
                ))}
              </div>}
              </details><p className="eyebrow advanced-title palette-create-control">ZONES</p>
              <button className="group-button palette-create-control" onClick={()=>addStageZone()}>Add zone</button>
              <button className="group-button palette-create-control" onClick={()=>addStageZone(true)}>Add rectangular zone</button>
            </>
          ) : (
            <>
              <p className="eyebrow advanced-title palette-create-control">SHAPES</p>
              <div className="shape-grid palette-create-control">
                {PALETTE.map((tool) => (
                  <button key={tool.type} onClick={() => add(tool.type)}>
                    <b>{tool.glyph}</b>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
              <p className="eyebrow advanced-title palette-create-control">ADVANCED SHAPES</p>
              <div className="shape-grid advanced-grid palette-create-control">
                {ADVANCED_PALETTE.map(tool => <button key={tool.type} onClick={()=>add(tool.type)}><b>{tool.glyph}</b><span>{tool.label}</span></button>)}
              </div>
              <p className="eyebrow advanced-title palette-create-control">CUSTOM SHAPES</p>
              <div className="shape-grid custom-grid palette-create-control">{advancedPresets.map(preset=><button key={preset.id} title={preset.label} onClick={()=>addAdvancedPreset(preset)}><b><svg className="advanced-preset-preview" viewBox={`0 0 ${preset.dimensions.widthMeters} ${preset.dimensions.depthMeters}`}>{preset.editor.layers.filter(layer=>!layer.collisionOnly).map(layer=><Shape key={layer.id} item={layer}/>)}</svg></b><span>{preset.label}</span></button>)}</div>
              {!advancedPresets.length && <p className="handle-help palette-create-control">Save artwork as a custom shape to reuse it here.</p>}
              <button className="group-button manage-custom-button" onClick={()=>setManageCustomOpen(true)}>Manage custom shapes</button>
              <button className="group-button" disabled={!isManager} onClick={()=>{refreshLibrary();setManageGroupsOpen(true);}}>Manage equipment groups</button>
              <p className="eyebrow layer-title">
                LAYERS <span>{items.length}</span>
              </p>
              <div className="studio-layer-tools"><input aria-label="Search layers" placeholder="Search layers" value={currentUi.search||""} onChange={event=>updateCurrentUi({search:event.target.value})}/><select aria-label="Filter layers" value={currentUi.filter||"all"} onChange={event=>updateCurrentUi({filter:event.target.value})}><option value="all">All layers</option><option value="grouped">Grouped</option><option value="locked">Locked</option><option value="hidden">Hidden</option></select></div>
              <p className="handle-help">Folders organise layers. Groups move and transform together.</p>
              <StageLayerList folderName="Equipment folder" assets={[...items].reverse().filter(item=>{const query=(currentUi.search||'').toLowerCase(),filter=currentUi.filter||'all';return (!query||String(item.name||item.type).toLowerCase().includes(query))&&(filter!=='hidden'||item.editorVisible===false)&&(filter!=='locked'||item.editorLocked)&&(filter!=='grouped'||item.editorGroupId)}).map(item=>({...item,visible:item.editorVisible,locked:item.editorLocked}))} folders={itemFolders} selected={selectedGroupId?selectedGroupItems.map(item=>item.id):multiSelectedIds.length?multiSelectedIds:selectedId?[selectedId]:[]} select={(event,item)=>{setVectorNodeIndex(null);selectLayer(event,item)}} onLock={item=>{checkpoint();setItems(old=>old.map(layer=>layer.id===item.id?{...layer,editorLocked:!layer.editorLocked}:layer))}} changeAssets={(ids,changes)=>{checkpoint();setItems(old=>old.map(item=>ids.includes(item.id)?{...item,...changes,...(changes.visible!==undefined?{editorVisible:changes.visible}:{})}:item));setSelectedId(null);setMultiSelectedIds([]);setSelectedGroupId(null)}} changeFolders={next=>{checkpoint();setItemFolders(next);setSelectedId(null);setMultiSelectedIds([]);setSelectedGroupId(null)}} onDrag={id=>{assetDragRef.current=id}} onDrop={(target,folderId)=>{const id=assetDragRef.current;if(id==null)return;checkpoint();const memberIds=Array.isArray(id)?id:multiSelectedIds.includes(id)?multiSelectedIds:items.find(item=>item.id===id)?.editorGroupId?items.filter(item=>item.editorGroupId===items.find(layer=>layer.id===id).editorGroupId).map(item=>item.id):[id];if(folderId)setItemFolders(old=>putZonesInFolder(old,memberIds,folderId));else{const moving=items.filter(item=>memberIds.includes(item.id)),copy=items.filter(item=>!memberIds.includes(item.id)),to=copy.findIndex(item=>item.id===target);if(to>=0){copy.splice(to,0,...moving);setItems(copy)}setItemFolders(old=>removeZonesFromFolders(old,memberIds))}assetDragRef.current=null}}/>
              <div className="palette-create-control"><button className="group-button" disabled={!selectedId && !selectedGroupId && !multiSelectedIds.length} onClick={createRotationPart}>+ Rotation control from selection</button>
              {effectiveRotationParts.length > 0 && <><p className="eyebrow advanced-title">ROTATION CONTROLS</p>{effectiveRotationParts.map(part=><div className="rotation-part-card" key={part.id}>
                <input aria-label="Rotation part name" value={part.name} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,name:event.target.value}:value))}/>
                <div className="field-row"><label className="field">PIVOT X (CM)<CommittedNumberInput type="number" step="1" disabled={part.pivotLockedToTripod} value={part.pivotX} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,pivotX:+event.target.value}:value))}/></label><label className="field">PIVOT Y (CM)<CommittedNumberInput type="number" step="1" disabled={part.pivotLockedToTripod} value={part.pivotY} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,pivotY:+event.target.value}:value))}/></label></div>
                {part.pivotLockedToTripod && <p className="handle-help">Pivot locked to the tripod hub.</p>}
                <div className="field-row"><label className="field">MIN °<CommittedNumberInput type="number" step="1" value={part.minRotation} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,minRotation:wholeDegrees(event.target.value)}:value))}/></label><label className="field">MAX °<CommittedNumberInput type="number" step="1" value={part.maxRotation} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,maxRotation:wholeDegrees(event.target.value)}:value))}/></label></div>
                <button className="delete" onClick={()=>{checkpoint();setRotationParts(old=>old.filter(value=>value.id!==part.id));setItems(old=>old.map(item=>item.rotationPartId===part.id?{...item,rotationPartId:undefined}:item));}}>Remove control</button>
              </div>)}</>}</div>
            </>
          )}
          {documentMode==="item"&&<section className="inspector-rotation-controls">
            <div className="inspector-section-heading"><p className="eyebrow">ROTATION CONTROLS</p><small>{effectiveRotationParts.length}</small></div>
            <button className="group-button" disabled={!selectedId&&!selectedGroupId&&!multiSelectedIds.length} onClick={createRotationPart}>Create from selection</button>
            {!effectiveRotationParts.length&&<p className="handle-help">Select one or more layers, then create a separate rotation control for that part.</p>}
            {effectiveRotationParts.map(part=><div className="rotation-part-card" key={part.id}>
              <input aria-label="Rotation part name" value={part.name} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,name:event.target.value}:value))}/>
              <div className="field-row"><label className="field">PIVOT X (CM)<CommittedNumberInput type="number" step="1" disabled={part.pivotLockedToTripod} value={part.pivotX} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,pivotX:+event.target.value}:value))}/></label><label className="field">PIVOT Y (CM)<CommittedNumberInput type="number" step="1" disabled={part.pivotLockedToTripod} value={part.pivotY} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,pivotY:+event.target.value}:value))}/></label></div>
              {part.pivotLockedToTripod&&<p className="handle-help">Pivot locked to the tripod hub.</p>}
              <div className="field-row"><label className="field">MIN °<CommittedNumberInput type="number" step="1" value={part.minRotation} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,minRotation:+event.target.value}:value))}/></label><label className="field">MAX °<CommittedNumberInput type="number" step="1" value={part.maxRotation} onChange={event=>setRotationParts(old=>old.map(value=>value.id===part.id?{...value,maxRotation:+event.target.value}:value))}/></label></div>
              <button className="delete" onClick={()=>{checkpoint();setRotationParts(old=>old.filter(value=>value.id!==part.id));setItems(old=>old.map(item=>item.rotationPartId===part.id?{...item,rotationPartId:undefined}:item));}}>Remove control</button>
            </div>)}
          </section>}
        </div>{readOnlyStage&&<details className="locked-stage-layers"><summary>Stage layers <small>Locked</small></summary><p>{shapeName}</p>{zones.map(zone=><p key={zone.id}>{zone.name}</p>)}{stageLines.filter(line=>line.type==="curtain").map(line=><p key={line.id}>{line.name||"Curtain"}</p>)}{fixedEquipment.map(item=><p key={item.id}>{item.label} (installed)</p>)}</details>}{embeddedStage&&placement.layers}</aside>
        <div className="panel-resizer" role="separator" aria-label="Resize layers panel" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);setPanelResize({side:"left",startX:event.clientX,startWidth:currentUi.leftWidth||238});}}/>
        <section className="workbench">
          <div className="toolbar">
            <button title="Show or hide layers" onClick={()=>updateCurrentUi({leftOpen:currentUi.leftOpen===false})}>Layers</button>
            <span>
              CANVAS {realWidth} × {realDepth} M · GRID 0.1 M
            </span>
            <button title="Undo" aria-label="Undo" onClick={undo} disabled={!history.length}><ToolbarIcon name="undo" /></button>
            <button title="Redo" aria-label="Redo" onClick={redo} disabled={!future.length}><ToolbarIcon name="redo" /></button>
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
            {documentMode === "stage" && !readOnlyStage && <button className={stageMoveMode?"active-tool":""} aria-pressed={stageMoveMode} title="Move whole stage assets (M)" onClick={()=>{setStageMoveMode(value=>!value);setSelectedStageNode(null);}}>Move (M)</button>}
            {documentMode === "item" && <button disabled={!items.length} onClick={()=>{setPresetName(shapeName);setPresetDialogOpen(true);}}>Save as custom shape</button>}
            <label hidden={readOnlyStage}><input type="checkbox" checked={!canvasResizeEnabled} onChange={(event)=>setCanvasResizeEnabled(!event.target.checked)} /> Lock canvas size</label>
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
            <button title="Show or hide inspector" onClick={()=>updateCurrentUi({rightOpen:currentUi.rightOpen===false})}>Inspector</button>
          </div>
          <div className="creation-toolbar" hidden={readOnlyStage}>
            <span className="creation-label">INSERT</span>
            {documentMode==="stage"?<>
              <button onClick={()=>addStageZone()}>Zone</button>
              <button onClick={()=>addStageZone(true)}>Rectangular zone</button>
              <button onClick={addStageText}>Text</button>
              <button onClick={addStageDimension}>Dimension</button>
              <button onClick={addStageCurtain}>Curtain</button>
              <button onClick={()=>imageFileRef.current?.click()}>Background image</button>
            </>:<>
              <button onClick={()=>add("drawVector")}><b aria-hidden="true">✎</b><span>Draw Vector</span></button>
              <button onClick={()=>add("text")}>Text</button>
              <div className="creation-menu-wrap"><button aria-expanded={createMenu==="shapes"} onClick={()=>setCreateMenu(value=>value==="shapes"?null:"shapes")}>Shape ▾</button>{createMenu==="shapes"&&<div className="creation-popover">{[{type:"rect",label:"Rectangle",glyph:"□"},{type:"circle",label:"Circle",glyph:"○"},{type:"ellipse",label:"Ellipse",glyph:"⬭"},{type:"triangle",label:"Triangle",glyph:"△"},{type:"polygon",label:"Polygon",glyph:"⬠"},{type:"trapezoid",label:"Trapezoid",glyph:"▱"}].map(tool=><button key={tool.type} onClick={()=>{add(tool.type);setCreateMenu(null);}}><b>{tool.glyph}</b><span>{tool.label}</span></button>)}</div>}</div>
              <button onClick={()=>add("line")}>Line</button>
              <button onClick={()=>add("arc")}>Arc</button>
              <button onClick={()=>add("tripod")}>Tripod</button>
              <button onClick={()=>add("collisionVector")}>Collision Shape</button>
              <button onClick={()=>artworkImageFileRef.current?.click()}>Image</button>
              <input ref={artworkImageFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={loadArtworkImage} hidden/>
              <div className="creation-menu-wrap"><button aria-expanded={createMenu==="custom"} onClick={()=>setCreateMenu(value=>value==="custom"?null:"custom")}>Custom Shapes ▾</button>{createMenu==="custom"&&<div className="creation-popover custom">{advancedPresets.length?advancedPresets.map(preset=><button key={preset.id} onClick={()=>{addAdvancedPreset(preset);setCreateMenu(null);}}><svg className="advanced-preset-preview" viewBox={`0 0 ${preset.dimensions.widthMeters} ${preset.dimensions.depthMeters}`}>{preset.editor.layers.filter(layer=>!layer.collisionOnly).map(layer=><Shape key={layer.id} item={layer}/>)}</svg><span>{preset.label}</span></button>):<p>No custom shapes saved yet.</p>}<button onClick={()=>{setCreateMenu(null);setManageCustomOpen(true);}}>Manage custom shapes…</button></div>}</div>
            </>}
          </div>
          <div
            className="viewport"
            ref={viewportRef}

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
                className={`canvas ${grid ? "show-grid" : ""}${stageMoveMode ? " stage-move-mode" : ""}`}
                viewBox={`0 0 ${realWidth} ${realDepth}`}
                preserveAspectRatio="xMidYMid meet"
                onPointerDownCapture={event=>{if(embeddedStage&&event.target.closest?.('.placed-equipment, .equipment-controls'))return;if(readOnlyStage)return;placement.clear();if(vectorDrawing)drawVectorPoint(event);else if(!stageMoveMode)captureStageControl(event);}}
                onDragOver={event=>{if(embeddedStage)event.preventDefault()}} onDrop={placement.drop}
                onPointerMove={
                  (event) => { if(vectorDrawing){setVectorPreview(stagePointer(event,false));return;} if (stageDragRef.current || documentMode === "stage") moveStageNode(event); else pointerMove(event); }
                }
                onPointerUp={() => {
                  dragRef.current = null;
                  handleRef.current = null;
                  rotationDragRef.current = null;setRotationReadout(null);
                  stageDragRef.current = null;
                }}
                onPointerCancel={() => {
                  dragRef.current = null;
                  handleRef.current = null;
                  rotationDragRef.current = null;setRotationReadout(null);
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
                  {zones.filter(zone=>zone.fillMode==="multicolour").map(zone=>{const spacing=Math.max(.05,zone.stripeSpacing||.5);return <pattern key={zone.id} id={`zone-stripes-${zone.id}`} width={spacing*2} height={spacing*2} patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><rect width={spacing} height={spacing*2} fill={zone.fill||"#8eb6d8"}/><rect x={spacing} width={spacing} height={spacing*2} fill={zone.fill2||"#25261f"}/></pattern>})}
                </defs>
                {grid && (
                  <rect
                    width={realWidth}
                    height={realDepth}
                    fill="url(#grid)"
                  />
                )}
                {documentMode === "stage" && stageBoundaryVisible && (
                  <path className={`stage-floor stage-floor-drag${stageBoundaryLocked ? " locked" : ""}`} d={stagePath(stageNodes)} onPointerDown={readOnlyStage||stageBoundaryLocked ? undefined : (event)=>startAssetMove(event,{id:"stage-boundary",nodes:stageNodes,locked:false},"stage")} />
                )}
                {documentMode === "stage" && (
                  <g className="ordered-stage-assets" pointerEvents={readOnlyStage?"none":undefined}>
                    {[...orderedAssets].reverse().filter(asset=>stageAssetVisible(asset,zoneFolders)).map((asset) =>
                      asset.assetType === "image" ? (
                        <svg key={asset.id} className={asset.locked ? "ordered-reference locked" : "ordered-reference"} x={asset.x} y={asset.y} width={asset.width} height={asset.height} viewBox={`${asset.crop?.left || 0} ${asset.crop?.top || 0} ${1 - (asset.crop?.left || 0) - (asset.crop?.right || 0)} ${1 - (asset.crop?.top || 0) - (asset.crop?.bottom || 0)}`} preserveAspectRatio="none" opacity={asset.opacity} overflow="hidden" onPointerDown={asset.locked ? undefined : (event) => startAssetMove(event, asset, "image")}>
                          <image href={asset.dataUrl} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
                        </svg>
                      ) : asset.assetType === "text" ? (
                        <text key={asset.id} x={asset.x} y={asset.y} fill={asset.color} fillOpacity={asset.opacity} fontSize={asset.fontSize} textAnchor="middle" dominantBaseline="middle" className={asset.locked ? "stage-text locked" : "stage-text"} onPointerDown={(event) => startAssetMove(event, asset, "text")}>{asset.text}</text>
                      ) : asset.assetType === "line" && asset.type==="curtain" ? (
                        <g key={asset.id} className="stage-curtain" onPointerDown={asset.locked?undefined:event=>startAssetMove(event,asset,"line")}>
                          <CurtainArtwork curtain={asset}/>
                          {!readOnlyStage&&selectedStageLineId===asset.id&&asset.collisionEnabled!==false&&<line className="curtain-collision-guide" x1={asset.x} y1={asset.y} x2={asset.x+asset.length} y2={asset.y} transform={`rotate(${asset.rotation||0} ${asset.x} ${asset.y})`}/>}
                          {!readOnlyStage&&!asset.locked&&<g className="curtain-controls" transform={`translate(${asset.x} ${asset.y}) rotate(${asset.rotation||0})`}>
                            <line className="curtain-hit" x1="0" y1="0" x2={asset.length} y2="0"/>
                            {selectedStageLineId===asset.id&&["start","end"].map(end=><circle key={end} className="curtain-endpoint" aria-label={`Curtain ${end} endpoint`} cx={end==="start"?0:asset.length} cy="0" r={.06/zoom} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();checkpoint();stageDragRef.current={handle:"curtain-endpoint",end,original:structuredClone(asset)};event.currentTarget.setPointerCapture(event.pointerId);}}/>)}
                          </g>}
                        </g>
                      ) : asset.assetType === "line" ? (
                        <g key={asset.id} className={`stage-dimension${asset.locked?" locked":""}${selectedStageLineId===asset.id?" selected":""}`} transform={`rotate(${asset.rotation||0} ${asset.x} ${asset.y})`} onPointerDown={asset.locked?undefined:event=>startAssetMove(event,asset,"line")}>
                          <line className="dimension-hit" x1={asset.x} y1={asset.y} x2={asset.x+asset.length} y2={asset.y}/>
                          <path d={`M ${asset.x} ${asset.y-.08} V ${asset.y+.08} M ${asset.x} ${asset.y} H ${asset.x+asset.length} M ${asset.x+asset.length} ${asset.y-.08} V ${asset.y+.08}`} fill="none" stroke={asset.color||"#287aa5"} vectorEffect="non-scaling-stroke"/>
                          <text x={asset.x+asset.length/2} y={asset.y-.11} fill={asset.color||"#287aa5"} fontSize=".16" textAnchor="middle">{asset.length.toFixed(2)} m</text>
                          {selectedStageLineId===asset.id&&<circle className="dimension-anchor" cx={asset.x} cy={asset.y} r=".055"/>}
                        </g>
                      ) : (
                        <path pointerEvents={stageMoveMode&&!asset.locked?"all":"none"} className={stageMoveMode?"move-tool-target":undefined} onPointerDown={stageMoveMode&&!asset.locked?(event)=>startAssetMove(event,asset,"zone"):undefined} key={asset.id} d={stagePath(asset.nodes)} fill={asset.fillMode === "multicolour" ? `url(#zone-stripes-${asset.id})` : asset.fill || "#f7f6ef"} fillOpacity={asset.fillOpacity ?? 1} stroke={asset.stroke || "#71851f"} strokeOpacity={asset.strokeOpacity ?? 1} strokeWidth={asset.strokeWidth ?? 2} vectorEffect="non-scaling-stroke" />
                      ),
                    )}
                  </g>
                )}
                {documentMode === "stage" ? (
                  <g className="stage-boundary-editor" style={{display:readOnlyStage||!stageBoundaryVisible&&!selectedZone?"none":undefined}}>
                    {referenceImage && !stageMoveMode && (
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
                        {referenceSelected && !stageMoveMode && (
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
                        {!stageMoveMode && <path className="zone-move-hit" d={stagePath(zone.nodes)} onPointerDown={(event) => startAssetMove(event, zone, "zone")} />}
                        <path
                          d={stagePath(zone.nodes)}
                          fill="none"
                          stroke="none"
                          strokeWidth={zone.solid ? 2 : zone.strokeWidth}
                          vectorEffect="non-scaling-stroke"
                        />
                        {!stageMoveMode && !zone.locked && zone.zoneShape!=="rectangle" && zone.nodes.map((node, index) => {
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
                    {selectedZoneAnchor && <g className="zone-anchor-guide" pointerEvents="none"><circle cx={selectedZoneAnchor.x} cy={selectedZoneAnchor.y} r=".055"/><path d={`M ${selectedZoneAnchor.x-.1} ${selectedZoneAnchor.y} H ${selectedZoneAnchor.x+.1} M ${selectedZoneAnchor.x} ${selectedZoneAnchor.y-.1} V ${selectedZoneAnchor.y+.1}`}/></g>}
                    {!stageMoveMode && !stageBoundaryLocked && stageNodes.map((node, index) => {
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
                    {items.filter(item=>stageAssetVisible({...item,visible:item.editorVisible},itemFolders)).map((item) => (
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
                      .filter((item) => item.collision && !item.collisionOnly)
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
                {canvasResizeEnabled && !stageMoveMode && <><line className="canvas-resize-edge width" x1={realWidth} y1="0" x2={realWidth} y2={realDepth} onPointerDown={(event) => startCanvasResize(event, "width")} /><line className="canvas-resize-edge depth" x1="0" y1={realDepth} x2={realWidth} y2={realDepth} onPointerDown={(event) => startCanvasResize(event, "depth")} /></>}
                <g className="stage-control-overlay">{activeStageControls.map(([kind,point])=><g key={kind}>
                  <circle className="stage-control-hit" cx={point.x} cy={point.y} r=".7%" onPointerDown={event=>startStageNodeDrag(event,selectedStageNode,kind,selectedZoneId)} />
                  <circle className={['smooth','pointArc','midpoint'].includes(kind)?'curve-control':'bezier-control'} cx={point.x} cy={point.y} r=".7%" pointerEvents="none" />
                </g>)}</g>
                {vectorDrawing && <g className="vector-drawing-overlay">
                  <rect width={realWidth} height={realDepth} fill="transparent" />
                  {drawnVector && vectorPreview && <path className="vector-drawing-preview" d={`M ${drawnVector.x+drawnVector.nodes.at(-1).x} ${drawnVector.y+drawnVector.nodes.at(-1).y} L ${vectorPreview.x} ${vectorPreview.y}`} />}
                  {drawnVector?.nodes.map((node,index)=><circle key={index} cx={drawnVector.x+node.x} cy={drawnVector.y+node.y} r=".012" fill={index===0 ? "#d6ff46" : index===drawnVector.nodes.length-1 ? "#ffbf3f" : "white"} stroke="#35400f" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
                </g>}
              {embeddedStage&&<>{readOnlyStage&&<g pointerEvents="none"><FixedEquipmentArtwork items={fixedEquipment}/></g>}{placement.svg}</>}</svg>
              <div className="axis x">{documentMode === "stage" ? `${realWidth.toFixed(2)} m` : `${Math.round(realWidth * 100)} cm`}</div>
              <div className="axis y">{documentMode === "stage" ? `${realDepth.toFixed(2)} m` : `${Math.round(realDepth * 100)} cm`}</div>
            </div>
            <p className="canvas-help">
              {vectorDrawing ? "Click to add points · Click the first point to close · Click the last point or Esc to finish" : stageMoveMode ? "Move tool · Drag whole stage assets · Alt-drag to duplicate · Esc to return to Edit" : <>Scroll to zoom · Middle-drag to pan · Left-drag empty space to select · {documentMode === "stage" && !readOnlyStage && "M for Move tool · "}Dimensions are {documentMode === "stage" ? "metres" : "centimetres"}</>}
            </p>
            {marquee && <div className="selection-marquee" style={{left:marquee.x,top:marquee.y,width:marquee.right-marquee.x,height:marquee.bottom-marquee.y}} />}
            {rotationReadout&&<div className="rotation-readout" style={{left:rotationReadout.x,top:rotationReadout.y}}>{rotationReadout.degrees}°</div>}
          </div>
        </section>
        <div className="panel-resizer" role="separator" aria-label="Resize inspector" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);setPanelResize({side:"right",startX:event.clientX,startWidth:currentUi.rightWidth||250});}}/>
        <aside className={`inspector${currentUi.rightOpen===false?" panel-collapsed":""}`}>{embeddedStage&&placement.notesPanel}{stockMode&&!readOnlyStage?<StockInspector value={availableEquipment} groups={embeddedStage?.groups||[]} library={embeddedStage?.equipment||[]} onChange={next=>{checkpoint();setAvailableEquipment(next)}}/>:embeddedStage&&placement.selected?placement.inspector:null}<div hidden={Boolean(embeddedStage&&(readOnlyStage||placement.selected||stockMode))}>
          <p className="eyebrow">INSPECTOR</p>
          {documentMode === "stage" ? (
            <>
              <p className="inspector-context">
                {stageNode
                  ? `Boundary node ${selectedStageNode + 1}`
                  : selectedZone ? selectedZone.name || "Selected zone" : selectedText ? selectedText.name || "Selected text" : selectedStageLine ? selectedStageLine.name || "Selected dimension" : referenceSelected ? referenceImage.name || "Background image" : selectedStageAssetIds.length > 1 ? `${selectedStageAssetIds.length} stage assets selected` : selectedStageAssetIds.includes("stage-boundary") ? "Main stage selected" : "Stage and boundary settings"}
              </p>
              {selectedStageAssets.length>1 && !selectedStageGroup.length && <button className="group-button" onClick={groupStageAssets}>Group selected stage assets</button>}
              {selectedStageGroup.length>0 && <section className="zone-group-settings"><h3>Stage group - {selectedStageGroup.length} assets</h3><label className="field">GROUP NAME<input value={selectedStageGroup[0].editorGroupName || ''} onChange={event=>updateStageGroup({editorGroupName:event.target.value})}/></label><label className="collision-toggle"><input type="checkbox" checked={selectedStageGroup[0].editorGroupToggleable===true} onChange={event=>updateStageGroup({editorGroupToggleable:event.target.checked})}/><span><b>Toggleable in Stageplot</b><small>One toggle controls grouped zones and text. Studio-only dimensions and background images remain grouped while editing.</small></span></label><button className="ungroup" onClick={()=>updateStageGroup({editorGroupId:undefined,editorGroupName:undefined,editorGroupToggleable:undefined})}>Ungroup stage assets</button></section>}
              {!hasStageInspectorSelection && <>
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
              </>}
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
                  {selectedZone.zoneShape==="rectangle" && <>
                    <div className="field-row">
                      <label className="field">WIDTH (M)<CommittedNumberInput type="number" min="0.01" step="0.01" value={+selectedZoneBounds.width.toFixed(3)} onChange={event=>{checkpoint();setZones(old=>old.map(zone=>zone.id===selectedZoneId?resizeRectangularZone(zone,+event.target.value,selectedZoneBounds.height):zone));}}/></label>
                      <label className="field">LENGTH (M)<CommittedNumberInput type="number" min="0.01" step="0.01" value={+selectedZoneBounds.height.toFixed(3)} onChange={event=>{checkpoint();setZones(old=>old.map(zone=>zone.id===selectedZoneId?resizeRectangularZone(zone,selectedZoneBounds.width,+event.target.value):zone));}}/></label>
                    </div>
                    <button className="group-button" onClick={()=>{checkpoint();updateSelectedZone({zoneShape:undefined});setSelectedStageNode(null);}}>Convert to normal zone</button>
                  </>}
                  <label className="field">{selectedZone.zoneShape==="rectangle"?"ORIGIN":"POSITION ANCHOR"}<select value={selectedZone.anchorMode||"topLeft"} onChange={event=>updateSelectedZone({anchorMode:event.target.value})}><option value="topLeft">Top-left extremity</option><option value="centre">Bounds centre</option></select></label>
                  <div className="field-row">
                    <label className="field">{selectedZone.zoneShape==="rectangle"?"ORIGIN X (M)":"ANCHOR X (M)"}<CommittedNumberInput type="number" step="0.01" value={+selectedZoneAnchor.x.toFixed(3)} onChange={event=>updateSelectedZoneAnchor("x",+event.target.value)}/></label>
                    <label className="field">{selectedZone.zoneShape==="rectangle"?"ORIGIN Y (M)":"ANCHOR Y (M)"}<CommittedNumberInput type="number" step="0.01" value={+selectedZoneAnchor.y.toFixed(3)} onChange={event=>updateSelectedZoneAnchor("y",+event.target.value)}/></label>
                  </div>
                  <div className="zone-dimensions"><span>Bounds width <b>{selectedZoneBounds.width.toFixed(3)} m</b></span><span>Bounds depth <b>{selectedZoneBounds.height.toFixed(3)} m</b></span></div>
                  <p className="handle-help">Coordinates use the selected anchor. Changing X or Y translates the complete zone without changing its geometry.</p>
                  <label className="field">ZONE TYPE<select value={selectedZone.label ? "label" : selectedZone.solid ? "solid" : "aesthetic"} onChange={(e) => updateSelectedZone({ solid: e.target.value === "solid", label: e.target.value === "label" })}><option value="aesthetic">Aesthetic</option><option value="solid">Solid (collision)</option><option value="label">Label (outside stage)</option></select></label>
                  <label className="collision-toggle"><input type="checkbox" checked={selectedZone.toggleable===true} onChange={event=>updateSelectedZone({toggleable:event.target.checked})}/><span><b>Toggleable in Stageplot</b><small>Adds a per-project show/hide control for this stage part.</small></span></label>
                  <label className="field">COLOUR MODE<select value={selectedZone.fillMode||"single"} onChange={event=>updateSelectedZone({fillMode:event.target.value})}><option value="single">Single colour</option><option value="multicolour">Multicoloured</option></select></label>
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
                        {selectedZone.fillMode === "multicolour" && <label className="field">
                          SECOND COLOUR
                          <ColourPicker value={selectedZone.fill2||"#25261f"} onChange={(e)=>updateSelectedZone({fill2:e.target.value})}/>
                        </label>}
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
                      {selectedZone.fillMode === "multicolour" && <label className="field">STRIPE WIDTH <span>{(selectedZone.stripeSpacing||.5).toFixed(2)}m</span><input type="range" min=".05" max="2" step=".05" value={selectedZone.stripeSpacing||.5} onChange={event=>updateSelectedZone({stripeSpacing:+event.target.value})}/></label>}
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
                      checkpoint();
                      setZones((old) =>
                        old.filter((zone) => zone.id !== selectedZoneId),
                      );
                      setZoneFolders(old=>removeZonesFromFolders(old,[selectedZoneId]));
                      setSelectedStageAssetIds(old=>old.filter(id=>id!==selectedZoneId));
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
                  <label className="collision-toggle"><input type="checkbox" checked={selectedText.toggleable===true} onChange={event=>setTextItems(old=>old.map(item=>item.id===selectedText.id?{...item,toggleable:event.target.checked}:item))}/><span><b>Toggleable in Stageplot</b><small>Adds a per-project show/hide control for this stage part.</small></span></label>
                  <label className="field">TEXT<input value={selectedText.text} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, text: e.target.value } : item))} /></label>
                  <label className="field">SIZE ({documentMode === "stage" ? "M" : "CM"})<CommittedNumberInput type="number" min="0.05" step="0.05" value={selectedText.fontSize} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, fontSize: Math.max(.05, +e.target.value) } : item))} /></label>
                  <label className="field">COLOUR<ColourPicker value={selectedText.color} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, color: e.target.value } : item))} /></label>
                  <label className="field">TRANSPARENCY <span>{Math.round((1 - selectedText.opacity) * 100)}%</span><input type="range" min="0" max="1" step=".05" value={1 - selectedText.opacity} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, opacity: 1 - +e.target.value } : item))} /></label>
                  <button className="delete" onClick={() => { setTextItems((old) => old.filter((item) => item.id !== selectedText.id)); setSelectedTextId(null); }}>Delete text</button>
                </>
              )}
              {selectedStageLine&&<>
                <p className="eyebrow advanced-title">{selectedStageLine.type==="curtain"?"CURTAIN":"DIMENSION LINE"}</p>
                <label className="field">NAME<input value={selectedStageLine.name} onChange={event=>setStageLines(old=>old.map(item=>item.id===selectedStageLine.id?{...item,name:event.target.value}:item))}/></label>
                <div className="field-row">
                  <label className="field">ANCHOR X (M)<CommittedNumberInput type="number" step=".01" value={selectedStageLine.x} onChange={event=>setStageLines(old=>old.map(item=>item.id===selectedStageLine.id?{...item,x:+event.target.value}:item))}/></label>
                  <label className="field">ANCHOR Y (M)<CommittedNumberInput type="number" step=".01" value={selectedStageLine.y} onChange={event=>setStageLines(old=>old.map(item=>item.id===selectedStageLine.id?{...item,y:+event.target.value}:item))}/></label>
                </div>
                <label className="field">LINE LENGTH (M)<CommittedNumberInput aria-label="Line length (m)" type="number" min=".01" max="1000" step=".01" value={selectedStageLine.length} onChange={event=>setStageLines(old=>old.map(item=>item.id===selectedStageLine.id?{...item,length:Math.min(1000,Math.max(.01,+event.target.value))}:item))}/></label>
                <label className="field">ROTATION <span>{selectedStageLine.rotation||0}°</span><input type="range" min="-180" max="180" step="1" value={selectedStageLine.rotation||0} onChange={event=>setStageLines(old=>old.map(item=>item.id===selectedStageLine.id?{...item,rotation:wholeDegrees(event.target.value)}:item))}/></label>
                <label className="field">ROTATION (DEGREES)<CommittedNumberInput type="number" min="-180" max="180" step="1" value={selectedStageLine.rotation||0} onChange={event=>setStageLines(old=>old.map(item=>item.id===selectedStageLine.id?{...item,rotation:wholeDegrees(event.target.value)}:item))}/></label>
                <p className="handle-help">The anchor is the line origin. Position changes move the whole line; length extends from the anchor and rotation pivots around it.</p>
                {selectedStageLine.type==="curtain"&&<>
                  <label className="canvas-checkbox"><input aria-label="Curtain collision" type="checkbox" checked={selectedStageLine.collisionEnabled!==false} onChange={event=>{checkpoint();setStageLines(old=>old.map(line=>line.id===selectedStageLine.id?{...line,collisionEnabled:event.target.checked}:line))}}/>Curtain collision</label>
                  <label className="field">COLOUR<input aria-label="Curtain colour" type="color" value={selectedStageLine.color} onChange={event=>setStageLines(old=>old.map(line=>line.id===selectedStageLine.id?{...line,color:event.target.value}:line))}/></label>
                  <label className="field">THICKNESS <span>{Math.round(selectedStageLine.thickness*1000)} mm</span><input aria-label="Curtain thickness (mm)" type="range" min="1" max="200" step="1" value={Math.round(selectedStageLine.thickness*1000)} onChange={event=>setStageLines(old=>old.map(line=>line.id===selectedStageLine.id?{...line,thickness:Math.max(1,Math.min(200,Math.round(+event.target.value)))/1000}:line))}/></label>
                  <label className="field">OPACITY <span>{Math.round(selectedStageLine.opacity*100)}%</span><input aria-label="Curtain opacity" type="range" min="0" max="1" step=".01" value={selectedStageLine.opacity} onChange={event=>setStageLines(old=>old.map(line=>line.id===selectedStageLine.id?{...line,opacity:+event.target.value}:line))}/></label>
                  <p className="handle-help">Drag either endpoint to change the line. Folds stay 10 cm peak to trough, repeating every 40 cm. When collision is enabled, the dotted centre line shows its boundary.</p>
                </>}
                <button className="delete" onClick={()=>{setStageLines(old=>old.filter(item=>item.id!==selectedStageLine.id));setSelectedStageLineId(null);setSelectedStageAssetIds([]);}}>Delete {selectedStageLine.type==="curtain"?"curtain":"dimension line"}</button>
              </>}
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
              
              {!hasStageInspectorSelection && <><div className="canvas-summary">
                <b>{stageNodes.length}</b>
                <span>boundary nodes</span>
                <b>{sampleStageBoundary(stageNodes).length}</b>
                <span>collision samples</span>
              </div>
              <p className="footprint-help">
                The green path is the exact visual boundary. Curves are sampled
                into collision points when the stage is saved.
              </p>
              </>}
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
              <label>Group name<input value={selectedGroupItems[0]?.editorGroupName || ""} onChange={event=>{checkpoint();setItems(old=>old.map(item=>item.editorGroupId===selectedGroupId?{...item,editorGroupName:event.target.value}:item));}} /></label>
              <label className="collision-toggle"><input type="checkbox" checked={selectedGroupItems[0]?.editorGroupToggleable===true} onChange={event=>{checkpoint();setItems(old=>old.map(item=>item.editorGroupId===selectedGroupId?{...item,editorGroupToggleable:event.target.checked}:item));}} /><span><b>Toggleable in Stageplot</b><small>Show or hide all artwork in this group with one named toggle.</small></span></label>
              <div className="align-actions"><button onClick={()=>alignItemSelection("x","start")}>Left</button><button onClick={()=>alignItemSelection("x","center")}>Centre</button><button onClick={()=>alignItemSelection("x","end")}>Right</button><button onClick={()=>alignItemSelection("y","start")}>Top</button><button onClick={()=>alignItemSelection("y","center")}>Middle</button><button onClick={()=>alignItemSelection("y","end")}>Bottom</button><button onClick={()=>distributeItemSelection("x")}>Space X</button><button onClick={()=>distributeItemSelection("y")}>Space Y</button></div>
              <MultiCollisionControl layers={selectedGroupItems} onChange={value=>{checkpoint();const ids=new Set(selectedGroupItems.map(item=>item.id));setItems(old=>old.map(item=>ids.has(item.id)?{...item,collision:item.collisionOnly?true:value}:item));}} />
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
              <button className="group-button" onClick={mergeSelected}>Merge overlapping layers</button>
              <div className="align-actions"><button onClick={()=>alignItemSelection("x","start")}>Left</button><button onClick={()=>alignItemSelection("x","center")}>Centre</button><button onClick={()=>alignItemSelection("x","end")}>Right</button><button onClick={()=>alignItemSelection("y","start")}>Top</button><button onClick={()=>alignItemSelection("y","center")}>Middle</button><button onClick={()=>alignItemSelection("y","end")}>Bottom</button><button onClick={()=>distributeItemSelection("x")}>Space X</button><button onClick={()=>distributeItemSelection("y")}>Space Y</button></div>
              <button className="group-button" onClick={()=>cutSelected(false)}>Cut upper layer from lower layer</button>
              <button className="group-button" onClick={()=>cutSelected(true)}>Cut and retain upper layer</button>
              <MultiCollisionControl layers={items.filter(item=>multiSelectedIds.includes(item.id))} onChange={value=>{checkpoint();const ids=new Set(multiSelectedIds);setItems(old=>old.map(item=>ids.has(item.id)?{...item,collision:item.collisionOnly?true:value}:item));}} />
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
              {isManager&&<button className="add-group" onClick={addGroup}>
                + Create group
              </button>}
              <label className="collision-toggle">
                <input type="checkbox" checked={cornerSnapping} onChange={(event)=>{checkpoint();setCornerSnapping(event.target.checked);}} />
                <span><b>Corner snapping in Stageplot</b><small>Adds snap points to all four item-canvas corners. Off by default.</small></span>
              </label>
              <div className="canvas-summary">
                <b>{items.length}</b>
                <span>artwork layers</span>
                <b>{items.filter((item) => item.collision).length}</b>
                <span>collision layers</span>
              </div>
              <p className="footprint-help">
                Changing the canvas dimensions changes its physical boundary and
                aspect ratio. Existing layer coordinates and sizes remain
                unchanged.
              </p>
              <ComponentsEditor value={components} onChange={next=>{checkpoint();setComponents(next)}}/>
            </>
          ) : (
            <>
              <p className="inspector-context">{selected.collisionOnly ? "Collision-only vector layer" : selected.type === "compound" ? "Custom shape · artwork is not editable" : "Selected vector layer"}</p>
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
                <div className="field-row text-format-options"><label><input type="checkbox" checked={selected.bold} onChange={event=>update({bold:event.target.checked})}/> Bold</label><label><input type="checkbox" checked={selected.italic} onChange={event=>update({italic:event.target.checked})}/> Italic</label></div>
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
              {selected.type==='image'&&<><div className="field-row">{['left','right','top','bottom'].map(side=>{const crop=normaliseCrop(selected.crop),opposite={left:'right',right:'left',top:'bottom',bottom:'top'}[side],max=Math.min(95,Math.round((.99-crop[opposite])*100));return <label className="field" key={side}>CROP {side.toUpperCase()} (%)<LiveNumberInput aria-label={`Crop ${side} (%)`} min={0} max={max} step="1" value={Math.round(crop[side]*100)} onChange={percent=>update({crop:normaliseCrop({...crop,[side]:Math.min(max,percent)/100})})}/></label>})}</div><label className="field">IMAGE OPACITY<input type="range" min="0" max="1" step=".01" value={selected.opacity??1} onChange={event=>update({opacity:Number(event.target.value)})}/></label></>}
              {!['vector','image'].includes(selected.type)&&<button className="group-button" onClick={()=>{update(convertToVector(selected));setVectorNodeIndex(null);}}>Convert to editable vector</button>}
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
                  step="1"
                  value={selected.rotation}
                  onChange={(e) => update({ rotation: +e.target.value })}
                />
                <button type="button" className="field-reset" disabled={!selected.rotation} onClick={()=>update({rotation:0})}>Reset rotation</button>
              </label>
              {selected.type !== "compound" && selected.type !== "text" && selected.type !== "image" && !selected.collisionOnly && <>
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
              {selected.collisionOnly ? <div className="collision-toggle"><span><b>Collision shape</b><small>This editable layer always contributes collision geometry and is hidden from library and Stageplot artwork.</small></span></div> : <label className="collision-toggle">
                <input type="checkbox" checked={selected.toggleable ?? false} onChange={(e)=>update({toggleable:e.target.checked})} />
                <span><b>Toggleable in Stageplot</b><small>Adds a per-placement show/hide control for this item part.</small></span>
              </label>}
              <div className="layer-actions">
                <button onClick={() => reorder(-1)}>Send back</button>
                <button onClick={() => reorder(1)}>Bring forward</button>
              </div>
              <button className="delete" onClick={remove}>
                Delete layer
              </button>
            </>
          )}
        </div></aside>
      </main>
      {embeddedStage&&placement.libraryPanel}
      {embeddedStage&&placement.report}
      {equipmentSaveOpen&&embeddedEquipment&&<EquipmentSaveDialog equipment={embeddedEquipment.data} organisations={embeddedEquipment.organisations||[]} review={embeddedEquipment.review} busy={shapeSaving} error={saveError} onSave={saveEmbeddedEquipment} onClose={()=>setEquipmentSaveOpen(false)}/>} 
      {recovery?.projectSnapshot&&recovery.projectSnapshot!==recovery.savedProject&&<section className="canvas-recovery" role="status"><b>Unsaved local work is available.</b><p>The saved version has loaded. Restore your previous work to continue editing.</p><button onClick={()=>{checkpoint();if(readOnlyStage){setLayoutEquipment(recovery.layoutEquipment||[]);setEquipmentFolders(recovery.equipmentFolders||[]);setLayoutNotes(recovery.layoutNotes||'')}else restoreSnapshot(recovery);setRecovery(null)}}>Restore local work</button><button onClick={()=>setRecovery(null)}>Dismiss</button></section>}
      {saveError&&!embeddedEquipment&&<p className="canvas-save-error" role="alert">{saveError} <button onClick={()=>saveToLibrary()}>Retry save</button></p>}
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
            <button className="group-button" autoFocus disabled={shapeSaving} onClick={()=>persistEquipment({...saveChoice.data,id:saveChoice.target.id,revision:saveChoice.target.revision,profiles:assetProfiles(saveChoice.target),stockQuantity:saveChoice.target.stockQuantity ?? null},saveChoice.snapshot)}>Update existing item</button>
            <button className="group-button" disabled={shapeSaving} onClick={()=>persistEquipment({...saveChoice.data,id:saveChoice.newId,profiles:[],stockQuantity:null},saveChoice.snapshot)}>Save as new item</button>
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
          <div className="preset-modal-body"><p className="handle-help">What would you like to create?</p><button className="group-button" autoFocus onClick={()=>newItem("item")}>Equipment item</button>{!equipmentOnly&&<button className="group-button" onClick={()=>newItem("stage")}>Stage</button>}</div>
        </section>
      </div>}
      {manageStageplotOpen&&<LibraryManagement {...{libraryError,copyManagedStageLink,draftStatus,editLibraryStage,editManagedItem,editable,editingItemNameId,editingStageNameId,equipmentItems,equipmentOnly,flash,groups,isManager,itemNameDraft,manageStage,managedEquipmentSections,managedItemSearch,managedTab,matchingManagedItems,matchingManagedStages,pendingUpdates,projectSnapshot,removeStageplotItem,removingStageplotId,reviewSubmissions,savedProject,setEditingItemNameId,setEditingStageNameId,setItemNameDraft,setManageStageplotOpen,setManagedItemSearch,setManagedTab,setNewItemOpen,setReviewIds,setStageNameDraft,setSubmissionFeedback,stageLibrary,stageNameDraft,submitAsset,updateManagedItem,user}}/>}
      {submissionSaveOpen&&<AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Save submission changes"><header><h2>Save submission changes</h2><button disabled={shapeSaving} onClick={()=>setSubmissionSaveOpen(false)}>Close</button></header><p>Updating without approval saves your edits back to the creator's personal copy and keeps the submission pending. The shared library item stays unchanged.</p><label>Message to creator<textarea rows="3" maxLength={2000} value={reviewerMessage} onChange={event=>setReviewerMessage(event.target.value)} placeholder="Explain what you changed or what still needs fixing"/></label>{['new','update','approve'].map(action=><button key={action} disabled={shapeSaving} onClick={async()=>{setShapeSaving(true);try{const result=await accountRequest('/submissions/'+editingSubmission.id+'/edit','POST',{action,note:reviewerMessage,data:{...(documentMode==='stage'?stageData:await prepareEquipmentImages(itemData)),profiles:editingSubmission.snapshot.profiles},submittedAt:editingSubmission.created,snapshotRevision:editingSubmission.snapshot.revision});await refreshLibrary();savedProject.current=projectSnapshot;if(action==='update')setEditingSubmission(result);else{setEditingSubmission(null);setActiveLibraryId(result.id)}setSubmissionSaveOpen(false);flash(action==='approve'?'Changes approved':action==='update'?'Personal copy and submission updated; awaiting approval':'New library item saved')}catch(error){flash(error.message)}finally{setShapeSaving(false)}}}>{action==='new'?'Save new item':action==='update'?'Update submitted item (without approving)':'Approve changes'}</button>)}</section></AccountModal>}
      {submissionFeedback&&<AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Submission feedback"><header><h2>{submissionFeedback.name} - {submissionFeedback.label}</h2><button onClick={()=>setSubmissionFeedback(null)}>Close</button></header><p className="submission-feedback">{submissionFeedback.note || 'No reviewer message yet.'}</p></section></AccountModal>}
      {reviewIds&&<SubmissionReview key={reviewIds.join(',')} submissions={submissions.filter(s=>reviewIds.includes(s.id)&&s.status==='pending')} targets={(submissions.find(s=>reviewIds.includes(s.id))?.kind==='items'?library:stageLibrary).filter(a=>!a.ownerId)} renderDesign={(kind,data)=><svg className="submission-artwork" role="img" aria-label={data.label+" design"} viewBox={"0 0 "+data.dimensions.widthMeters+" "+data.dimensions.depthMeters}>{kind==='stages'?<path d={stagePath(data.boundary.nodes)} fill="#e9f5bc" stroke="#71851f" strokeWidth="2" vectorEffect="non-scaling-stroke"/>:(data.shapes || []).map((shape,index)=><Shape key={shape.id || index} item={shape}/>)}</svg>} onChanged={refreshLibrary} onClose={()=>setReviewIds(null)} onPreview={async (kind,data,submission)=>{if(projectSnapshot!==savedProject.current&&!(await appConfirm("Discard unsaved changes and preview this submission?")))return;if(kind==="items")editLibraryItem(data,true);else editLibraryStage(data,true);setShapeName(data.label);setEditingSubmission(submission);setManageStageplotOpen(false);setReviewIds(null);}}/>}
      {manageGroupsOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !groupsSaving)setManageGroupsOpen(false);}}>
        <section className="library-modal equipment-management-modal" role="dialog" aria-modal="true" aria-label="Manage equipment groups">
          <div className="modal-header"><h2>Manage equipment groups</h2><button disabled={groupsSaving} onClick={()=>setManageGroupsOpen(false)} aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>
          <div className="preset-modal-body custom-shape-list"><p className="handle-help">Renaming a group updates its name for every item in that group. Counts show published Stageplot items and unpublished saved designs separately. Only groups with neither can be deleted.</p>
            <label className="management-search">Search equipment groups<input type="search" placeholder="Search groups" value={managedGroupSearch} onChange={event=>setManagedGroupSearch(event.target.value)}/></label>
            {matchingManagedGroups.length ? matchingManagedGroups.map(group=>{const members=equipmentItems.filter(item=>item.groupId===group.id);const count=members.length;const publishedCount=members.filter(item=>!item.ownerId && isPublishedItem(item)).length;const savedCount=count-publishedCount;return <div className="equipment-group-row" key={group.id}>
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
      {helpOpen&&(embeddedStage?<EventHelp onClose={()=>setHelpOpen(false)}/>:embeddedEquipment?<EquipmentHelp onClose={()=>setHelpOpen(false)}/>:<StudioHelp equipmentOnly={equipmentOnly} onClose={()=>setHelpOpen(false)}/>)}
    </div>
    </MeasurementUnit.Provider>
  );
}

export default DesignEditor;
