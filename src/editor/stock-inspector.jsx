import {useState} from 'react'

export function StockInspector({value,library,groups=[],onChange}) {
  const [search,setSearch]=useState('')
  const categories=items=>[...groups,{id:null,label:'Uncategorised'}].map(group=>({...group,items:items.filter(item=>(groups.some(group=>group.id===item.groupId)?item.groupId:null)===group.id&&item.label.toLowerCase().includes(search.toLowerCase()))})).filter(group=>group.items.length)
  const sections=[{name:'Public equipment',categories:categories(library.filter(item=>item.public))},{name:'Private and shared equipment',categories:categories(library.filter(item=>!item.public))}].filter(section=>section.categories.length)
  const toggle=(assetId,on)=>onChange(on?[...value,{assetId,quantity:null}]:value.filter(item=>item.assetId!==assetId))
  return <section className="stock-inspector">
    <h3>Available equipment</h3>
    <p>Choose the equipment offered to clients. If nothing is selected, all public equipment is available. Blank quantities are untracked; zero means no stock.</p>
    <input aria-label="Search available equipment" type="search" placeholder="Search equipment" value={search} onChange={event=>setSearch(event.target.value)}/>
    <div className="stock-check-actions"><button onClick={()=>onChange(library.map(item=>value.find(entry=>entry.assetId===item.id)||{assetId:item.id,quantity:null}))}>Check all</button><button onClick={()=>onChange([])}>Uncheck all</button></div>
    {!value.length&&<p className="stock-default-note">Using all public equipment by default.</p>}
    {sections.map(section=><section className="stock-equipment-section" key={section.name} aria-label={section.name}>
      <h4>{section.name}</h4>
      {section.categories.map(category=><fieldset className="stock-category" key={category.id||'uncategorised'}>
        <legend>{category.label}</legend>
        {category.items.map(item=>{const selected=value.find(entry=>entry.assetId===item.id);return <div className="stock-checkbox-row" key={item.id}>
          <label><input type="checkbox" aria-label={'Available: '+item.label} checked={!!selected} onChange={event=>toggle(item.id,event.target.checked)}/>{item.label}</label>
          {selected&&<input aria-label={'Available quantity: '+item.label} type="number" min="0" step="1" placeholder="Untracked" value={selected.quantity??''} onChange={event=>{const quantity=event.target.value===''?null:Number(event.target.value);if(quantity===null||Number.isSafeInteger(quantity)&&quantity>=0)onChange(value.map(entry=>entry.assetId===item.id?{...entry,quantity}:entry))}}/>}
        </div>})}
      </fieldset>)}
    </section>)}
    {!sections.length&&<p className="handle-help">No matching equipment.</p>}
  </section>
}
