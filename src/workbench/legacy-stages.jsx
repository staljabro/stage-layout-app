import {useEffect,useState} from 'react'
import {request} from './api.js'
import {StageThumbnail} from './stage-thumbnail.jsx'
import {Empty,ErrorNotice} from './ui.jsx'

export function LegacyStages({busy,onTemplate}) {
  const [stages,setStages]=useState(null),[error,setError]=useState('')
  useEffect(()=>{let active=true;request('/legacy-stages').then(rows=>{if(active)setStages(rows)}).catch(error=>{if(active)setError(error.message)});return()=>{active=false}},[])
  return <section className="workbench-section legacy-stages"><h2>Archived stages</h2><p>Create a new stage from a retained original. Its outline, zones, text, curtains, installed equipment and editor artwork are preserved. The new stage belongs to your account.</p><ErrorNotice error={error}/>{stages===null&&!error?<p role="status">Loading archived stages...</p>:stages?.length?<div className="workbench-grid">{stages.map(stage=><article className="asset-card stage-card" key={stage.id}><div className="stage-card-art"><StageThumbnail stage={stage.preview}/></div><div className="asset-card-content"><h3>{stage.name}</h3><p>{stage.dimensions.widthMeters} x {stage.dimensions.depthMeters} m</p><button disabled={busy} onClick={()=>onTemplate({assetId:stage.id,name:stage.name})}>Use as template</button></div></article>)}</div>:!error&&<Empty title="No archived stages"><p>Import a stage JSON file, or use an accessible stage as a template from Stages.</p></Empty>}</section>
}
