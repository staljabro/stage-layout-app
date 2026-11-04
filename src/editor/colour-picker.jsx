import {useEffect,useRef,useState} from 'react'

const PRESET_COLOURS = [
  ['Black','#000000'], ['White','#ffffff'], ['Red','#e53935'], ['Crimson','#d81b60'],
  ['Green','#20a84b'], ['Blue','#1976d2'], ['Cyan blue','#00a6d6'], ['Yellow','#f5b700'],
  ['Dark grey','#555b61'], ['Light grey','#b8bec5'],
]

export function ColourPicker({value,onChange,disabled=false,label='Colour'}) {
  const [open,setOpen]=useState(false),root=useRef(null)
  const colour=/^#[\da-f]{6}$/i.test(value)?value:'#000000'
  useEffect(()=>{
    if(!open)return
    const close=event=>{if(event.key==='Escape'||!root.current?.contains(event.target))setOpen(false)}
    window.addEventListener('pointerdown',close);window.addEventListener('keydown',close)
    return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',close)}
  },[open])
  const change=next=>onChange({target:{value:next}})
  return <div className="colour-picker" ref={root}>
    <button type="button" className="colour-picker-trigger" aria-label={`${label}: ${colour}`} aria-expanded={open} disabled={disabled} onClick={()=>setOpen(value=>!value)}><span style={{background:colour}}/><span>{colour.toUpperCase()}</span></button>
    {open&&<div className="colour-picker-popover">
      <input type="color" value={colour} onChange={event=>change(event.target.value)} aria-label={`Custom ${label.toLowerCase()}`}/>
      <div className="colour-presets">{PRESET_COLOURS.map(([name,preset])=><button type="button" key={preset} title={name} aria-label={name} aria-pressed={colour.toLowerCase()===preset} style={{background:preset}} onClick={()=>{change(preset);setOpen(false)}}/>)}</div>
    </div>}
  </div>
}
