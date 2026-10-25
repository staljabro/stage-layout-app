import {useState} from 'react'
import {AccountModal} from './account-modal.jsx'

export function ProjectFileMenu({onNew,onSave,onLoad,onExport,canExport,canCreate,signedIn,cloudProject,onCloudSave}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const run=action=>{setOpen(false);action()}
  const cloudSave=async update=>{setBusy(true);setError('');try{await onCloudSave(update);setOpen(false)}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <><button className="btn primary" onClick={()=>{setError('');setOpen(true)}}>Save / Load</button>{open&&<AccountModal><section className="account-dialog project-file-dialog" role="dialog" aria-modal="true" aria-label="Save and load"><header><h2>Save / Load</h2><button disabled={busy} onClick={()=>setOpen(false)}>Close</button></header>{error&&<p role="alert">{error}</p>}<nav className="project-file-actions">
    {signedIn&&<><button disabled={busy || !cloudProject} onClick={()=>cloudSave(true)}>Update cloud project</button><button disabled={busy} onClick={()=>cloudSave(false)}>Save cloud project</button></>}
    {canCreate&&<button disabled={busy} onClick={()=>run(onNew)}>New Project</button>}
    <button disabled={busy} onClick={()=>run(onLoad)}>Load Project File</button>
    <button disabled={busy} onClick={()=>run(onSave)}>Download Project File</button>
    <button disabled={busy || !canExport} onClick={()=>run(onExport)}>Export PDF</button>
  </nav></section></AccountModal>}</>
}
