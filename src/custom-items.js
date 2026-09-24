const finite = (value, fallback) => Number.isFinite(value) ? value : fallback

export function stagingSnapPoints(widthMeters, depthMeters) {
  const width = Math.max(1, Math.round(widthMeters))
  const depth = Math.max(1, Math.round(depthMeters))
  const points = []
  for (let y = 0; y <= depth; y += 1) {
    for (let x = 0; x <= width; x += 1) points.push({ x, y })
  }
  return points
}

export function customStagingItem(values = {}) {
  const widthMeters = Math.max(1, Math.round(finite(values.widthMeters, 1)))
  const depthMeters = Math.max(1, Math.round(finite(values.depthMeters, 1)))
  return {
    ...values,
    customType: 'staging',
    label: values.label || 'Custom staging - Prostage',
    widthMeters,
    depthMeters,
    heightMm: Math.max(0, Math.round(finite(values.heightMm, 200))),
    showHeight: values.showHeight !== false,
    fill: values.fill || '#d6d2c5',
    fillOpacity: finite(values.fillOpacity, .8),
    line: values.line || '#25261f',
    lineOpacity: finite(values.lineOpacity, 1),
    sublineColor: values.sublineColor || '#85837c',
    textColor: values.textColor || '#25261f',
    collisionEnabled: values.collisionEnabled === true,
    collisionShapes: [{ type: 'rect', x: 0, y: 0, width: widthMeters, height: depthMeters }],
    snapPoints: stagingSnapPoints(widthMeters, depthMeters),
  }
}

export function customTextItem(values = {}) {
  return {
    ...values,
    customType: 'text',
    label: values.label || 'Custom Text',
    text: typeof values.text === 'string' ? values.text : 'Custom Text',
    fontSize: Math.max(.01, finite(values.fontSize, .3)),
    bold: values.bold === true,
    italic: values.italic === true,
    fill: values.fill || '#25261f',
    lineSpacing: 1.2,
    textAlign: 'left',
    widthMeters: Math.max(.01, finite(values.widthMeters, 1.6)),
    depthMeters: Math.max(.01, finite(values.depthMeters, .3)),
    collisionEnabled: values.collisionEnabled === true,
    collisionShapes: [],
    snapPoints: [],
  }
}

export function customItemData(item) {
  if (item.customType === 'staging') return {
    type: 'staging', widthMeters: item.widthMeters, depthMeters: item.depthMeters,
    heightMm: item.heightMm, showHeight: item.showHeight !== false,
    fill: item.fill, fillOpacity: item.fillOpacity, line: item.line,
    lineOpacity: item.lineOpacity, sublineColor: item.sublineColor, textColor: item.textColor,
  }
  if (item.customType === 'text') return {
    type: 'text', text: item.text, fontSize: item.fontSize, bold: item.bold === true,
    italic: item.italic === true, fill: item.fill,
    widthMeters: item.widthMeters, depthMeters: item.depthMeters,
  }
  return null
}

export function restoreCustomItem(placement, id) {
  const common = {
    id, xMeters: placement.xMeters, yMeters: placement.yMeters,
    rotation: Number.isFinite(placement.rotation) ? placement.rotation : 0,
    label: typeof placement.label === 'string' ? placement.label : undefined,
    showLabel: placement.showLabel === true, visible: placement.visible !== false,
    collisionEnabled: placement.collisionEnabled === true,
  }
  if (placement.custom?.type === 'staging') return customStagingItem({ ...placement.custom, ...common })
  if (placement.custom?.type === 'text') return customTextItem({ ...placement.custom, ...common })
  return null
}
