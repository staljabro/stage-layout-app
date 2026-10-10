export const normalizeDegrees = degrees => ((degrees + 180) % 360 + 360) % 360 - 180

export function controlsKeepingWorldOrientation(item, nextItemRotation) {
  const delta = nextItemRotation - (item.rotation || 0)
  return Object.fromEntries((item.rotationParts || []).map(part => {
    const current = item.controls?.[part.id]?.rotation ?? part.defaultRotation ?? 0
    return [part.id, { ...(item.controls?.[part.id] || {}), rotation: normalizeDegrees(current - delta) }]
  }))
}
