import {useState} from 'react'
import {useAccount,AccountButton} from '../accounts.jsx'
import {AppMark} from '../app-mark.jsx'
import {Dialog} from '../workspace-ui.jsx'
import {link,go} from './api.js'

export function Shell({view='home',organisations=[],organisationId='',children}) {
  const {user}=useAccount()
  const nav=[['home','Dashboard'],['stages','Stages'],['layouts','Layouts'],['equipment','Equipment'],['organisations','Organisations'],['public','Public library'],['public-stages','Public stages'],...(['owner','admin'].includes(user?.role)?[['reviews','Public reviews']]:[]),...(user?.role==='owner'?[['imports','Import & restore']]:[])]
  return <div className="workbench-shell"><header className="workbench-header"><a className="workbench-brand" href={link()}><AppMark/><span>STAGEPLOT<small>YOUR STAGES. YOUR EQUIPMENT.</small></span></a><div className="workbench-header-actions">{user&&<select aria-label="Workspace" value={organisationId} onChange={event=>go({view,organisation:event.target.value})}><option value="">Personal workspace</option>{organisations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select>}<AccountButton/></div></header><div className="workbench-body">{user&&<aside className="workbench-sidebar"><p>{organisationId?organisations.find(org=>org.id===organisationId)?.name:'My workspace'}</p><nav aria-label="Main navigation">{nav.map(([id,label])=><a key={id} aria-current={view===id?'page':undefined} href={link({view:id,organisation:organisationId})}>{label}</a>)}</nav><small>Private first.<br/>Share with your team.<br/>Publish when approved.</small></aside>}<main className="workbench-main">{children}</main></div></div>
}
export function Heading({eyebrow,title,description,children}) {return <div className="workbench-heading"><div>{eyebrow&&<p className="workbench-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="workbench-actions">{children}</div></div>}
export function Empty({title,children}) {return <section className="workbench-empty"><h2>{title}</h2>{children}</section>}
export function ErrorNotice({error}) {return error?<p className="workbench-error" role="alert">{error}</p>:null}
export function OrgChoices({organisations,value,onChange}) {return organisations.length?<fieldset className="organisation-choices"><legend>Share with organisations (optional)</legend>{organisations.map(org=><label key={org.id}><input type="checkbox" checked={value.includes(org.id)} onChange={event=>onChange(event.target.checked?[...value,org.id]:value.filter(id=>id!==org.id))}/>{org.name}</label>)}</fieldset>:null}
export function NameDialog({title,label='Name',initial='',description,onSubmit,onClose,children}) {
  const [name,setName]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('')
  return <Dialog title={title} onClose={()=>{if(!busy)onClose()}}><form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await onSubmit(name)}catch(error){setError(error.message);setBusy(false)}}}>{description&&<p>{description}</p>}<ErrorNotice error={error}/><label>{label}<input autoFocus required maxLength="200" value={name} onChange={event=>setName(event.target.value)}/></label>{children}<button className="workbench-primary" disabled={busy}>{busy?'Saving...':'Continue'}</button></form></Dialog>
}
