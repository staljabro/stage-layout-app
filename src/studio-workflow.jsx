import {AccountModal} from './account-modal.jsx'
import {useState} from 'react'
import {accountRequest} from './account-api.js'
import {useAccount} from './accounts.jsx'

export function StudioWorkflow({onChanged,onPreview}) {
  const {user}=useAccount(),isManager=['owner','admin'].includes(user.role)
  const [open,setOpen]=useState(false),[submissions,setSubmissions]=useState([]),[trash,setTrash]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(null)
  const reload=async()=>{const [queue,deleted]=await Promise.all([accountRequest('/submissions'),accountRequest('/trash')]);setSubmissions(queue);setTrash(deleted)}
  const perform=async fn=>{setError('');setBusy(true);try{await fn();await reload();await onChanged()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <><button onClick={()=>{setOpen(true);perform(async()=>{})}}>Submissions &amp; recovery</button>{open&&<AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Submissions and recovery"><header><h2>{isManager?'Review submissions':'My submissions'} &amp; recovery</h2><button onClick={()=>setOpen(false)}>Close</button></header>{error&&<p role="alert">{error}</p>}
    {submissions.map(submission=><div className="account-row" key={submission.id}><span>{submission.snapshot.label}<small>{submission.kind} · {submission.status} · {new Date(submission.created).toLocaleString()}{submission.review_note&&' · '+submission.review_note}</small></span><button onClick={()=>setSelected(submission)}>Details</button>{isManager&&submission.status==='pending'&&<><button disabled={busy} onClick={()=>{if(window.confirm('Publish the submitted revision of '+submission.snapshot.label+' to the shared library?'))perform(()=>accountRequest('/submissions/'+submission.id+'/approve','POST',{}))}}>Approve</button><button disabled={busy} onClick={()=>{const note=window.prompt('Reason for returning this submission:');if(note!==null)perform(()=>accountRequest('/submissions/'+submission.id+'/reject','POST',{note}))}}>Return</button></>}</div>)}
    {!submissions.length&&<p>No submissions yet. Use Submit beside a personal library item when it is ready for review.</p>}
    {selected&&<section><h3>Submitted revision: {selected.snapshot.label}</h3><p>Profiles: {(selected.snapshot.profiles || []).join(', ') || 'External on approval'}. Dimensions: {selected.snapshot.dimensions.widthMeters} × {selected.snapshot.dimensions.depthMeters} m.</p><button onClick={()=>{onPreview(selected.kind,selected.snapshot);setOpen(false)}}>Preview submitted artwork in canvas</button><pre className="account-preview">{JSON.stringify(selected.snapshot,null,2)}</pre><button onClick={()=>setSelected(null)}>Close details</button></section>}
    <h3>Deleted assets</h3>{trash.map(item=><div className="account-row" key={item.kind+item.id}><span>{item.label}<small>{item.kind} · revision {item.revision}</small></span><button disabled={busy} onClick={()=>perform(()=>accountRequest('/'+item.kind+'/'+item.id+'/restore','POST',{revision:item.revision}))}>Restore</button></div>)}{!trash.length&&<p>No deleted assets.</p>}
  </section></AccountModal>}</>
}

export function AssetHistory({kind,asset,onChanged}) {
  const [rows,setRows]=useState(null),[error,setError]=useState('')
  return <><button onClick={async()=>{try{setRows(await accountRequest('/'+kind+'/'+asset.id+'/history'));setError('')}catch(e){setError(e.message)}}}>History</button>{rows&&<AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Asset history"><header><h2>{asset.label} · revisions</h2><button onClick={()=>setRows(null)}>Close</button></header>{error&&<p role="alert">{error}</p>}{rows.map(row=><div className="account-row" key={row.revision}><span>Revision {row.revision}{row.deleted?' · deleted':''}<small>{new Date(row.created).toLocaleString()}</small></span><button onClick={async()=>{if(!window.confirm('Restore this revision as the current design?'))return;try{await accountRequest('/'+kind+'/'+asset.id+'/restore','POST',{revision:row.revision});await onChanged();setRows(null)}catch(e){setError(e.message)}}}>Restore revision</button></div>)}</section></AccountModal>}{error&&!rows&&<small role="alert">{error}</small>}</>
}
