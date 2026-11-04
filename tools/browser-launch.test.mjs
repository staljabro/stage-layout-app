import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import {stopBrowser} from './browser-launch.mjs'

test('browser cleanup releases stderr retained by descendants after the browser exits',{timeout:5000},async()=>{
  const child=Object.assign(new EventEmitter(),{pid:123,exitCode:0,signalCode:null,stderr:new PassThrough()})
  await stopBrowser(child)
  assert.equal(child.stderr.destroyed,true,'cleanup does not wait for descendant pipe closure')
})

test('browser cleanup waits for exit without requiring a close event',{timeout:5000},async()=>{
  const child=Object.assign(new EventEmitter(),{pid:123,exitCode:null,signalCode:null,stderr:new PassThrough(),kill(){this.signalCode='SIGTERM';queueMicrotask(()=>this.emit('exit',null,'SIGTERM'))}})
  await stopBrowser(child)
  assert.equal(child.signalCode,'SIGTERM')
  assert.equal(child.stderr.destroyed,true)
})
