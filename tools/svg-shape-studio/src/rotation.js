export const objectPivot = (item) => item.type === 'tripod'
  ? { x: Math.sqrt(3) / 2 * (item.legRadius ?? item.width / Math.sqrt(3)), y: item.legRadius ?? item.width / Math.sqrt(3) }
  : { x: item.width / 2, y: item.height / 2 };

export const normalizeRotation = (degrees) => ((degrees + 180) % 360 + 360) % 360 - 180;

export function rotateObjects(items, center, degrees) {
  const angle = degrees * Math.PI / 180;
  return items.map(item => {
    const pivot = objectPivot(item);
    const dx = item.x + pivot.x - center.x, dy = item.y + pivot.y - center.y;
    return {
      ...item,
      x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle) - pivot.x,
      y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) - pivot.y,
      rotation: normalizeRotation((item.rotation || 0) + degrees),
    };
  });
}

export function rotatedBounds(items) {
  const points = items.flatMap(item => {
    const pivot = objectPivot(item), angle = (item.rotation || 0) * Math.PI / 180;
    return [[0, 0], [item.width, 0], [0, item.height], [item.width, item.height]].map(([x, y]) => ({
      x: item.x + pivot.x + (x - pivot.x) * Math.cos(angle) - (y - pivot.y) * Math.sin(angle),
      y: item.y + pivot.y + (x - pivot.x) * Math.sin(angle) + (y - pivot.y) * Math.cos(angle),
    }));
  });
  if (!points.length) return null;
  return { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)), right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) };
}
