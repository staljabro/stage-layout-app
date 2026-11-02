import {equipmentRotationParts} from '../equipment-part-controls.js'
import {wholeDegreesWithin} from '../rotation-angle.js'

export function PartRotationInspector({item,onChange,installed=false}) {
  const parts=equipmentRotationParts(item)
  if(!parts.length)return null
  return <section className="part-rotation-inspector"><h4>Part rotation</h4>{installed&&<p className="handle-help">Adjust parts for this layout. The installed item's position stays locked.</p>}{parts.map(part=><label className="field" key={part.id}>{part.name}<input aria-label={part.name} type="number" step="1" min={part.minRotation} max={part.maxRotation} value={item.controls?.[part.id]?.rotation??part.defaultRotation} onChange={event=>{if(event.target.value==='')return;onChange({...item.controls,[part.id]:{...item.controls?.[part.id],rotation:wholeDegreesWithin(event.target.value,part.minRotation,part.maxRotation)}})}}/></label>)}</section>
}
