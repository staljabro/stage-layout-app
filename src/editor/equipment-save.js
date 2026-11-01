export function uniqueItemId(base, library) {
  const ids = new Set(library.map(item => item.id));
  if (!ids.has(base)) return base;
  for (let number = 2; ; number++) {
    const suffix = `-${number}`;
    const candidate = base.slice(0, 80 - suffix.length) + suffix;
    if (!ids.has(candidate)) return candidate;
  }
}
export function assetUuid(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}`;
}

export function newAssetId(kind = 'item') {
  return `${kind}-${assetUuid()}`;
}

export function equipmentSaveChoice(library, activeId, name) {
  const active = library.find(item => item.id === activeId);
  if (active) return active.label.trim() !== name.trim() ? { target: active, renamed: true } : null;
  const target = library.find(item => !item.editor?.advancedShapeRole &&
    item.label.trim().toLowerCase() === name.trim().toLowerCase());
  return target ? { target, renamed: false } : null;
}
