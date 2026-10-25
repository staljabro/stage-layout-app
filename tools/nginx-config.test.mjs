import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('Nginx configs start directly with the server directive, without a byte-order mark',async()=>{
  for(const name of ['stageplot','studio']) {
    const bytes=await readFile(new URL(`../docker/${name}.nginx.conf`,import.meta.url))
    assert.equal(bytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])),false,`${name} has a UTF-8 BOM that Nginx treats as part of the first directive`)
    assert.match(bytes.toString('utf8'),/^server\s*\{/)
  }
})
