export function uniqueItemId(base, library) {
  const ids = new Set(library.map(item => item.id));
  if (!ids.has(base)) return base;
  for (let number = 2; ; number++) {
    const suffix = `-${number}`;
    const candidate = base.slice(0, 80 - suffix.length) + suffix;
    if (!ids.has(candidate)) return candidate;
  }
}
export function newAssetId(kind = 'item') {
  return `${kind}-${crypto.randomUUID()}`;
}

export function equipmentSaveChoice(library, activeId, name) {
  const active = library.find(item => item.id === activeId);
  if (active) return active.label.trim() !== name.trim() ? { target: active, renamed: true } : null;
  const target = library.find(item => !item.editor?.advancedShapeRole &&
    item.label.trim().toLowerCase() === name.trim().toLowerCase());
  return target ? { target, renamed: false } : null;
}
