export const segmentMode = (node) =>
  node.curveMode || (node.curve ? "smooth" : "line");
export const segmentMidpoint = (from, to) => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2,
});
export const smoothControl = (from, to) => {
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
export const arcOffset = (from, to, point) => {
  const midpoint = segmentMidpoint(from, to);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!length) return 0;
  return (
    (-(to.y - from.y) * (point.x - midpoint.x) +
      (to.x - from.x) * (point.y - midpoint.y)) / length
  );
};
export const pointOnArc = (from, to) => {
  const midpoint = segmentMidpoint(from, to);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!length) return midpoint;
  const offset = Number.isFinite(to.arcDepth)
    ? to.arcDepth
    : arcOffset(from, to, {
        x: to.arcX ?? midpoint.x,
        y: to.arcY ?? midpoint.y,
      });
  return {
    x: midpoint.x - ((to.y - from.y) / length) * offset,
    y: midpoint.y + ((to.x - from.x) / length) * offset,
  };
};
export const pointArcControl = (from, to) => {
  const point = pointOnArc(from, to);
  return {
    x: point.x * 2 - (from.x + to.x) / 2,
    y: point.y * 2 - (from.y + to.y) / 2,
  };
};
export const bezierGeometry = (from, to) => {
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
export const stageSegmentPath = (from, to) => {
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
export const stagePath = (nodes) =>
  !nodes || nodes.length < 3
    ? ""
    : `M ${nodes[0].x} ${nodes[0].y} ${nodes
        .slice(1)
        .map((node, index) => stageSegmentPath(nodes[index], node))
        .join(" ")} ${stageSegmentPath(nodes.at(-1), nodes[0])} Z`;

export const sampleStageBoundary = (nodes, samples = 16) =>
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
