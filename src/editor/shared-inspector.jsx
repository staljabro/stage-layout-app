import {useRef,useState} from 'react'
import {sharedProperties} from './selection-properties.js'

function SharedField({field,onChange,disabled}) {
  const [draft,setDraft]=useState(null),cancelled=useRef(false)
  const scale=field.scale||1,numeric=['number','range'].includes(field.type),label=field.label
  const display=field.value??'',formatted=numeric?Number((Number(display)*scale).toFixed(4)):display
  const commit=value=>{
    if(!numeric){onChange(value);return}
    if(String(value).trim()==='')return
    let number=Number(value)/scale
    if(!Number.isFinite(number))return
    number=Math.max(field.min??-Infinity,Math.min(field.max??Infinity,number))
    if(field.step)number=Number((Math.round(number/field.step)*field.step).toFixed(8))
    onChange(number)
  }
  const common={'aria-label':label,disabled:disabled||field.disabled,'data-mixed':field.mixed||undefined}
  if(field.type==='checkbox')return <label className="canvas-checkbox shared-checkbox"><input {...common} type="checkbox" checked={!field.mixed&&Boolean(field.value)} ref={input=>{if(input)input.indeterminate=field.mixed}} onChange={event=>onChange(event.target.checked)}/>{label}{field.mixed&&<small>Mixed</small>}</label>
  let control
  if(field.type==='range')control=<input {...common} type="range" min={(field.min??0)*scale} max={(field.max??1)*scale} step={(field.step??.01)*scale} value={formatted} aria-valuetext={field.mixed?'Mixed values':String(formatted)} onChange={event=>commit(event.target.value)}/>
  else if(field.type==='color')control=<><input {...common} type="color" value={/^#[\da-f]{6}$/i.test(display)?display:'#000000'} onChange={event=>onChange(event.target.value)}/>{display==='none'&&!field.mixed&&<small>No colour</small>}{field.allowNone&&<button type="button" disabled={common.disabled} onClick={()=>onChange('none')}>No colour</button>}</>
  else if(field.type==='select')control=<select {...common} value={field.mixed?'':display} onChange={event=>onChange(event.target.value)}>{field.mixed&&<option value="" disabled>Mixed</option>}{field.options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
  else{
    const props={...common,value:draft??(field.mixed?'':formatted),placeholder:field.mixed?'Mixed':undefined,onChange:event=>setDraft(event.target.value),onBlur:()=>{if(!cancelled.current&&draft!==null)commit(draft);cancelled.current=false;setDraft(null)},onKeyDown:event=>{if(event.key==='Enter'&&field.type!=='textarea'){event.preventDefault();event.currentTarget.blur()}if(event.key==='Escape'){event.preventDefault();cancelled.current=true;event.currentTarget.blur()}}}
    control=field.type==='textarea'?<textarea {...props} rows="3"/>:<input {...props} type={field.type==='number'?'number':'text'} min={field.min===undefined?undefined:field.min*scale} max={field.max===undefined?undefined:field.max*scale} step={field.step===undefined?undefined:field.step*scale}/>
  }
  return <label className="field shared-field" data-property={field.id}>{label}{field.mixed?<small className="shared-mixed">Mixed</small>:field.type==='range'?<span>{formatted}{field.suffix||''}</span>:null}{control}</label>
}

export function SharedInspector({items,context,onChange,unit='cm',allowSingle=false}) {
  if(items.length<(allowSingle?1:2))return null
  const fields=sharedProperties(items,context,unit),locked=items.some(item=>item.locked||item.editorLocked),key=items.map(item=>item.id).join(',')
  return <section className="shared-inspector"><h4>{allowSingle?'Image':'Shared controls'}</h4><p className="handle-help">{allowSingle?'Crop previews keep the full image frame. Save to trim cropped edges and anything outside the canvas, then scale to 1 pixel per cm. Ctrl-drag a frame edge to crop.':'Changes apply to every selected item. Mixed means the selected values differ.'}</p>{locked&&<p className="handle-help">Unlock selected layers to change their shared properties.</p>}{fields.map(field=><SharedField key={key+':'+field.id} field={field} disabled={locked&&!['locked','editorLocked','visible','editorVisible'].includes(field.id)} onChange={value=>onChange(field,value)}/>)}</section>
}
