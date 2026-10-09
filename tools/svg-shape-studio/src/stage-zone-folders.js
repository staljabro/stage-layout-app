export function zoneFolderRows(assets, folders) {
  const rows = [];
  const shown = new Set();
  for (const asset of assets) {
    const folder = asset.assetType === "zone"
      ? folders.find(candidate => candidate.zoneIds.includes(asset.id))
      : null;
    if (!folder) rows.push({ type: "asset", asset });
    else if (!shown.has(folder.id)) {
      shown.add(folder.id);
      rows.push({
        type: "folder",
        folder,
        assets: assets.filter(candidate => candidate.assetType === "zone" && folder.zoneIds.includes(candidate.id)),
      });
    }
  }
  for (const folder of folders) {
    if (!shown.has(folder.id)) rows.push({ type: "folder", folder, assets: [] });
  }
  return rows;
}

export function putZonesInFolder(folders, zoneIds, folderId) {
  const moving = new Set(zoneIds);
  return folders.map(folder => ({
    ...folder,
    zoneIds: folder.id === folderId
      ? [...folder.zoneIds.filter(id => !moving.has(id)), ...zoneIds]
      : folder.zoneIds.filter(id => !moving.has(id)),
  }));
}

export function removeZonesFromFolders(folders, zoneIds) {
  const removing = new Set(zoneIds);
  return folders.map(folder => ({ ...folder, zoneIds: folder.zoneIds.filter(id => !removing.has(id)) }));
}

export function normalizeZoneFolders(folders, zones) {
  const valid = new Set(zones.map(zone => zone.id));
  const claimed = new Set();
  return (Array.isArray(folders) ? folders : []).map((folder, index) => ({
    id: typeof folder.id === "string" ? folder.id : `zone-folder-${index}`,
    name: typeof folder.name === "string" && folder.name.trim() ? folder.name : "Zone folder",
    collapsed: folder.collapsed === true,
    zoneIds: (Array.isArray(folder.zoneIds) ? folder.zoneIds : []).filter(id => valid.has(id) && !claimed.has(id) && claimed.add(id)),
  }));
}
