import {workspaceRoute} from './navigation.js'
import {lazy,Suspense,useEffect,useRef,useState} from 'react'
import {accountRequest} from './account-api.js'
import {stageSpace,projectFile,resolveProject} from './project-file.js'
import {pinProject} from './project-snapshots.js'
import EventDashboard from './workspace-dashboard.jsx'
import {EventHeader} from './workspace-ui.jsx'
import {go,statusLabels} from './workspace-model.js'
import {StageAccessDialog,StageShareLanding} from './stage-access.jsx'
import {EventInvitation} from './event-invitation.jsx'
import './events.css'
const Canvas=lazy(()=>import('./editor/stage-outline-editor.jsx'))
const opening=<div className="events-loading" role="status">Opening stage and equipment editor...</div>
export default function EventsApp() {
  const route=workspaceRoute(window.location.search)
  if(route.screen==='invitation')return <EventInvitation token={route.token}/>
  if(route.screen==='stage-share')return <StageShareLanding token={route.token}/>
  if(route.screen==='layout')return <BandEditor guestToken={route.guestToken} plotId={route.plotId}/>
  if(route.screen==='stage')return <StageEditor stageId={route.stageId} reusable={route.reusable} stockMode={route.mode==='stock'}/>
  return <EventDashboard eventId={route.eventId} view={route.view}/>
}
function BandEditor({guestToken,plotId}) {
  const [document,setDocument]=useState(null),[error,setError]=useState('')
  const revision=useRef(null),endpoint=guestToken?'/band-links/'+guestToken:'/event-bands/'+plotId
  useEffect(()=>{let active=true;accountRequest(endpoint).then(value=>{if(active){revision.current=value.revision;setDocument(value)}}).catch(error=>{if(active)setError(error.message)});return()=>{active=false}},[endpoint])
  if(error)return <div className="events-shell"><EventHeader/><main className="events-main"><h1>Unable to open this layout</h1><p role="alert">{error}</p><p>Ask the organiser for a current edit link.</p></main></div>
  if(!document)return opening
  const stage=document.data.assetSnapshots.stage,space=stageSpace(stage),resolved=resolveProject(document.data,document.equipment||[],[])
  const save=async(design,submit)=>{const data=pinProject({...projectFile(document.name,space,design.layoutEquipment,'',{},design.layoutFolders||[]),profile:document.profile},space,design.layoutEquipment);const saved=await accountRequest(endpoint,'PUT',{data,notes:design.notes,submit,revision:revision.current});revision.current=saved.revision;setDocument(old=>({...old,...saved}))}
  return <Suspense fallback={opening}><Canvas key={document.id} embeddedStage={{sessionId:'layout-'+document.id,data:stage,equipment:document.equipment||[],groups:document.groups||[],layoutEquipment:resolved.items,layerFolders:resolved.layerFolders,layoutName:document.name,notes:document.notes,reviewNote:document.reviewNote,statusLabel:(statusLabels[document.status]||'')+' / revision '+document.revision,guest:Boolean(guestToken),canEditStage:false,autosave:true,onSave:save,backLabel:document.kind==='production'?'Back to production':'Back to event',onBack:()=>go({event:document.eventId})}}/></Suspense>
}
function StageEditor({stageId,reusable,stockMode}) {
  const endpoint=(reusable?'/spaces/':'/event-stages/')+stageId
  const [stage,setStage]=useState(null),[equipment,setEquipment]=useState([]),[groups,setGroups]=useState([]),[error,setError]=useState(''),[share,setShare]=useState(false)
  const version=useRef(null)
  useEffect(()=>{let active=true;(async()=>{try{const stage=await accountRequest(endpoint);const [equipment,groups]=await Promise.all([accountRequest('/items?profile='+stage.data.profiles[0]),accountRequest('/groups')]);if(active){version.current=stage.version;setStage(stage);setEquipment(equipment);setGroups(groups)}}catch(error){if(active)setError(error.message)}})();return()=>{active=false}},[endpoint])
  if(error)return <div className="events-shell"><EventHeader/><main className="events-main"><h1>Unable to open this stage</h1><p role="alert">{error}</p></main></div>
  if(!stage)return opening
  if(reusable&&stage.permission==='use')return <div className="events-shell"><EventHeader/><main className="events-main"><h1>{stage.name}</h1><p>This stage is shared with you for use in your own events and productions. Your copies can be edited independently.</p><button onClick={()=>go({view:'spaces'})}>Use this stage from Stages</button></main></div>
  const save=async input=>{const {layoutEquipment,...data}=input;void layoutEquipment;const saved=await accountRequest(endpoint,'PUT',{data,version:version.current});version.current=saved.version;setStage(old=>({...old,...saved}))}
  return <><Suspense fallback={opening}><Canvas key={stage.id} embeddedStage={{data:stage.data,equipment,groups,notes:stage.data.notes||'',canEditStage:true,stockMode,onSave:save,onShare:reusable&&stage.permission==='manage'?()=>setShare(true):null,backLabel:reusable?'Back to stages':'Back to event',onBack:()=>reusable?go({view:'spaces'}):go({event:stage.eventId})}}/></Suspense>{share&&<StageAccessDialog stage={stage} onClose={()=>setShare(false)}/>}</>
}
