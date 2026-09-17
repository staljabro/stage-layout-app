import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToVector, vectorPath } from './vector-conversion.js';
test('conversion preserves placement, dimensions and styling', () => {
  for(const type of ['rect','roundRect','triangle','line']) {
    const original={type,width:.6,height:.4,x:1,y:2,rotation:45,fill:'#ffffff',stroke:'#000000'};
    const result=convertToVector(original);
    assert.equal(result.type,'vector');
    for(const key of ['width','height','x','y','rotation','stroke']) assert.equal(result[key],original[key]);
    assert.ok(vectorPath(result).startsWith('M '));
  }
});
test('lines remain open and rounded corners remain editable curves', () => {
  const line=convertToVector({type:'line',width:1,height:.03});
  assert.equal(line.nodes.length,2);
  assert.equal(line.open,true);
  assert.ok(!vectorPath(line).includes('Z'));
  const rounded=convertToVector({type:'roundRect',width:1,height:.5});
  assert.equal(rounded.nodes.filter(node=>node.curveMode==='bezier').length,4);
  assert.ok(vectorPath(rounded).endsWith('Z'));
});
