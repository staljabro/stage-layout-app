import {stagePartGroups} from '../stage-part-visibility.js'

export function StagePartsInspector({stage,visibility,onChange}) {
  const groups=stagePartGroups(stage)
  if(!groups.length)return null
  return <section className="stage-parts-inspector"><h3>Stage parts</h3><p className="handle-help">Show or hide optional stage parts for this layout. Hidden parts do not block equipment.</p>{groups.map(group=>{
    const states=group.ids.map(id=>visibility[id]!==false),mixed=states.some(Boolean)&&!states.every(Boolean)
    return <label className="canvas-checkbox" key={group.id}><input type="checkbox" aria-label={'Show stage part: '+group.name} checked={states.every(Boolean)} ref={input=>{if(input)input.indeterminate=mixed}} onChange={event=>onChange({...visibility,...Object.fromEntries(group.ids.map(id=>[id,event.target.checked]))})}/>{group.name}{mixed&&<small>Mixed</small>}</label>
  })}</section>
}
