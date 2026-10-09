import { useEffect, useRef } from 'react'
import { equipmentCsv } from './inventory.js'

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))

export function EquipmentList({project, rows, onClose}) {
  const dialog = useRef(null)
  useEffect(()=>{dialog.current.showModal()},[])
  const exportCsv = () => {
    const link=document.createElement('a')
    link.href=URL.createObjectURL(new Blob([equipmentCsv(rows)],{type:'text/csv;charset=utf-8'}))
    link.download=(project.replace(/[^a-z0-9]+/gi,'-') || 'stageplot')+'-equipment.csv'
    link.click()
    setTimeout(()=>URL.revokeObjectURL(link.href),1000)
  }
  const exportPdf = () => {
    const report=window.open('','_blank','width=900,height=700')
    if (!report) {window.alert('Allow popups to open the equipment PDF print preview.');return}
    report.opener=null
    report.document.write(`<!doctype html><html><head><title>${escapeHtml(project)} — Equipment list</title><style>@page{size:A4 portrait;margin:16mm}body{font:12pt Arial,sans-serif;color:#222}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #bbb;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}td:last-child,th:last-child{text-align:right}</style></head><body><h1>${escapeHtml(project)}</h1><h2>Equipment list</h2><table><thead><tr><th>Equipment</th><th>Source</th><th>Quantity</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.source)}</td><td>${row.quantity}</td></tr>`).join('')}</tbody></table><p>Total: ${rows.reduce((sum,row)=>sum+row.quantity,0)} items</p></body></html>`)
    report.document.close()
    report.focus()
    report.print()
  }
  return <dialog className="equipment-list-dialog" ref={dialog} onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="equipment-list-content"><header><h2>Equipment list</h2><button onClick={onClose} aria-label="Close equipment list">×</button></header><p>{project}</p><p>Includes hidden equipment. External quantities include stock overflow and placements marked Use external. Stock without a quantity is untracked.</p>
      <table><thead><tr><th>Equipment</th><th>Source</th><th>Quantity</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><td>{row.name}</td><td>{row.source}</td><td>{row.quantity}</td></tr>)}</tbody></table>
      {!rows.length&&<p>No equipment added.</p>}<p>Total: {rows.reduce((sum,row)=>sum+row.quantity,0)} items</p>
      <footer><button className="btn ghost" disabled={!rows.length} onClick={exportCsv}>Export CSV</button><button className="btn primary" disabled={!rows.length} onClick={exportPdf}>Export PDF</button></footer>
    </div>
  </dialog>
}
