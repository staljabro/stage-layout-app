export const polygonPoints = (width, height, sides = 6) =>
  Array.from({ length: Math.max(3, sides) }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(3, sides);
    return {
      x: width / 2 + (Math.cos(angle) * width) / 2,
      y: height / 2 + (Math.sin(angle) * height) / 2,
    };
  });

export const hexagonPoints = (width, height) => [
  { x: width * 0.25, y: 0 },
  { x: width * 0.75, y: 0 },
  { x: width, y: height * 0.5 },
  { x: width * 0.75, y: height },
  { x: width * 0.25, y: height },
  { x: 0, y: height * 0.5 },
];

export const trapezoidPoints = (item) => {
  const left = (item.leftInset || 0) + (item.slew || 0);
  const right = item.width - (item.rightInset || 0) + (item.slew || 0);
  return [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: item.width, y: item.height },
    { x: 0, y: item.height },
  ];
};

export const pointsAttribute = (points) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

export const tripodGeometry = (item) => {
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

