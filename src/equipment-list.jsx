import {appPreview} from './app-dialogs.js'
import { Fragment,useEffect, useRef,useState } from 'react'
import { equipmentCsv } from './inventory.js'
import {equipmentReportHtml} from './equipment-report.js'
import {OrganisationBranding} from './organisation-branding.jsx'

export function EquipmentList({project, rows, onClose, trackStock = true, supplyTracking = false,organisation=null,stageName=''}) {
  const dialog = useRef(null),[view,setView]=useState('equipment')
  const equipmentRows=rows.filter(row=>row.kind!=='component'),componentRows=rows.filter(row=>row.kind==='component'),shown=view==='equipment'?equipmentRows:[...equipmentRows.filter(row=>row.showAsComponent&&row.componentQuantity>0).map(row=>({...row,quantity:row.componentQuantity})),...componentRows].sort((a,b)=>(a.category||'Equipment').localeCompare(b.category||'Equipment')||a.name.localeCompare(b.name))
  useEffect(()=>{dialog.current.showModal()},[])
  const exportCsv = () => {
    const link=document.createElement('a')
    link.href=URL.createObjectURL(new Blob([equipmentCsv(rows,trackStock)],{type:'text/csv;charset=utf-8'}))
    link.download=(project.replace(/[^a-z0-9]+/gi,'-') || 'stageplot')+'-equipment.csv'
    link.click()
    setTimeout(()=>URL.revokeObjectURL(link.href),1000)
  }
  const exportPdf = async () => {
    await appPreview('Equipment list',equipmentReportHtml(project,rows,trackStock,organisation,stageName))
  }
  return <dialog className="equipment-list-dialog" ref={dialog} onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="equipment-list-content"><header><h2>Equipment list</h2><button onClick={onClose} aria-label="Close equipment list">×</button></header><OrganisationBranding organisation={organisation}/><p>{project}</p><p>{supplyTracking ? "Venue items are requested from the venue; client-supplied items are brought by the visiting company or group. Fixed house equipment is provided separately." : trackStock ? "Includes hidden equipment. External quantities include stock overflow and placements marked Use external. Stock without a quantity is untracked." : "Includes hidden equipment. Quantities show the equipment required for this event."}</p>
      <nav><button aria-pressed={view==='equipment'} onClick={()=>setView('equipment')}>Equipment</button><button aria-pressed={view==='components'} onClick={()=>setView('components')}>Components</button></nav>
      <table><thead><tr><th>{view==='components'?'Category / item':'Equipment'}</th>{trackStock&&<th>Source</th>}<th>Quantity</th></tr></thead><tbody>{shown.map((row,index)=><Fragment key={row.key}>{view==='components'&&(index===0||shown[index-1]?.category!==row.category)&&<tr className="equipment-component-category"><th colSpan={trackStock?3:2}>{row.category||'Equipment'}</th></tr>}<tr className={row.kind==='component'?'equipment-component-row':undefined}><td>{row.name}{row.note&&<small>{row.note}</small>}</td>{trackStock&&<td>{row.source}</td>}<td>{row.quantity}</td></tr></Fragment>)}</tbody></table>
      {!rows.length&&<p>No equipment added.</p>}<p>Total: {rows.filter(row=>row.kind!=='component').reduce((sum,row)=>sum+row.quantity,0)} items</p>
      <footer><button className="btn ghost" disabled={!rows.length} onClick={exportCsv}>Export CSV</button><button className="btn primary" disabled={!rows.length} onClick={exportPdf}>Export PDF</button></footer>
    </div>
  </dialog>
}
