import test from 'node:test'
import assert from 'node:assert/strict'
import {equipmentReportHtml} from './equipment-report.js'

test('PDF requirements include organisation branding, component notes and equipment totals',()=>{
  const html=equipmentReportHtml('Plot <1>',[{name:'Cello',quantity:2,source:'Venue'},{kind:'component',name:'Mic',note:'DPA <4099>',quantity:2,source:''}],true,{name:'Venue & team',logo:'data:image/png;base64,iVBORw0KGgo='},'Stage <2>')
  assert.ok(html.includes('<img src="data:image/png;base64,iVBORw0KGgo="'))
  assert.ok(html.includes('Venue &amp; team'));assert.ok(html.includes('DPA &lt;4099&gt;'));assert.ok(html.includes('class="component"'));assert.ok(html.includes('Total: 2 items'))
  assert.ok(html.includes('<div class="export-details"><div>Venue &amp; team</div><div>Plot &lt;1&gt;</div><div>Stage &lt;2&gt;</div></div>'))
  assert.ok(!equipmentReportHtml('Plot',[],false,{name:'Team',logo:'javascript:bad'}).includes('<img'))
})
