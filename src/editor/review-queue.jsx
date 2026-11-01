import {useState} from 'react'
export function ReviewQueue({submissions,search='',onReview}) {
  const [filter,setFilter]=useState('all')
  const pending=submissions.filter(submission=>submission.status==='pending')
  const visible=pending.filter(submission=>(filter==='all'||(filter==='update')===Boolean(submission.isUpdate))&&(submission.snapshot.label+' '+(submission.owner_name||'')).toLowerCase().includes(search.trim().toLowerCase()))
  return <section className="equipment-review-queue"><label>Submission type<select aria-label="Submission type" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All submissions ({pending.length})</option><option value="new">New items ({pending.filter(item=>!item.isUpdate).length})</option><option value="update">Item updates ({pending.filter(item=>item.isUpdate).length})</option></select></label>{visible.map(submission=><div className="new-submission-row" key={submission.id}><span>{submission.snapshot.label}<small>{submission.isUpdate?'Item update':'New item'}</small></span><small>{submission.owner_name||'Contributor'}</small><button onClick={()=>onReview([submission.id])}>Review submission</button></div>)}{!visible.length&&<p className="empty">{pending.length?'No submissions match your filters.':'No submissions awaiting review.'}</p>}</section>
}
