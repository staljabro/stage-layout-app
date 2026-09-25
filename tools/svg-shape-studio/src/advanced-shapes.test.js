import assert from 'node:assert/strict';
import test from 'node:test';
import { advancedPresetId, instantiateAdvancedShape, removeCustomShapeMembership } from './advanced-shapes.js';

test('single-layer placement preserves artwork in one independent transformable layer', () => {
  const preset = {
    label: 'Custom artwork', dimensions: { widthMeters: 2, depthMeters: 3 },
    editor: { placementMode: 'single', referenceImages: [{ dataUrl: 'reference' }], layers: [
      { id: 7, type: 'rect', x: .2, y: .4, width: 1, height: 2, rotation: 30, fill: '#123456' },
      { id: 8, type: 'circle', x: .8, y: .2, width: .3, height: .3 },
    ] },
  };
  const [layer] = instantiateAdvancedShape(preset, { width: 4, depth: 5 }, 20, 'group');
  assert.equal(layer.type, 'compound');
  assert.equal(layer.id, 20);
  assert.deepEqual([layer.x, layer.y, layer.width, layer.height, layer.rotation], [1, 1, 2, 3, 0]);
  assert.equal(layer.editorGroupId, undefined);
  assert.deepEqual(layer.children, preset.editor.layers.map(child=>({...child,collision:false})));
  layer.width = 4;
  layer.rotation = 90;
  assert.equal(layer.artworkWidth, 2);
  layer.children[0].fill = '#ffffff';
  assert.equal(preset.editor.layers[0].fill, '#123456');
});

test('saved artwork inserts centered with independent editable layers', () => {
  const preset = JSON.parse(JSON.stringify({
    label: 'My seated person',
    dimensions: { widthMeters: 2, depthMeters: 3 },
    editor: {
      advancedShapeRole: 'seatedPerson',
      referenceImages: [{ dataUrl: 'reference-only' }],
      layers: [
        { id: 7, type: 'vector', x: .2, y: .4, rotation: 30, collision: true,
          editorGroupId: 'old-group', nodes: [{ x: 0, y: 0 }, { x: 1, y: 0, curveMode: 'pointArc', arcDepth: .3 }, { x: 0, y: 1 }] },
        { id: 9, type: 'circle', x: .8, y: .2, width: .3, height: .3, fill: '#49352b', collision: false },
      ],
    },
  }));
  const first = instantiateAdvancedShape(preset, { width: 4, depth: 5 }, 20, 'first');
  const second = instantiateAdvancedShape(preset, { width: 4, depth: 5 }, 22, 'second');
  assert.deepEqual(first.map(layer => layer.id), [20, 21]);
  assert.deepEqual(first.map(layer => [layer.x, layer.y]), [[1.2, 1.4], [1.8, 1.2]]);
  assert.equal(first[0].rotation, 30);
  assert.equal(first[0].collision, false);
  assert.equal(first[1].collision, false);
  assert.equal(first[1].fill, '#49352b');
  assert.ok(first.every(layer => layer.editorGroupId === 'first'));
  assert.ok(second.every(layer => layer.editorGroupId === 'second'));
  first[0].nodes[1].arcDepth = 2;
  assert.equal(second[0].nodes[1].arcDepth, .3);
  assert.equal(preset.editor.layers[0].nodes[1].arcDepth, .3);
  assert.equal(first.length, 2);
});

test('collision-only vectors remain collision geometry when reused', () => {
  const preset={label:'Collision preset',dimensions:{widthMeters:1,depthMeters:1},editor:{layers:[
    {id:1,type:'vector',collisionOnly:true,collision:false,x:0,y:0,width:1,height:1,nodes:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]},
    {id:2,type:'rect',collision:true,x:0,y:0,width:1,height:1},
  ]}};
  const layers=instantiateAdvancedShape(preset,{width:2,depth:2},10,'group');
  assert.equal(layers[0].collisionOnly,true);
  assert.equal(layers[0].collision,true);
  assert.equal(layers[1].collision,false);
});

test('person replacements keep stable slots and empty artwork is rejected', () => {
  assert.equal(advancedPresetId('seatedPerson', 'first-design'), advancedPresetId('seatedPerson', 'second-design'));
  assert.notEqual(advancedPresetId('seatedPerson', 'design'), advancedPresetId('standingPerson', 'design'));
  assert.notEqual(advancedPresetId('custom', 'first'), advancedPresetId('custom', 'second'));
  assert.ok(advancedPresetId('custom', 'a'.repeat(80)).length <= 80);
  assert.throws(() => instantiateAdvancedShape({ editor: { layers: [] } }, {}, 1, 'group'), /no editable artwork/);
});

test('removing a custom shape preserves the saved artwork and reference images', () => {
  const preset = { id: 'advanced-person', label: 'Person', shapes: [{ type: 'path', d: 'M 0 0 L 1 1' }], editor: { advancedShapeRole: 'seatedPerson', layers: [{ id: 1 }], referenceImages: [{ id: 'photo' }] } };
  const removed = JSON.parse(JSON.stringify(removeCustomShapeMembership(preset)));
  assert.equal(removed.editor.advancedShapeRole, undefined);
  assert.equal(removed.stageplotPublished, false);
  assert.deepEqual(removed.shapes, preset.shapes);
  assert.deepEqual(removed.editor.layers, preset.editor.layers);
  assert.deepEqual(removed.editor.referenceImages, preset.editor.referenceImages);
  assert.equal(preset.editor.advancedShapeRole, 'seatedPerson');
});
