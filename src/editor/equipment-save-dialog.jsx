import {useState} from 'react'
import {Dialog} from '../workspace-ui.jsx'

export function EquipmentSaveDialog({equipment,organisations,review,busy,error,onSave,onClose}) {
  const [organisationIds,setOrganisationIds]=useState(equipment.organisationIds||[]),[submit,setSubmit]=useState(false),[feedback,setFeedback]=useState(review?.feedback||'')
  return <Dialog title={review?'Review equipment':'Save equipment'} onClose={()=>{if(!busy)onClose()}}>
    {error&&<p className="event-error" role="alert">{error}</p>}
    {review?<><p>{review.returned?"This equipment is withdrawn from the public library. Approve it to republish this reviewed version with the same public ID.":"Review changes apply to this proposal. The creator's private original is preserved."}</p><label>Feedback<textarea value={feedback} maxLength="2000" onChange={event=>setFeedback(event.target.value)}/></label><nav><button disabled={busy} onClick={()=>onSave({action:'save',feedback})}>Save review edits</button><button className="event-primary" disabled={busy} onClick={()=>onSave({action:'approve',feedback})}>Approve public equipment</button><button disabled={busy} onClick={()=>onSave({action:'decline',feedback})}>Decline submission</button></nav></>:<>
      <p>{equipment.public?'You are updating this public equipment record directly.':'Your equipment is private by default. Saving never publishes it automatically.'}</p>
      {equipment.canShare!==false&&organisations.length>0&&<fieldset><legend>Share privately with organisations</legend>{organisations.map(org=><label className="save-organisation-option" key={org.id}><input type="checkbox" checked={organisationIds.includes(org.id)} onChange={event=>setOrganisationIds(ids=>event.target.checked?[...ids,org.id]:ids.filter(id=>id!==org.id))}/>{org.name}</label>)}</fieldset>}
      {!equipment.public&&<><label className="save-organisation-option"><input type="checkbox" checked={submit} onChange={event=>setSubmit(event.target.checked)}/>Submit to the public library</label><p className="dialog-note">An app Admin or Owner will review the submitted version. Your private original remains yours.</p></>}
      <button className="event-primary" disabled={busy} onClick={()=>onSave({organisationIds:equipment.canShare===false?undefined:organisationIds,submit})}>{busy?'Saving...':equipment.public?'Save public equipment':submit?'Save and submit for review':'Save private equipment'}</button>
    </>}
  </Dialog>
}
