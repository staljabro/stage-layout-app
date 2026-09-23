import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentSaveChoice, uniqueItemId, newAssetId, assetUuid } from './equipment-save.js';
test('new asset IDs are unique and independent of names', () => {
  const first = newAssetId('stage');
  assert.match(first, /^stage-[a-f0-9-]{36}$/);
  assert.notEqual(first, newAssetId('stage'));
  assert.match(newAssetId(), /^item-[a-f0-9-]{36}$/);
});
test('asset IDs work when randomUUID is unavailable on plain HTTP', () => {
  const fallback=assetUuid({getRandomValues(bytes){bytes.fill(7);return bytes;}});
  assert.equal(fallback,'07070707-0707-4707-8707-070707070707');
});
test('legacy IDs do not create name conflicts after a rename', () => {
  assert.equal(equipmentSaveChoice([{id:'chair',label:'Bench'}],null,'Chair','chair'),null);
});
const library = [
  { id: 'chair', label: 'Chair' },
  { id: 'chair-2', label: 'Chair' },
  { id: 'stand', label: 'Stand' },
  { id: 'advanced-block', label: 'Block', editor: { advancedShapeRole: 'custom' } },
];
test('new equipment name conflicts prompt without treating building blocks as equipment', () => {
  assert.equal(equipmentSaveChoice(library,null,' CHAIR ','chair').target.id,'chair');
  assert.equal(equipmentSaveChoice(library,null,'Block','block'),null);
  assert.equal(equipmentSaveChoice(library,null,'New','new'),null);
});
test('renamed designs offer to update the original, even when the new name exists', () => {
  const choice=equipmentSaveChoice(library,'chair','Stand','stand');
  assert.equal(choice.target.id,'chair');
  assert.equal(choice.renamed,true);
  assert.equal(equipmentSaveChoice(library,'chair','Chair','chair'),null);
});
test('save as new allocates an unused ID without changing the chosen name', () => {
  assert.equal(uniqueItemId('chair',library),'chair-3');
  assert.equal(uniqueItemId('new-chair',library),'new-chair');
  const long='x'.repeat(80);
  assert.equal(uniqueItemId(long,[{id:long}]),'x'.repeat(78)+'-2');
});
