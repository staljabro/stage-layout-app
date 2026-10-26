import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {accountRequest} from './account-api.js'
import Planner from './App.jsx'
import stageEditorStyles from '../tools/svg-shape-studio/src/styles.css?raw'
import {stageSpace,projectFile,resolveProject} from './project-file.js'
import {pinProject} from './project-snapshots.js'
import {stageFromLayout} from './stage-equipment.js'
import {workspaceLabels} from './workspace-labels.js'
import EventDashboard from './workspace-dashboard.jsx'
import {EventHeader} from './workspace-ui.jsx'
import {go,statusLabels} from './workspace-model.js'
import {VenueEquipment} from './venue-equipment.jsx'
import './events.css'

const StageEditor=lazy(()=>import('../tools/svg-shape-studio/src/App.jsx'))
const scopedEditorStyles=`@scope (.stage-setup-editor) { ${stageEditorStyles.replace(/@import[^;]+;/g,'')} }`

export default function EventsApp() {
  const params=new URLSearchParams(window.location.search)
  if(params.has('band')||params.has('plot'))return <BandEditor guestToken={params.get('band')} plotId={params.get('plot')}/>
  if(params.has('eventStage')||params.has('space'))return <EventStageEditor stageId={params.get('eventStage')||params.get('space')} reusable={params.has('space')} equipmentMode={params.get('mode')==='equipment'} inventoryMode={params.get('mode')==='stock'}/>
  if(params.has('draw')||params.has('stage')||params.has('project'))return <Planner/>
  return <EventDashboard eventId={params.get('event')} view={params.get('view')||'events'}/>
}

function BandEditor({guestToken,plotId}) {
  const [document,setDocument]=useState(null),[error,setError]=useState('')
  const revision=useRef(null)
  const endpoint=guestToken?'/band-links/'+guestToken:'/event-bands/'+plotId
  useEffect(()=>{let active=true;const load=async()=>{try{const value=await accountRequest(endpoint);if(active){revision.current=value.revision;setDocument(value)}}catch(e){if(active)setError(e.message)}};load();return()=>{active=false}},[endpoint])
  const save=useCallback(async(data,notes,submit)=>{const value=await accountRequest(endpoint,'PUT',{data,notes,submit,revision:revision.current});revision.current=value.revision;setDocument(old=>({...old,revision:value.revision,status:value.status,reviewNote:value.reviewNote,updated:value.updated}))},[endpoint])
  const workspace=useMemo(()=>document?{id:'band-'+document.id,revision:document.revision,guest:Boolean(guestToken),data:document.data,equipment:document.equipment||[],groups:document.groups||[],profile:document.profile,eventName:document.eventName,stageName:document.stageName,backLabel:document.kind==='production'?'Back to production':'Back to event',notesLabel:workspaceLabels(document.kind).notes,participant:workspaceLabels(document.kind).singular,kind:document.kind,slot:document.slot,supplyTracking:document.kind!=='festival'||Boolean(document.data.assetSnapshots?.stage?.availableEquipment?.length),notes:document.notes,reviewNote:document.reviewNote,statusLabel:statusLabels[document.status],mode:'band',autosave:true,loadEquipment:async()=>(await accountRequest(endpoint)).equipment,onSave:save,onBack:()=>guestToken?go({band:guestToken}):go({event:document.eventId})}:null,[document,guestToken,save,endpoint])
  if(error)return <div className="events-shell"><EventHeader/><main className="events-main"><h1>Unable to open this plot</h1><p role="alert">{error}</p><p>Ask the organiser for a current link if you are a band member.</p></main></div>
  if(!document)return <div className="events-loading" role="status">Opening band plot...</div>
  return <Planner key={document.id} workspace={workspace}/>
}

function stageEquipmentPlot(stage) {
  const data={...stage.data,fixedEquipment:[]},space=stageSpace(data)
  const items=(stage.data.fixedEquipment||[]).map((item,index)=>{const assetId=item.assetId||'house-'+item.id;return {...item,id:index+100,assetId,type:'library:'+assetId,dimensions:{widthMeters:item.widthMeters,depthMeters:item.depthMeters},profiles:stage.data.profiles}})
  return pinProject({...projectFile(stage.name,space,items),profile:stage.data.profiles[0]},space,items)
}

function EventStageEditor({stageId,equipmentMode,inventoryMode,reusable=false}) {
  const endpoint=(reusable?'/spaces/':'/event-stages/')+stageId;
  const [stage,setStage]=useState(null),[equipment,setEquipment]=useState([]),[groups,setGroups]=useState([]),[error,setError]=useState('')
  const version=useRef(null)
  useEffect(()=>{let active=true;const load=async()=>{try{const value=await accountRequest(endpoint);const [items,groupData]=await Promise.all([accountRequest('/items?profile='+value.data.profiles[0]),accountRequest('/groups')]);if(active){version.current=value.version;setStage(value);setEquipment(items);setGroups(groupData)}}catch(e){if(active)setError(e.message)}};load();return()=>{active=false}},[stageId,endpoint])
  const save=useCallback(async data=>{const saved=await accountRequest(endpoint,'PUT',{data,version:version.current});version.current=saved.version;return saved},[endpoint])
  const equipmentSave=useCallback(async(data,notes)=>{const resolved=resolveProject(data,equipment,[]);const draft=stageFromLayout(resolved.space,resolved.items,{id:stageId,label:data.project,profile:stage.data.profiles[0]});await save({...stage.data,fixedEquipment:draft.fixedEquipment,notes})},[equipment,save,stage,stageId])
  const workspace=useMemo(()=>stage&&equipmentMode?{id:'stage-equipment-'+stageId,data:stageEquipmentPlot(stage),equipment,groups,profile:stage.data.profiles[0],eventName:stage.eventName||stage.venue||'Space setup',backLabel:reusable?'Back to Spaces':'Back to event',stageName:stage.name,notes:stage.data.notes||'',revision:stage.version,mode:'setup',autosave:false,onSave:equipmentSave,onBack:()=>reusable?go({view:'spaces'}):go({event:stage.eventId})}:null,[stage,equipmentMode,stageId,equipment,groups,equipmentSave,reusable])
  if(error)return <div className="events-shell"><EventHeader/><main className="events-main"><h1>Unable to open this stage</h1><p role="alert">{error}</p></main></div>
  if(!stage)return <div className="events-loading" role="status">Opening stage setup...</div>
  if(inventoryMode)return <VenueEquipment stage={stage} equipment={equipment} onSave={save} onBack={()=>reusable?go({view:'spaces'}):go({event:stage.eventId})}/>
  if(equipmentMode)return <Planner key={stage.id} workspace={workspace}/>
  return <div className="stage-setup-editor"><style>{scopedEditorStyles}</style><Suspense fallback={<div className="events-loading">Opening stage editor...</div>}><StageEditor key={stage.id} embeddedStage={{backLabel:reusable?'Back to Spaces':'Back to event',data:stage.data,onSave:save,onBack:()=>reusable?go({view:'spaces'}):go({event:stage.eventId})}}/></Suspense></div>
}
