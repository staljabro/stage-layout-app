import test from 'node:test';
import assert from 'node:assert/strict';
import { readSessionDraft } from './session-draft.js';
test('session recovery restores unsaved documents and safely ignores broken storage', () => {
  const original=globalThis.sessionStorage;
  let stored;
  globalThis.sessionStorage={getItem:()=>stored};
  try {
    const data={items:[{id:123,x:1.5}],activeLibraryId:'chair',shapeName:'Unsaved chair',zones:[],referenceImages:[{dataUrl:'data:image/png;base64,abc'}],zoom:2,pan:{x:12,y:30}};
    stored=JSON.stringify({version:1,data});
    assert.deepEqual(readSessionDraft('studio'),data);
    for (const invalid of [null,'{broken}',JSON.stringify({version:2,data}),JSON.stringify({version:1,data:{items:'invalid'}})]) {
      stored=invalid;
      assert.deepEqual(readSessionDraft('studio'),{});
    }
    globalThis.sessionStorage.getItem=()=>{throw new Error('Storage disabled');};
    assert.deepEqual(readSessionDraft('studio'),{});
  } finally {globalThis.sessionStorage=original;}
});
