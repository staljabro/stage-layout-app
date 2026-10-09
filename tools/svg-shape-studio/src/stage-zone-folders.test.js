import test from "node:test";
import assert from "node:assert/strict";
import { normalizeZoneFolders, putZonesInFolder, removeZonesFromFolders, zoneFolderRows } from "./stage-zone-folders.js";

const assets = [
  { id: "text", assetType: "text" },
  { id: "a", assetType: "zone" },
  { id: "b", assetType: "zone" },
];

test("zone folders replace member rows without swallowing other stage assets", () => {
  const rows = zoneFolderRows(assets, [{ id: "f", zoneIds: ["a", "b"] }]);
  assert.deepEqual(rows.map(row => row.type === "asset" ? row.asset.id : row.folder.id), ["text", "f"]);
  assert.deepEqual(rows[1].assets.map(asset => asset.id), ["a", "b"]);
});

test("zones move between folders and can be removed", () => {
  const folders = [{ id: "one", zoneIds: ["a"] }, { id: "two", zoneIds: ["b"] }];
  const moved = putZonesInFolder(folders, ["a"], "two");
  assert.deepEqual(moved.map(folder => folder.zoneIds), [[], ["b", "a"]]);
  assert.deepEqual(removeZonesFromFolders(moved, ["b"]).map(folder => folder.zoneIds), [[], ["a"]]);
});

test("saved folders discard missing and duplicate zone references", () => {
  const folders = normalizeZoneFolders([{ id: "one", zoneIds: ["a", "missing"] }, { id: "two", zoneIds: ["a", "b"] }], assets.slice(1));
  assert.deepEqual(folders.map(folder => folder.zoneIds), [["a"], ["b"]]);
});
