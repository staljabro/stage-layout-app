import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeText, textLayout, textSvg } from './text-layout.js';

test('text bounds follow the widest line and line spacing', () => {
  const previousDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({measureText:line=>({width:line.length*50,actualBoundingBoxLeft:0,actualBoundingBoxRight:line.length*50,actualBoundingBoxAscent:75,actualBoundingBoxDescent:25})})})};
  try {
    const item={text:'Wide\nx',fontSize:.2,lineSpacing:1.5,fill:'#000000',textAlign:'right'};
    const sized=sizeText(item);
    assert.equal(sized.width,.4);
    assert.equal(sized.height,.5);
    assert.equal(textLayout({...item,textAlign:'center'}).width,sized.width);
    assert.ok(textSvg(item).includes('x="0.30000000000000004"'));
    assert.ok(textSvg({...item,text:'< & "',bold:true,italic:true}).includes('&lt; &amp; &quot;'));
    assert.equal(sizeText({...item,fontSize:.4}).width,.8);
  } finally { globalThis.document=previousDocument; }
});
