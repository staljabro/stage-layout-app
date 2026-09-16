import { useEffect, useMemo, useRef, useState } from "react";

const LIBRARY_API = "http://127.0.0.1:8787/api/items";
const STAGES_API = "http://127.0.0.1:8787/api/stages";
const GROUPS_API = "http://127.0.0.1:8787/api/groups";

const PALETTE = [
  { type: "rect", label: "Rectangle", glyph: "□" },
  { type: "roundRect", label: "Rounded", glyph: "▢" },
  { type: "circle", label: "Circle", glyph: "○" },
  { type: "ellipse", label: "Ellipse", glyph: "⬭" },
  { type: "triangle", label: "Triangle", glyph: "△" },
  { type: "line", label: "Line", glyph: "╱" },
  { type: "arc", label: "Arc", glyph: "⌒" },
  { type: "tripod", label: "Tripod base", glyph: "Y" },
  { type: "hexagon", label: "Hexagon", glyph: "⬡" },
];

const ADVANCED_PALETTE = [
  { type: "trapezoid", label: "Trapezoid", glyph: "▱" },
  { type: "polygon", label: "Polygon", glyph: "⬠" },
  { type: "chair", label: "Orchestra chair", glyph: "♬" },
  { type: "seatedPerson", label: "Seated person", glyph: "◉" },
  { type: "standingPerson", label: "Standing person", glyph: "♟" },
];

const DEFAULTS = {
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

const segmentMode = (node) =>
  node.curveMode || (node.curve ? "smooth" : "line");
const segmentMidpoint = (from, to) => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2,
});
const smoothControl = (from, to) => {
  if (Number.isFinite(to.bulge)) {
    const midpoint = segmentMidpoint(from, to);
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return {
      x: midpoint.x - ((to.y - from.y) / length) * to.bulge,
      y: midpoint.y + ((to.x - from.x) / length) * to.bulge,
    };
  }
  return { x: to.cx ?? (from.x + to.x) / 2, y: to.cy ?? (from.y + to.y) / 2 };
};
const pointOnArc = (from, to) => ({
  x: to.arcX ?? (from.x + to.x) / 2,
  y: to.arcY ?? (from.y + to.y) / 2,
});
const pointArcControl = (from, to) => {
  const point = pointOnArc(from, to);
  return {
    x: point.x * 2 - (from.x + to.x) / 2,
    y: point.y * 2 - (from.y + to.y) / 2,
  };
};
const bezierGeometry = (from, to) => {
  const midpoint = {
    x: to.mx ?? (from.x + to.x) / 2,
    y: to.my ?? (from.y + to.y) / 2,
  };
  return {
    midpoint,
    startOut: {
      x: to.startOutX ?? (from.x * 2 + midpoint.x) / 3,
      y: to.startOutY ?? (from.y * 2 + midpoint.y) / 3,
    },
    midIn: {
      x: to.midInX ?? (from.x + midpoint.x * 2) / 3,
      y: to.midInY ?? (from.y + midpoint.y * 2) / 3,
    },
    midOut: {
      x: to.midOutX ?? (midpoint.x * 2 + to.x) / 3,
      y: to.midOutY ?? (midpoint.y * 2 + to.y) / 3,
    },
    endIn: {
      x: to.endInX ?? (midpoint.x + to.x * 2) / 3,
      y: to.endInY ?? (midpoint.y + to.y * 2) / 3,
    },
  };
};
const stageSegmentPath = (from, to) => {
  if (segmentMode(to) === "pointArc") {
    const control = pointArcControl(from, to);
    return `Q ${control.x} ${control.y} ${to.x} ${to.y}`;
  }
  if (segmentMode(to) === "smooth") {
    const control = smoothControl(from, to);
    return `Q ${control.x} ${control.y} ${to.x} ${to.y}`;
  }
  if (segmentMode(to) === "bezier") {
    const geometry = bezierGeometry(from, to);
    return `C ${geometry.startOut.x} ${geometry.startOut.y} ${geometry.midIn.x} ${geometry.midIn.y} ${geometry.midpoint.x} ${geometry.midpoint.y} C ${geometry.midOut.x} ${geometry.midOut.y} ${geometry.endIn.x} ${geometry.endIn.y} ${to.x} ${to.y}`;
  }
  return `L ${to.x} ${to.y}`;
};
const stagePath = (nodes) =>
  nodes.length < 3
    ? ""
    : `M ${nodes[0].x} ${nodes[0].y} ${nodes
        .slice(1)
        .map((node, index) => stageSegmentPath(nodes[index], node))
        .join(" ")} ${stageSegmentPath(nodes.at(-1), nodes[0])} Z`;

const sampleStageBoundary = (nodes, samples = 16) =>
  nodes.flatMap((node, index) => {
    const previous = nodes[(index - 1 + nodes.length) % nodes.length];
    if (segmentMode(node) === "line") return [{ x: node.x, y: node.y }];
    const quadratic =
      segmentMode(node) === "pointArc"
        ? pointArcControl(previous, node)
        : smoothControl(previous, node);
    const bezier = bezierGeometry(previous, node);
    const cubicPoint = (a, b, c, d, t) => {
      const u = 1 - t;
      return {
        x:
          u ** 3 * a.x +
          3 * u ** 2 * t * b.x +
          3 * u * t ** 2 * c.x +
          t ** 3 * d.x,
        y:
          u ** 3 * a.y +
          3 * u ** 2 * t * b.y +
          3 * u * t ** 2 * c.y +
          t ** 3 * d.y,
      };
    };
    return Array.from({ length: samples }, (_, sample) => {
      const t = (sample + 1) / samples;
      const inverse = 1 - t;
      if (segmentMode(node) === "smooth" || segmentMode(node) === "pointArc")
        return {
          x:
            inverse * inverse * previous.x +
            2 * inverse * t * quadratic.x +
            t * t * node.x,
          y:
            inverse * inverse * previous.y +
            2 * inverse * t * quadratic.y +
            t * t * node.y,
        };
      return t <= 0.5
        ? cubicPoint(
            previous,
            bezier.startOut,
            bezier.midIn,
            bezier.midpoint,
            t * 2,
          )
        : cubicPoint(
            bezier.midpoint,
            bezier.midOut,
            bezier.endIn,
            node,
            (t - 0.5) * 2,
          );
    });
  });

function Shape({
  item,
  selected,
  onPointerDown,
  onHandlePointerDown,
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
  if (item.type === "circle" || item.type === "ellipse")
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
      className={`shape-layer ${collisionGuide ? "collision-guide" : ""}`}
    >
      {content}
      {selected && (
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
          <path
            d={`M ${item.startX} ${item.startY} L ${item.controlX} ${item.controlY} L ${item.endX} ${item.endY}`}
          />
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
            cx={item.controlX}
            cy={item.controlY}
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
  if (item.type === "circle" || item.type === "ellipse")
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
  };
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
  const [documentMode, setDocumentMode] = useState("item");
  const [shapeName, setShapeName] = useState("Untitled Item");
  const [realWidth, setRealWidth] = useState(1);
  const [realDepth, setRealDepth] = useState(1);
  const [groupId, setGroupId] = useState("");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [history, setHistory] = useState([]);
  const [snapMode, setSnapMode] = useState("standard");
  const [grid, setGrid] = useState(true);
  const [toast, setToast] = useState("");
  const [library, setLibrary] = useState([]);
  const [stageLibrary, setStageLibrary] = useState([]);
  const [stageNodes, setStageNodes] = useState(() => defaultStageNodes(1, 1));
  const [selectedStageNode, setSelectedStageNode] = useState(null);
  const [referenceImages, setReferenceImages] = useState([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const [zones, setZones] = useState([]);
  const [textItems, setTextItems] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [canvasResizeEnabled, setCanvasResizeEnabled] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [activeLibraryId, setActiveLibraryId] = useState(null);
  const [libraryError, setLibraryError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const nextId = useRef(20);
  const nextGroupId = useRef(1);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const handleRef = useRef(null);
  const panRef = useRef(null);
  const stageDragRef = useRef(null);
  const imageFileRef = useRef(null);
  const assetDragRef = useRef(null);
  const selected = items.find((item) => item.id === selectedId);
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
  ].sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0));
  const setReferenceSelected = (selected) => {
    if (!selected) setSelectedReferenceId(null);
  };
  const setReferenceImage = (value) => {
    if (!selectedReferenceId) return;
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
  const selectedGroupItems = selectedGroupId
    ? items.filter((item) => item.editorGroupId === selectedGroupId)
    : [];
  const groupBounds = selectedGroupItems.length
    ? {
        x: Math.min(...selectedGroupItems.map((item) => item.x)),
        y: Math.min(...selectedGroupItems.map((item) => item.y)),
        right: Math.max(
          ...selectedGroupItems.map((item) => item.x + item.width),
        ),
        bottom: Math.max(
          ...selectedGroupItems.map((item) => item.y + item.height),
        ),
      }
    : null;

  const svgMarkup = useMemo(
    () =>
      `<svg viewBox="0 0 ${realWidth} ${realDepth}" xmlns="http://www.w3.org/2000/svg" aria-label="${shapeName}">\n${items.map(svgElement).join("\n")}\n</svg>`,
    [items, shapeName, realWidth, realDepth],
  );
  const vectorShapes = useMemo(
    () =>
      items.map(({ id, name, collision, ...shape }) => ({
        ...shape,
        id: String(id),
        name,
      })),
    [items],
  );
  const collisionShapes = useMemo(
    () => items.filter((item) => item.collision).map(collisionFromLayer),
    [items],
  );
  const itemData = useMemo(
    () => ({
      schema: "stageplot-item@3",
      id: activeLibraryId || libraryId(shapeName),
      label: shapeName.trim() || "Untitled Item",
      groupId: groupId || null,
      dimensions: { widthMeters: realWidth, depthMeters: realDepth },
      shapes: vectorShapes,
      collisionShapes,
      editor: { layers: items },
    }),
    [
      activeLibraryId,
      shapeName,
      groupId,
      realWidth,
      realDepth,
      vectorShapes,
      collisionShapes,
      items,
    ],
  );
  const itemPackage = useMemo(
    () => JSON.stringify(itemData, null, 2),
    [itemData],
  );
  const stageData = useMemo(
    () => ({
      schema: "stageplot-stage@1",
      id: activeLibraryId || libraryId(shapeName),
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
      editor: { referenceImages },
    }),
    [
      activeLibraryId,
      shapeName,
      realWidth,
      realDepth,
      stageNodes,
      zones,
      textItems,
      referenceImages,
    ],
  );

  const refreshLibrary = async () => {
    try {
      const [itemsResponse, groupsResponse, stagesResponse] = await Promise.all(
        [fetch(LIBRARY_API), fetch(GROUPS_API), fetch(STAGES_API)],
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
    setRealWidth(previous.realWidth);
    setRealDepth(previous.realDepth);
    setShapeName(previous.shapeName);
    setGroupId(previous.groupId);
    setHistory((old) => old.slice(0, -1));
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
  };
  const update = (changes) => {
    checkpoint();
    setItems((old) =>
      old.map((item) =>
        item.id === selectedId ? { ...item, ...changes } : item,
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
  const add = (type) => {
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
      fill: "#e9f5bc",
      stroke: "#25261f",
      strokeWidth: 2,
      rotation: 0,
      collision: type !== "line" && type !== "arc",
    };
    setItems((old) => [...old, item]);
    setSelectedId(item.id);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
  };
  const pointerDown = (event, item) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
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
      setItems((old) =>
        old.map((item) => {
          if (item.id !== id) return item;
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
              controlX: snapValue(original.controlX + deltaX),
              controlY: snapValue(original.controlY + deltaY),
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
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    checkpoint();
    handleRef.current = {
      id: selected.id,
      handle,
      px: event.clientX,
      py: event.clientY,
      original: {
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
  const startStageNodeDrag = (event, index, handle = "node", zoneId = null) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    stageDragRef.current = { index, handle, zoneId };
    setSelectedStageNode(index);
    setSelectedZoneId(zoneId);
    setReferenceSelected(false);
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
  const moveStageNode = (event) => {
    if (!stageDragRef.current || !canvasRef.current) return;
    if (stageDragRef.current.handle === "asset-move") {
      const point = stagePointer(event, false); const drag = stageDragRef.current; const dx = point.x - drag.start.x; const dy = point.y - drag.start.y;
      if (drag.assetType === "zone") setZones((old) => old.map((zone) => zone.id === drag.id ? { ...zone, nodes: drag.original.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy, cx: Number.isFinite(node.cx) ? node.cx + dx : node.cx, cy: Number.isFinite(node.cy) ? node.cy + dy : node.cy, arcX: Number.isFinite(node.arcX) ? node.arcX + dx : node.arcX, arcY: Number.isFinite(node.arcY) ? node.arcY + dy : node.arcY })) } : zone));
      if (drag.assetType === "text") setTextItems((old) => old.map((item) => item.id === drag.id ? { ...item, x: drag.original.x + dx, y: drag.original.y + dy } : item));
      return;
    }
    if (stageDragRef.current.handle === "canvas-width" || stageDragRef.current.handle === "canvas-depth") {
      const drag = stageDragRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      const step = snapMode === "advanced" ? .01 : .1;
      if (drag.handle === "canvas-width") setRealWidth(Math.max(.1, Math.round((drag.original + (event.clientX - drag.client) / rect.width * drag.original) / step) * step));
      else setRealDepth(Math.max(.1, Math.round((drag.original + (event.clientY - drag.client) / rect.height * drag.original) / step) * step));
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
        if (handle === "pointArc")
          return { ...node, arcX: point.x, arcY: point.y };
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
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
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
    if (!canvasResizeEnabled || !event.ctrlKey) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    stageDragRef.current = { handle: dimension === "width" ? "canvas-width" : "canvas-depth", client: dimension === "width" ? event.clientX : event.clientY, original: dimension === "width" ? realWidth : realDepth };
  };
  const startAssetMove = (event, asset, assetType) => {
    if (asset.locked || event.ctrlKey || event.shiftKey) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    stageDragRef.current = { handle: "asset-move", assetType, id: asset.id, start: stagePointer(event, false), original: assetType === "zone" ? structuredClone(asset.nodes) : { x: asset.x, y: asset.y } };
    if (assetType === "zone") { setSelectedZoneId(asset.id); setSelectedTextId(null); }
    else { setSelectedTextId(asset.id); setSelectedZoneId(null); }
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
    const order = new Map(ids.map((id, index) => [id, index]));
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
    if (asset.assetType === "image") setReferenceImages((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item));
    if (asset.assetType === "zone") setZones((old) => old.map((item) => item.id === asset.id ? { ...item, locked: !item.locked } : item));
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
  const download = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([svgMarkup], { type: "image/svg+xml" }),
    );
    link.download = `${slug(shapeName).toLowerCase()}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
    flash("SVG downloaded");
  };
  const saveToLibrary = async () => {
    if (documentMode === "stage") {
      try {
        const response = await fetch(
          `${STAGES_API}/${encodeURIComponent(stageData.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stageData, null, 2),
          },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setActiveLibraryId(result.id);
        await refreshLibrary();
        flash(activeLibraryId ? "Stage updated" : "Stage added to Stageplot");
      } catch (error) {
        flash(error.message || "Could not save stage");
      }
      return;
    }
    if (!collisionShapes.length)
      return flash("Mark at least one layer as physical");
    try {
      const response = await fetch(
        `${LIBRARY_API}/${encodeURIComponent(itemData.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: itemPackage,
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setActiveLibraryId(result.id);
      await refreshLibrary();
      flash(activeLibraryId ? "Stageplot item updated" : "Added to Stageplot");
    } catch (error) {
      flash(error.message || "Could not save item");
    }
  };
  const editLibraryItem = (item) => {
    setActiveLibraryId(item.id);
    setShapeName(item.label);
    setGroupId(item.groupId || "");
    setRealWidth(item.dimensions.widthMeters);
    setRealDepth(item.dimensions.depthMeters);
    setItems(item.editor?.layers || []);
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
  const newItem = () => {
    const width = documentMode === "stage" ? 10 : 1;
    const depth = documentMode === "stage" ? 5 : 1;
    setActiveLibraryId(null);
    setShapeName(documentMode === "stage" ? "Untitled Stage" : "Untitled Item");
    setGroupId("");
    setItems([]);
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
    setHistory([]);
    setRealWidth(width);
    setRealDepth(depth);
    setStageNodes(defaultStageNodes(width, depth));
    setZones([]);
    setTextItems([]);
    setSelectedTextId(null);
    setSelectedZoneId(null);
    setReferenceImages([]);
    setSelectedReferenceId(null);
    setSelectedStageNode(null);
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
  const copyReact = async () => {
    const component = `export default function ${slug(shapeName)}Shape() {\n  return (\n    ${svgMarkup.replaceAll("stroke-width", "strokeWidth").replaceAll("vector-effect", "vectorEffect").replace("aria-label", "aria-label")}\n  )\n}\n`;
    await navigator.clipboard.writeText(component);
    flash("React component copied");
  };
  const zoomViewport = (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    setZoom((value) => Math.max(0.25, Math.min(6, value * factor)));
  };
  const startPan = (event) => {
    if (
      event.button !== 0 ||
      event.target.closest?.(".shape-layer, .stage-boundary-editor")
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      px: event.clientX,
      py: event.clientY,
      x: pan.x,
      y: pan.y,
    };
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSelectedGroupId(null);
  };
  const movePan = (event) => {
    if (!panRef.current) return;
    setPan({
      x: panRef.current.x + event.clientX - panRef.current.px,
      y: panRef.current.y + event.clientY - panRef.current.py,
    });
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  useEffect(() => {
    const keyDown = (event) => {
      if (
        event.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
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
          <select
            value={documentMode}
            onChange={(e) => {
              const stageMode = e.target.value === "stage";
              setDocumentMode(e.target.value);
              setActiveLibraryId(null);
              setShapeName(stageMode ? "Untitled Stage" : "Untitled Item");
              setRealWidth(stageMode ? 10 : 1);
              setRealDepth(stageMode ? 5 : 1);
              setStageNodes(
                defaultStageNodes(stageMode ? 10 : 1, stageMode ? 5 : 1),
              );
              setZones([]);
              setTextItems([]);
              setSelectedTextId(null);
              setReferenceImages([]);
              setSelectedReferenceId(null);
              setSelectedZoneId(null);
              setSelectedStageNode(null);
            }}
          >
            <option value="item">Equipment item</option>
            <option value="stage">Stage</option>
          </select>
          <button onClick={newItem}>New {documentMode}</button>
          <button
            onClick={() => {
              refreshLibrary();
              setLibraryOpen(true);
            }}
          >
            Load existing
          </button>
          {documentMode === "item" && (
            <>
              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(svgMarkup)
                    .then(() => flash("SVG copied"))
                }
              >
                Copy SVG
              </button>
              <button onClick={copyReact}>Copy React</button>
              <button onClick={download}>SVG only</button>
            </>
          )}
          <button className="accent" onClick={saveToLibrary}>
            {activeLibraryId
              ? `Update ${documentMode}`
              : `Add ${documentMode} to Stageplot`}
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
                    className={(asset.assetType === "image" ? selectedReferenceId === asset.id : asset.assetType === "text" ? selectedTextId === asset.id : selectedZoneId === asset.id) ? "active" : ""}
                    key={asset.id}
                    onDragStart={() => { assetDragRef.current = asset.id; }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => { if (assetDragRef.current) reorderAsset(assetDragRef.current, asset.id); assetDragRef.current = null; }}
                    onClick={() => {
                      if (asset.assetType === "image") { setSelectedReferenceId(asset.id); setSelectedZoneId(null); setSelectedTextId(null); }
                      else if (asset.assetType === "text") { setSelectedTextId(asset.id); setSelectedZoneId(null); setSelectedReferenceId(null); }
                      else { setSelectedZoneId(asset.id); setSelectedTextId(null); setSelectedReferenceId(null); }
                      setSelectedStageNode(null);
                    }}
                  >
                    <i style={{ background: asset.assetType === "image" ? "#d8d8d8" : asset.assetType === "text" ? asset.color : asset.solid ? "#f7f6ef" : asset.fill }} />
                    <span>{asset.name || (asset.assetType === "image" ? "Background image" : asset.assetType === "text" ? "Text" : "Zone")}</span>
                    <small>{asset.assetType === "image" ? "image" : asset.assetType === "text" ? "text" : asset.label ? "label zone" : asset.solid ? "solid zone" : "aesthetic zone"}</small>
                    <span className="asset-lock" role="button" title={asset.locked ? "Unlock asset" : "Lock asset"} onClick={(event) => { event.stopPropagation(); toggleAssetLock(asset); }}>{asset.locked ? "🔒" : "🔓"}</span>
                  </button>
                ))}
              </div>
              <p className="eyebrow advanced-title">STAGE BOUNDARY</p>
              <p className="handle-help">
                <b>Shift-click</b> a highlighted edge to insert a node.{" "}
                <b>Ctrl-click</b> an edge to make it a smooth curve. Select a
                curved segment to change its handle mode.
              </p>
              <div className="layers">
                {stageNodes.map((node, index) => (
                  <button
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
              </div>
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
              <p className="eyebrow">ADD SHAPE</p>
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
                {ADVANCED_PALETTE.map((tool) => (
                  <button key={tool.type} onClick={() => add(tool.type)}>
                    <b>{tool.glyph}</b>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
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
                    onClick={(event) => selectLayer(event, item)}
                  >
                    <i style={{ background: item.fill }} />{" "}
                    <span>
                      {item.editorGroupId ? `↳ ${item.name}` : item.name}
                    </span>
                    <small>{item.editorGroupId ? "grouped" : item.type}</small>
                  </button>
                ))}
              </div>
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
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={() => {
              panRef.current = null;
            }}
            onPointerCancel={() => {
              panRef.current = null;
            }}
          >
            <div
              className="canvas-shell"
              style={{
                aspectRatio: `${realWidth} / ${realDepth}`,
                width: `min(76%, ${(68 * realWidth) / realDepth}vh)`,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg
                ref={canvasRef}
                className={`canvas ${grid ? "show-grid" : ""}`}
                viewBox={`0 0 ${realWidth} ${realDepth}`}
                onPointerMove={
                  documentMode === "stage" ? moveStageNode : pointerMove
                }
                onPointerUp={() => {
                  dragRef.current = null;
                  handleRef.current = null;
                  stageDragRef.current = null;
                }}
                onPointerCancel={() => {
                  dragRef.current = null;
                  handleRef.current = null;
                  stageDragRef.current = null;
                }}
                onPointerDown={() => {
                  setSelectedId(null);
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
                  <g className="ordered-stage-assets">
                    {orderedAssets.map((asset) =>
                      asset.assetType === "image" ? (
                        <svg key={asset.id} className={asset.locked ? "ordered-reference locked" : "ordered-reference"} x={asset.x} y={asset.y} width={asset.width} height={asset.height} viewBox={`${asset.crop?.left || 0} ${asset.crop?.top || 0} ${1 - (asset.crop?.left || 0) - (asset.crop?.right || 0)} ${1 - (asset.crop?.top || 0) - (asset.crop?.bottom || 0)}`} preserveAspectRatio="none" opacity={asset.opacity} overflow="hidden" onPointerDown={asset.locked ? undefined : (event) => startReferenceDrag(event, "image-move", asset)}>
                          <image href={asset.dataUrl} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
                        </svg>
                      ) : asset.assetType === "text" ? (
                        <text key={asset.id} x={asset.x} y={asset.y} fill={asset.color} fillOpacity={asset.opacity} fontSize={asset.fontSize} textAnchor="middle" dominantBaseline="middle" className={asset.locked ? "stage-text locked" : "stage-text"} onPointerDown={(event) => startAssetMove(event, asset, "text")}>{asset.text}</text>
                      ) : (
                        <path pointerEvents="none" key={asset.id} d={stagePath(asset.nodes)} fill={asset.solid ? "#f7f6ef" : asset.fill} fillOpacity={asset.solid ? 1 : asset.fillOpacity} stroke={asset.solid ? "#71851f" : asset.stroke} strokeOpacity={asset.solid ? 1 : asset.strokeOpacity} strokeWidth={asset.solid ? 2 : asset.strokeWidth} vectorEffect="non-scaling-stroke" />
                      ),
                    )}
                  </g>
                )}
                {documentMode === "stage" ? (
                  <g className="stage-boundary-editor">
                    {referenceImage && (
                      <g
                        className="reference-image"
                        onPointerDown={referenceImage.locked ? undefined : (event) =>
                          startReferenceDrag(event, "image-move")
                        }
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
                        {zone.nodes.map((node, index) => {
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
                    <path className="stage-floor" d={stagePath(stageNodes)} />
                    {stageNodes.map((node, index) => {
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
                    {items.map((item) => (
                      <Shape
                        key={item.id}
                        item={item}
                        selected={
                          item.id === selectedId ||
                          multiSelectedIds.includes(item.id)
                        }
                        onPointerDown={(e) => pointerDown(e, item)}
                        onHandlePointerDown={startHandleDrag}
                      />
                    ))}
                    {items
                      .filter((item) => item.collision)
                      .map((item) => (
                        <CollisionGuide
                          key={`collision-${item.id}`}
                          item={item}
                        />
                      ))}
                    {groupBounds && (
                      <rect
                        className="group-selection"
                        x={groupBounds.x - 0.03}
                        y={groupBounds.y - 0.03}
                        width={groupBounds.right - groupBounds.x + 0.06}
                        height={groupBounds.bottom - groupBounds.y + 0.06}
                      />
                    )}
                  </>
                )}
                {documentMode === "stage" &&
                  stageNode &&
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
                {documentMode === "stage" && canvasResizeEnabled && <><line className="canvas-resize-edge width" x1={realWidth} y1="0" x2={realWidth} y2={realDepth} onPointerDown={(event) => startCanvasResize(event, "width")} /><line className="canvas-resize-edge depth" x1="0" y1={realDepth} x2={realWidth} y2={realDepth} onPointerDown={(event) => startCanvasResize(event, "depth")} /></>}
              </svg>
              <div className="axis x">{realWidth} m</div>
              <div className="axis y">{realDepth} m</div>
            </div>
            <p className="canvas-help">
              Scroll to zoom · Drag empty canvas to pan · Dimensions are metres
            </p>
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
                  WIDTH (M)
                  <input
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
                  DEPTH (M)
                  <input
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
                  {!selectedZone.solid && (
                    <>
                      <div className="field-row colors">
                        <label className="field">
                          FILL
                          <input
                            type="color"
                            value={selectedZone.fill}
                            onChange={(e) =>
                              updateSelectedZone({ fill: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          LINE
                          <input
                            type="color"
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
                  <label className="field">SIZE (M)<input type="number" min="0.05" step="0.05" value={selectedText.fontSize} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, fontSize: Math.max(.05, +e.target.value) } : item))} /></label>
                  <label className="field">COLOUR<input type="color" value={selectedText.color} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, color: e.target.value } : item))} /></label>
                  <label className="field">TRANSPARENCY <span>{Math.round((1 - selectedText.opacity) * 100)}%</span><input type="range" min="0" max="1" step=".05" value={1 - selectedText.opacity} onChange={(e) => setTextItems((old) => old.map((item) => item.id === selectedText.id ? { ...item, opacity: 1 - +e.target.value } : item))} /></label>
                  <button className="delete" onClick={() => { setTextItems((old) => old.filter((item) => item.id !== selectedText.id)); setSelectedTextId(null); }}>Delete text</button>
                </>
              )}
              {referenceSelected && referenceImage && (
                <>
                  <p className="eyebrow advanced-title">REFERENCE IMAGE</p>
                  <div className="field-row">
                    <label className="field">
                      X
                      <input
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
                      Y
                      <input
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
                      WIDTH
                      <input
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
                      HEIGHT
                      <input
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
              )}
              {stageNode && (
                <>
                  <div className="field-row">
                    <label className="field">
                      NODE X
                      <input
                        type="number"
                        step="0.01"
                        value={stageNode.x}
                        onChange={(e) =>
                          updateBoundaryNode({ x: +e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      NODE Y
                      <input
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
                      NODE X
                      <input
                        type="number"
                        step="0.01"
                        value={stageNode.x}
                        onChange={(e) =>
                          updateBoundaryNode({ x: +e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      NODE Y
                      <input
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
                      The amber point stays at the parameter midpoint of the
                      arc. Drag it to define the arc through that point.
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
                Grouped layers act as one object and cannot be selected
                individually until the group is released.
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
                  WIDTH (M)
                  <input
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
                  DEPTH (M)
                  <input
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
              <p className="inspector-context">Selected vector layer</p>
              <label className="field">
                LAYER NAME
                <input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  X (M)
                  <input
                    type="number"
                    step="0.01"
                    value={+selected.x.toFixed(3)}
                    onChange={(e) => update({ x: +e.target.value })}
                  />
                </label>
                <label className="field">
                  Y (M)
                  <input
                    type="number"
                    step="0.01"
                    value={+selected.y.toFixed(3)}
                    onChange={(e) => update({ y: +e.target.value })}
                  />
                </label>
              </div>
              {selected.type === "tripod" ? (
                <label className="field">
                  LEG RADIUS (M)
                  <input
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
                    WIDTH (M)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={+selected.width.toFixed(3)}
                      onChange={(e) => update({ width: +e.target.value })}
                    />
                  </label>
                  <label className="field">
                    HEIGHT (M)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={+selected.height.toFixed(3)}
                      onChange={(e) => update({ height: +e.target.value })}
                    />
                  </label>
                </div>
              )}
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
                      LEFT ANGLE
                      <input
                        type="number"
                        step="0.01"
                        value={+(selected.leftInset || 0).toFixed(3)}
                        onChange={(e) => update({ leftInset: +e.target.value })}
                      />
                    </label>
                    <label className="field">
                      RIGHT ANGLE
                      <input
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
                    SLEW (M)
                    <input
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
              <div className="field-row colors">
                <label className="field">
                  FILL
                  <input
                    type="color"
                    value={selected.fill}
                    onChange={(e) => update({ fill: e.target.value })}
                  />
                </label>
                <label className="field">
                  STROKE
                  <input
                    type="color"
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
              <button onClick={() => setLibraryOpen(false)} aria-label="Close">
                ×
              </button>
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
                            {stage.dimensions.widthMeters} ×{" "}
                            {stage.dimensions.depthMeters} m ·{" "}
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
                                  {item.dimensions.widthMeters} ×{" "}
                                  {item.dimensions.depthMeters} m ·{" "}
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
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
