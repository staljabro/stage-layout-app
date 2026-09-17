import { isPublishedItem } from '../../library-membership.mjs';

export const advancedPresetId = (role, name) =>
  role === 'custom' ? `advanced-${name}`.slice(0, 80) :
    role === 'seatedPerson' ? 'advanced-seated-person' : 'advanced-standing-person';

export function removeCustomShapeMembership(preset) {
  const editor = { ...preset.editor };
  delete editor.advancedShapeRole;
  return { ...preset, editor, stageplotPublished: isPublishedItem(preset) };
}

export function instantiateAdvancedShape(preset, canvas, firstId, groupId) {
  const layers = preset.editor?.layers;
  if (!layers?.length) throw new Error('This preset has no editable artwork');
  const x = (canvas.width - preset.dimensions.widthMeters) / 2;
  const y = (canvas.depth - preset.dimensions.depthMeters) / 2;
  if (preset.editor.placementMode === 'single') {
    return [{
      id: firstId, name: preset.label, type: 'compound', x, y,
      width: preset.dimensions.widthMeters, height: preset.dimensions.depthMeters,
      artworkWidth: preset.dimensions.widthMeters, artworkHeight: preset.dimensions.depthMeters,
      rotation: 0, collision: false, children: structuredClone(layers),
    }];
  }
  return structuredClone(layers).map((layer, index) => ({
    ...layer,
    id: firstId + index,
    x: layer.x + x,
    y: layer.y + y,
    editorGroupId: groupId,
    editorGroupName: preset.label,
  }));
}
