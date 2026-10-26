import {useState} from 'react'
import {EventHeader} from './workspace-ui.jsx'

export function VenueEquipment({stage,equipment,onSave,onBack}) {
  const [entries,setEntries]=useState(stage.data.availableEquipment||[]),[assetId,setAssetId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
  const choices=equipment.filter(item=>!entries.some(entry=>entry.assetId===item.id))
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('');setSaved(false)
    try{await onSave({...stage.data,availableEquipment:entries.map(entry=>({...entry,quantity:Number(entry.quantity)}))});setSaved(true)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div className="events-shell"><EventHeader/><main className="events-main"><div className="events-heading"><div><p className="events-kicker">VENUE EQUIPMENT</p><h1>{stage.name}</h1><p>Equipment visiting clients and groups can request and move within their own layout.</p></div><button onClick={onBack}>Back to {stage.eventId?'event':'Spaces'}</button></div>
    <p>Installed equipment belongs in Fixed equipment. Add movable stock here, such as orchestra chairs, music stands and percussion.</p><p>Quantities apply to each layout. Twenty groups can reuse the same chairs; their requirements are not added together as a stock reservation.</p>
    {error&&<p className="event-error" role="alert">{error}</p>}{saved&&<p className="event-notice" role="status">Available equipment saved. Existing layouts keep their assigned stage version until updated.</p>}
    <form onSubmit={save} className="venue-equipment-form"><div className="venue-stock-add"><label>Equipment<select aria-label="Available equipment item" value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Choose equipment</option>{choices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" disabled={!assetId} onClick={()=>{setEntries(old=>[...old,{assetId,quantity:1}]);setAssetId('');setSaved(false)}}>Add equipment</button></div>
      <div className="venue-stock-list">{entries.map(entry=><div className="venue-stock-row" key={entry.assetId}><b>{equipment.find(item=>item.id===entry.assetId)?.label||entry.assetId}</b><label>Available quantity<input aria-label={`Quantity for ${equipment.find(item=>item.id===entry.assetId)?.label||entry.assetId}`} type="number" min="1" step="1" required value={entry.quantity} onChange={e=>{setSaved(false);setEntries(old=>old.map(item=>item.assetId===entry.assetId?{...item,quantity:e.target.value}:item))}}/></label><button type="button" onClick={()=>{setEntries(old=>old.filter(item=>item.assetId!==entry.assetId));setSaved(false)}}>Remove</button></div>)}</div>
      {!entries.length&&<p className="event-empty compact">No movable venue equipment listed yet. Clients can still add their own equipment.</p>}
      <button className="event-primary" disabled={busy}>{busy?'Saving...':'Save available equipment'}</button>
    </form>
  </main></div>
}
