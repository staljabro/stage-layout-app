import {useState} from 'react'
import {request} from './api.js'
export function OrganisationQuantity({item,organisationId,quantity,editable,onChanged}) {
  const [draft,setDraft]=useState(quantity??''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const save=async()=>{
    const next=draft===''?null:Number(draft)
    if(next===(quantity??null)||!editable)return
    if(next!==null&&(!Number.isSafeInteger(next)||next<0)){setError('Enter a whole quantity of zero or more, or leave blank.');return}
    setBusy(true);setError('')
    try{await request('/organisations/'+organisationId+'/stock','PUT',{assetId:item.id,quantity:next});await onChanged()}catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <label className="organisation-inline-quantity">Organisation quantity<input type="number" aria-label={'Organisation quantity: '+item.label} min="0" step="1" placeholder="Untracked" value={draft} readOnly={!editable} disabled={busy} onChange={event=>setDraft(event.target.value)} onBlur={save} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}}}/>{error&&<small role="alert">{error}</small>}</label>
}
