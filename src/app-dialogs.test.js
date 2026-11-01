import test from 'node:test'
import assert from 'node:assert/strict'
import {appConfirm,appPrompt,appAlert,appPreview,currentDialog,finishDialog,subscribeDialogs} from './app-dialogs.js'

test('app dialogs queue requests and preserve cancellation and entered values',async()=>{
  let updates=0;const unsubscribe=subscribeDialogs(()=>updates++)
  const confirm=appConfirm('Delete item?'),prompt=appPrompt('Name','Initial'),alert=appAlert('Saved'),preview=appPreview('Report','<p>Report</p>')
  assert.equal(currentDialog().message,'Delete item?')
  finishDialog(-1,true);assert.equal(currentDialog().kind,'confirm')
  finishDialog(currentDialog().id,false);assert.equal(await confirm,false)
  assert.equal(currentDialog().initial,'Initial');finishDialog(currentDialog().id,'New name');assert.equal(await prompt,'New name')
  finishDialog(currentDialog().id,true);await alert
  assert.equal(currentDialog().initial,'<p>Report</p>');finishDialog(currentDialog().id,false);await preview
  assert.equal(currentDialog(),null);assert.equal(updates,8);unsubscribe()
  const cancel=appPrompt('Cancel me');finishDialog(currentDialog().id,null);assert.equal(await cancel,null)
})
