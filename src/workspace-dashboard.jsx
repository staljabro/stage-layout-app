import {appConfirm} from './app-dialogs.js'
import {StageAccessDialog} from './stage-access.jsx'
import {WorkspaceListings} from './workspace-listings.jsx'
import {EventOverview} from './event-overview.jsx'
import {WorkspaceDialogs} from './workspace-dialogs.jsx'
import {WorkspaceCreate} from './workspace-create.jsx'
import {useCallback,useEffect,useState} from 'react'
import {useAccount} from './accounts.jsx'
import {accountRequest} from './account-api.js'
import {workspaceLabels} from './workspace-labels.js'
import {EventHeader} from './workspace-ui.jsx'
import {createEmptyStage,go,editLink} from './workspace-model.js'

const capital=value=>value[0].toUpperCase()+value.slice(1)

export default function EventDashboard({eventId,view}) {
  const {user,showAccount}=useAccount()
  const [events,setEvents]=useState([]),[spaces,setSpaces]=useState([]),[event,setEvent]=useState(null),[loading,setLoading]=useState(true)
  const [dialog,setDialog]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const [name,setName]=useState(''),[date,setDate]=useState(''),[endDate,setEndDate]=useState(''),[notes,setNotes]=useState(''),[profile,setProfile]=useState('external')
  const [kind,setKind]=useState('festival'),[client,setClient]=useState(''),[venue,setVenue]=useState('')
  const [width,setWidth]=useState(12),[depth,setDepth]=useState(8),[stageId,setStageId]=useState(''),[sourceId,setSourceId]=useState(''),[sourcePlotId,setSourcePlotId]=useState('')
  const [names,setNames]=useState(''),[slot,setSlot]=useState(''),[search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('')
  const [equipmentReviews,setEquipmentReviews]=useState(0),[reviewError,setReviewError]=useState('')
  const [history,setHistory]=useState([]),[preview,setPreview]=useState(null)
  const labels=workspaceLabels(event?.kind)
  const production=event?.kind==='production'
  const activeView=production?'productions':eventId?'events':view
  const refresh=useCallback(async()=>{
    if(!user)return
    const [list,catalogue,detail]=await Promise.all([accountRequest('/events'),accountRequest('/spaces'),eventId?accountRequest('/events/'+eventId):null])
    setEvents(list);setSpaces(catalogue);if(detail)setEvent(detail)
    const results=await Promise.allSettled([['owner','admin'].includes(user.role)?accountRequest('/submissions'):Promise.resolve([])])
    if(results[0].status==='fulfilled'){setEquipmentReviews(results[0].value.filter(item=>item.status==='pending'&&item.kind==='items').length);setReviewError('')}else setReviewError(results[0].reason.message)
  },[eventId,user])
  useEffect(()=>{let active=true;const load=async()=>{try{await refresh()}catch(e){if(active)setError(e.message)}finally{if(active)setLoading(false)}};load();return()=>{active=false}},[refresh])
  const run=async action=>{setBusy(true);setError('');try{await action();await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const open=(type,subject=null)=>{
    setError('');setName(type==='duplicate'?`${subject.name} copy`:subject?.name||'');setNotes(type==='review'?subject?.reviewNote||'':type==='duplicate'?subject?.notes||'':'');setDate(event?.date||'');setEndDate(event?.endDate||'');setClient(event?.client||'');setVenue(subject?.venue||'');setSlot(subject?.slot||'');setNames('');setPreview(null)
    setStageId(subject?.stageId||event?.stages[0]?.id||'');setSourceId('');setSourcePlotId(type==='duplicate'?subject.id:'');setDialog({type,subject})
  }
  const create=async e=>{e.preventDefault();await run(async()=>{
    const type=dialog.type
    if(type==='event'||type==='production'){
      const value=await accountRequest(type==='production'?'/productions':'/events','POST',{name,date,endDate,notes,profile,kind,client,spaceId:sourceId||undefined})
      go({event:value.id});return
    }
    if(type==='space'){
      const value=await accountRequest('/spaces','POST',{profile,venue,data:createEmptyStage({label:name,width:Number(width),depth:Number(depth)})});go({space:value.id});return
    }
    if(type==='stage'){
      const payload=sourceId.startsWith('space:')?{spaceId:sourceId.slice(6),name}:{data:{...(sourceId?(await accountRequest('/event-stages/'+sourceId)).data:createEmptyStage({label:name,width:Number(width),depth:Number(depth)})),label:name}}
      const value=await accountRequest('/events/'+eventId+'/stages','POST',payload);go({eventStage:value.id});return
    }
    if(['layout','bulk','duplicate'].includes(type))await accountRequest('/events/'+eventId+'/bands','POST',{name,stageId,notes,slot,sourcePlotId:sourcePlotId||undefined,...(type==='bulk'?{names:names.split(/\r?\n/).map(value=>value.trim()).filter(Boolean)}:{})})
    if(type==='details')await accountRequest('/events/'+eventId,'PUT',{name,date,endDate,notes,client,revision:event.revision})
    if(type==='rename')await accountRequest('/event-bands/'+dialog.subject.id+'/rename','POST',{name,slot,revision:dialog.subject.revision})
    if(type==='save-space'){const shared=await accountRequest('/event-stages/'+dialog.subject.id+'/save-space','POST',{name,venue,version:dialog.subject.version});setDialog({type:'share',subject:shared});return}
    setDialog(null)
  })}
  const copy=layout=>run(async()=>{try{await navigator.clipboard.writeText(editLink(layout));setNotice(`${capital(labels.singular)} edit link copied`)}catch{setDialog({type:'link',subject:layout})}})
  const resetLink=(layout,disable=false)=>run(async()=>{if(!(await appConfirm(disable?'Revoke this edit link? The saved layout will remain in your account.':'Replace this edit link? The old link will stop working.')))return;await accountRequest('/event-bands/'+layout.id+'/link','POST',{revision:layout.revision,disable});setNotice(disable?'Edit link revoked':'New edit link created')})
  const review=(layout,status)=>run(async()=>{await accountRequest('/event-bands/'+layout.id+'/review','POST',{revision:layout.revision,status,note:notes});setDialog(null)})
  const showHistory=layout=>run(async()=>{setHistory(await accountRequest('/event-bands/'+layout.id+'/history'));setDialog({type:'history',subject:layout})})
  const showUpdate=layout=>run(async()=>{setPreview(await accountRequest('/event-bands/'+layout.id+'/stage-preview'));setDialog({type:'stage-update',subject:layout})})
  const showSpaceUpdate=stage=>run(async()=>{setPreview(await accountRequest('/event-stages/'+stage.id+'/space-preview'));setDialog({type:'space-update',subject:stage})})
  const move=(layout,delta)=>run(async()=>{
    const ids=event.bands.map(value=>value.id),index=ids.indexOf(layout.id),target=index+delta
    if(target<0||target>=ids.length)return
    ;[ids[index],ids[target]]=[ids[target],ids[index]]
    await accountRequest('/events/'+eventId+'/order','POST',{revision:event.revision,ids})
  })
  const matching=events.filter(item=>(activeView==='productions')===(item.kind==='production')).filter(item=>`${item.name} ${item.client}`.toLowerCase().includes(search.toLowerCase()))
  const layouts=(event?.bands||[]).filter(layout=>`${layout.name} ${layout.slot}`.toLowerCase().includes(search.toLowerCase())&&(!statusFilter||layout.status===statusFilter))
  const formType=dialog?.type
  const titles={event:'Create event',production:'Create production',space:'Create stage',stage:'Build a stage',layout:`Add ${labels.singular}`,bulk:`Add ${labels.plural}`,duplicate:'Copy starting layout',details:production?'Production details':'Event details',rename:`${capital(labels.singular)} details`,review:`Review ${labels.singular} layout`,history:'Saved revisions','stage-update':'Apply stage update','space-update':'Update from reusable space','save-space':'Save stage for sharing',link:'Edit link'}
  return <div className="events-shell"><EventHeader/><main className="events-main">
    <nav className="workspace-tabs" aria-label="Workspace sections">{[['home','Workspace'],['events','Events'],['productions','Productions'],['spaces','Stages']].map(([id,label])=><a key={id} aria-current={activeView===id?'page':undefined} href={'?view='+id}>{label}</a>)}</nav>
    <div className="events-heading"><div><p className="events-kicker">YOUR PRODUCTION WORKSPACE</p><h1>{event?.name||({home:'Your workspace',events:'My events',productions:'Productions',spaces:'Stages'})[activeView]}</h1><p>{event?(production?'One client layout in an established venue space.':event.kind==='eisteddfod'?'One event, a shared stage, and a separate layout for every group.':'Build your stages, invite each band, and review their requirements.'):activeView==='home'?'Continue your work, review submitted layouts, or start something new.':activeView==='spaces'?'Maintain your regular venue spaces once and use them across clients and events.':activeView==='productions'?'Client productions in the spaces you use every day.':'Festivals, eisteddfods and other events with multiple visiting acts.'}</p></div>{user&&<div className="events-heading-actions">{event?<><button onClick={()=>go({view:activeView})}>{production?'All productions':'All events'}</button><button disabled={busy} onClick={()=>run(async()=>{})}>Refresh</button><button onClick={()=>{open('details');setName(event.name);setNotes(event.notes)}}>{production?'Production details':'Event details'}</button></>:<button className="event-primary" onClick={()=>setDialog({type:'create'})}>+ Create</button>}</div>}</div>
    {error&&<p className="event-error" role="alert">{error}</p>}{notice&&<p className="event-notice" role="status">{notice}</p>}
    {!user?<section className="event-welcome"><h2>Your spaces, visiting clients and group layouts in one place.</h2><p>Build your venue spaces, prepare productions, or invite twenty groups to use one eisteddfod stage.</p><button className="event-primary" onClick={showAccount}>Sign in to organise your workspace</button></section>:loading?<p role="status">Loading your workspace...</p>:!eventId?<>
      <WorkspaceListings {...{equipmentReviews,reviewError,open,activeView,events,matching,search,setDialog,setSearch,spaces}}/>
    </>:event&&<>
      <EventOverview onChanged={refresh} {...{event,open,busy,copy,labels,layouts,move,production,resetLink,search,setSearch,setStatusFilter,showHistory,showSpaceUpdate,showUpdate,statusFilter}}/>
    </>}
  </main>
  {dialog?.type==='create'&&<WorkspaceCreate onClose={()=>setDialog(null)} onChoose={type=>{setKind(type==='eisteddfod'?'eisteddfod':'festival');open(type==='festival'||type==='eisteddfod'?'event':type);if(dialog.subject){setSourceId(dialog.subject.id);setProfile(dialog.subject.profile)}}}/>}
  {dialog?.type==='share'&&<StageAccessDialog stage={dialog.subject} onClose={()=>setDialog(null)}/>}
  {dialog&& !['create','share'].includes(dialog.type)&&<WorkspaceDialogs {...{open,history,event,name,accountRequest,busy,client,create,date,depth,dialog,editLink,endDate,error,events,formType,kind,labels,names,notes,preview,production,profile,review,run,setClient,setDate,setDepth,setDialog,setEndDate,setKind,setName,setNames,setNotes,setProfile,setSlot,setSourceId,setSourcePlotId,setStageId,setVenue,setWidth,slot,sourceId,sourcePlotId,spaces,stageId,titles,user,venue,width}}/>}
  </div>
}
