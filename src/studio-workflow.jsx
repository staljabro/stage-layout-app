import {useState} from 'react'
import {AccountModal} from './account-modal.jsx'
import {accountRequest} from './account-api.js'

export function SubmissionReview({submissions,targets,onChanged,onClose,onPreview,renderDesign}) {
  const first=submissions[0]
  const [selectedId,setSelectedId]=useState(first?.id || '')
  const submission=submissions.find(s=>s.id===selectedId) || first
  const targetId=submission?.target_id
  const original=targets.find(asset=>asset.id===targetId)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const [note,setNote]=useState('')
  const review=async action=>{
    const target=targets.find(a=>a.id===targetId)
    if(action==='update'&&!target){setError('The original library item is unavailable. You can publish this as a new item.');return}
    if(!window.confirm(action==='decline'?'Decline this submission?':action==='new'?'Publish this as a new library item?':'Update the original library item with this submission?'))return
    setBusy(true);setError('')
    try {
      await accountRequest('/submissions/'+submission.id+'/'+(action==='decline'?'reject':'approve'),'POST',{mode:action==='decline'?undefined:action,targetId:action==='update'?targetId:undefined,targetRevision:target?.revision,snapshotRevision:submission.snapshot.revision,submittedAt:submission.created,note})
      await onChanged();onClose()
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Review submission"><header><h2>Review submission</h2><button disabled={busy} onClick={onClose}>Close</button></header>
    {error&&<p role="alert">{error}</p>}
    {submission ? <>
      {submissions.length>1&&<label>Submission<select value={submission.id} onChange={event=>{setSelectedId(event.target.value);setNote('')}}>{submissions.map(s=><option key={s.id} value={s.id}>{s.snapshot.label} - {s.owner_name || 'Contributor'}</option>)}</select></label>}
      <h3>{submission.snapshot.label}</h3><p>{submission.kind==='items'?'Equipment':'Stage'} submitted by {submission.owner_name || 'a contributor'}. {submission.snapshot.dimensions.widthMeters} x {submission.snapshot.dimensions.depthMeters} m. Profiles: {(submission.snapshot.profiles || []).join(', ') || 'External'}.</p>
      <button disabled={busy} onClick={()=>onPreview(submission.kind,submission.snapshot,submission)}>Open submission in editor</button>
      <div className="submission-comparison">
        {original&&<figure><figcaption>Current library item: {original.label}</figcaption>{renderDesign(submission.kind,original)}<p>{original.dimensions.widthMeters} x {original.dimensions.depthMeters} m</p></figure>}
        <figure><figcaption>Submitted design: {submission.snapshot.label}</figcaption>{renderDesign(submission.kind,submission.snapshot)}<p>{submission.snapshot.dimensions.widthMeters} x {submission.snapshot.dimensions.depthMeters} m</p></figure>
      </div>
      {original?<p>Approving an update changes <strong>{original.label}</strong>. This submission cannot be applied to another item.</p>:<p>This submission has no available original item. Approve it as a new library item.</p>}
      <label>Message to contributor (optional)<input value={note} onChange={event=>setNote(event.target.value)}/></label>
      <p>Your message appears under View feedback beside the contributor's draft after approval or decline.</p>
      <nav><button disabled={busy} onClick={()=>review('new')}>Approve as new item</button><button disabled={busy || !targets.some(a=>a.id===targetId)} onClick={()=>review('update')}>Approve item update</button><button disabled={busy} onClick={()=>review('decline')}>Decline</button></nav>
    </>:<p>No pending submissions.</p>}
  </section></AccountModal>
}
