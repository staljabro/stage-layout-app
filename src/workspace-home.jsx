import {useAccount} from './accounts.jsx'
import {studioLink} from './navigation.js'
import {go,when,statusLabels} from './workspace-model.js'

export function WorkspaceHome({events,spaces,onCreate,search='',equipmentReviews=0,reviewError=''}) {
  const {user,studioUrl}=useAccount()
  const query=search.trim().toLowerCase()
  const reviews=events.flatMap(event=>event.bands.filter(layout=>['submitted','changed'].includes(layout.status)).map(layout=>({...layout,event})))
  const visibleReviews=reviews.filter(layout=>(layout.name+' '+layout.event.name).toLowerCase().includes(query))
  const recent=[...events.map(event=>({id:event.id,name:event.name,type:event.kind==='production'?'Production':event.kind==='eisteddfod'?'Eisteddfod':'Festival',updated:event.bands.reduce((value,layout)=>layout.updated>value?layout.updated:value,event.updated||event.created||''),open:()=>go({event:event.id})})),...spaces.map(space=>({id:space.id,name:space.name,type:'Stage',updated:space.updated,open:()=>go(space.permission==='use'?{view:'spaces'}:{space:space.id})}))].filter(item=>(item.name+' '+item.type).toLowerCase().includes(query)).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||''))).slice(0,8)
  return <>
    <div className="workspace-summary"><div><strong>{events.length}</strong><span>Events & productions</span></div><div><strong>{spaces.length}</strong><span>Reusable spaces</span></div><div><strong>{reviews.length}</strong><span>Layouts ready to review</span></div></div>
    <section className="event-section"><div className="event-section-heading"><h2>Ready to review</h2>{studioUrl&&['owner','admin'].includes(user?.role)&&<a className="workspace-review-link" href={studioLink(studioUrl,window.location.href,'reviews')}>Equipment review queue ({equipmentReviews})</a>}</div>{reviewError&&<p className="event-error" role="alert">{reviewError}</p>}{reviews.length?<div className="workspace-review-list">{visibleReviews.map(layout=><button key={layout.id} onClick={()=>go({event:layout.event.id})}><span><b>{layout.name}</b><small>{layout.event.name}</small></span><span className={'band-status '+layout.status}>{statusLabels[layout.status]}</span><span>Review layout</span></button>)}{!visibleReviews.length&&<p className="workspace-muted">No review tasks match your search.</p>}</div>:<p className="workspace-muted">No layouts waiting for review. Submitted layouts will appear here.</p>}</section>
    <section className="event-section"><div className="event-section-heading"><h2>Recent work</h2><button onClick={onCreate}>Create something new</button></div>{recent.length?<div className="event-grid">{recent.map(item=><button className="event-card" key={item.type+item.id} onClick={item.open}><small>{item.type}</small><h2>{item.name}</h2><p>{when(item.updated)}</p><b>Continue</b></button>)}</div>:<div className="event-empty compact"><h3>{query?'No matching work.':'Start with your next event or production.'}</h3><p>Create a reusable space, invite a client or group.</p><button className="event-primary" onClick={onCreate}>Create</button></div>}</section>
  </>
}
