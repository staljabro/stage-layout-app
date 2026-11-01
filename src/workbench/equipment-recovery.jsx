import {EquipmentArtwork} from '../equipment-artwork.jsx'

export function EquipmentRecovery({items,busy,onRecover}) {
  if(!items.length)return null
  return <section className="workbench-section equipment-recovery"><h2>Recover saved equipment</h2><p>These saved items have an older custom-shape tag that hides them from equipment lists. Show an item in your library to keep its artwork and existing ID while correcting that tag.</p><div className="workbench-grid equipment-grid">{items.map(item=><article className="asset-card" key={item.id}><div className="equipment-card-art"><svg viewBox={`0 0 ${item.dimensions.widthMeters} ${item.dimensions.depthMeters}`}><EquipmentArtwork item={{...item,widthMeters:item.dimensions.widthMeters,depthMeters:item.dimensions.depthMeters}}/></svg></div><div className="asset-card-content"><h3>{item.label}</h3><button disabled={busy} onClick={()=>onRecover(item)}>Show in equipment library</button></div></article>)}</div></section>
}
