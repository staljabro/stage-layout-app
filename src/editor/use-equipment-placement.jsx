import {currentDialog} from '../app-dialogs.js'
import {wholeDegrees} from '../rotation-angle.js'
import {selectionBox,containsBounds} from '../marquee.js'
import {useEffect,useRef,useState} from 'react'
import {EquipmentArtwork} from '../equipment-artwork.jsx'
import {PartRotationInspector} from './part-rotation-inspector.jsx'
import {EquipmentList} from '../equipment-list.jsx'
import {allocateStock,equipmentRows,stockQuantity,assignEquipmentSources} from '../inventory.js'
import {availablePlacement,alignItems,distributeItems,placementBounds,slidePlacement,dragPlacement,equipmentRotationHandle} from '../layout-tools.js'
import {isItemInsideSpace,itemsCollide,collisionPolygons,polygonsIntersect,nearestSnapOffset} from '../geometry.js'
import {sampleStageBoundary} from '../stage-geometry.js'
import {curtainCollisionLines} from '../stage-curtain.js'
import {customStagingItem,customTextItem,customDrapesItem,stagingSnapPoints} from '../custom-items.js'
import {sharedParts,partState,setPart} from '../part-toggles.js'
import {equipmentVisible,stageAssetVisible} from '../layer-visibility.js'
import {equipmentFolders,syncEquipmentFolders} from '../equipment-layer-model.js'
import {EquipmentLayers} from './equipment-layers.jsx'
import {normaliseComponents} from '../equipment-components.js'
import {ColourPicker} from './colour-picker.jsx'

export function useEquipmentPlacement({enabled,value,onChange:onEquipmentChange,library=[],groups=[],folders=[],onFoldersChange,canvasRef,stage,checkpoint,onSelect,onLayerDrag,onNotice,visitor=false,onCreateEquipment,notes='',onNotesChange,reviewNote='',status='',project='',snapMode='standard',organisationId=null,organisation=null}) {
  const [screenUnit,setScreenUnit]=useState(.01)
  const [selection,setSelection]=useState([]),[search,setSearch]=useState(''),[group,setGroup]=useState(''),[collisions,setCollisions]=useState(true),[snapping,setSnapping]=useState(true),[report,setReport]=useState(false),[notice,setNotice]=useState(''),[marquee,setMarquee]=useState(null)
  const drag=useRef(null),clipboard=useRef([]),counter=useRef(100)
  const selected=value.filter(item=>selection.includes(item.id)),single=selected.length===1?selected[0]:null
  const nextId=()=>{counter.current=Math.max(counter.current,...value.map(item=>Number(item.id)||0))+1;return counter.current}
  const point=event=>{const svg=canvasRef.current;if(!svg)return {x:0,y:0};const local=svg.createSVGPoint();local.x=event.clientX;local.y=event.clientY;return local.matrixTransform(svg.getScreenCTM().inverse())}
  useEffect(()=>{
    if(!enabled||!canvasRef.current)return
    const svg=canvasRef.current,measure=()=>{const matrix=svg.getScreenCTM();if(matrix)setScreenUnit(1/Math.hypot(matrix.a,matrix.b))},resize=new ResizeObserver(measure),changes=new MutationObserver(measure)
    resize.observe(svg);changes.observe(svg,{attributes:true,attributeFilter:['style','viewBox','width','height']});const frame=requestAnimationFrame(measure)
    return()=>{resize.disconnect();changes.disconnect();cancelAnimationFrame(frame)}
  },[enabled,canvasRef])
  const memberIds=ids=>[...new Set(ids.flatMap(id=>{const group=value.find(item=>item.id===id)?.equipmentGroup?.id;return group?value.filter(item=>item.equipmentGroup?.id===group).map(item=>item.id):[id]}))]
  const select=(ids,additive=false)=>{onSelect?.();const expanded=memberIds(ids);setSelection(additive?expanded.every(id=>selection.includes(id))?selection.filter(id=>!expanded.includes(id)):[...new Set([...selection,...expanded])]:expanded)}
  const update=next=>{checkpoint();onChange(next);onFoldersChange?.(equipmentFolders(next,folders))}
  const updateDocument=(next,nextFolders)=>{checkpoint();onChange(next);onFoldersChange?.(nextFolders)}
  const change=changes=>update(value.map(item=>selection.includes(item.id)?{...item,...changes}:item))
  const moveToBand=(ids,band)=>{const moving=new Set(memberIds(ids));update(value.map(item=>moving.has(item.id)?{...item,layerStack:band==='roof'?'roof':'stage',equipmentFolder:null}:item))}
  const boundary=sampleStageBoundary(stage.boundary.nodes)
  const stageObstacles=[...(stage.zones||[]).filter(zone=>zone.solid&&stageAssetVisible(zone,stage.layerFolders||[])).map(zone=>sampleStageBoundary(zone.nodes)),...curtainCollisionLines(stage)]
  const obstacles=others=>[...others,...(visitor?stage.fixedEquipment||[]:[])].filter(equipmentVisible).map(item=>({...item,snapPoints:item.snapPoints||library.find(asset=>asset.id===item.assetId)?.snapPoints||(item.customType==='staging'?stagingSnapPoints(item.widthMeters,item.depthMeters):[])}))
  const allowed=(candidate,others)=>!equipmentVisible(candidate)||candidate.collisionEnabled===false||!collisions||(!visitor||isItemInsideSpace(candidate,boundary))&&obstacles(others).every(other=>other.collisionEnabled===false||candidate.collisionEnabled===false||!itemsCollide(candidate,other))&&!stageObstacles.some(obstacle=>collisionPolygons(candidate).some(polygon=>polygonsIntersect(polygon,obstacle)))
  const stock=new Map((stage.availableEquipment||[]).map(item=>[item.assetId,item.quantity]))
  const trackStock=Boolean(organisationId||stock.size)
  const stockLibrary=library.map(item=>({...item,stockQuantity:stock.get(item.id)??(organisationId?item.stockQuantity??null:null)}))
  const sourcedItems=assignEquipmentSources(value,stockLibrary,trackStock,visitor?stage.fixedEquipment||[]:[])
  const onChange=next=>onEquipmentChange(assignEquipmentSources(next,stockLibrary,trackStock,visitor?stage.fixedEquipment||[]:[]))
  const allocation=allocateStock(sourcedItems,stockLibrary,trackStock,visitor?stage.fixedEquipment||[]:[])
  const itemStockState=item=>!trackStock||!item.assetId||stockQuantity(stockLibrary.find(asset=>asset.id===item.assetId))===null?'untracked':allocation.external.has(item.id)?'external':'available'
  const selectionColour=item=>itemStockState(item)==='external'?'#b3612e':itemStockState(item)==='available'?'#718c24':'#527da9'
  const add=(asset,position)=>{
    const item=asset.customType?{...asset,id:nextId(),rotation:0}:{...asset,id:nextId(),assetId:asset.id,widthMeters:asset.dimensions.widthMeters,depthMeters:asset.dimensions.depthMeters,rotation:0,componentState:{},controls:Object.fromEntries((asset.rotationParts||[]).map(part=>[part.id,{rotation:wholeDegrees(part.defaultRotation||0)}]))}
    Object.assign(item,{xMeters:position?.x??stage.dimensions.widthMeters/2,yMeters:position?.y??stage.dimensions.depthMeters/2})
    const available=availablePlacement(item,{width:stage.dimensions.widthMeters,depth:stage.dimensions.depthMeters},candidate=>allowed(candidate,value))
    if(!available){setNotice('No clear placement found. Turn off collision checks to place equipment manually.');return}
    Object.assign(item,{xMeters:available.xMeters,yMeters:available.yMeters,supply:stock.has(item.assetId)?'venue':'client'})
    update([...value,item]);select([item.id])
  }
  const copiesOf=items=>{const groupIds=new Map();return items.map(item=>{const copy={...structuredClone(item),id:nextId(),xMeters:item.xMeters+.2,yMeters:item.yMeters+.2};if(copy.equipmentGroup){if(!groupIds.has(copy.equipmentGroup.id))groupIds.set(copy.equipmentGroup.id,'group-'+nextId());copy.equipmentGroup.id=groupIds.get(copy.equipmentGroup.id)}return copy})}
  const duplicate=()=>{if(!selected.length)return;const copies=copiesOf(selected);update([...value,...copies]);setSelection(copies.map(item=>item.id))}
  const remove=()=>{update(value.filter(item=>!selection.includes(item.id)));setSelection([])}
  const groupSelected=()=>{
    if(selected.length<2){onNotice?.('Cannot group - select at least two items.');return}
    if(new Set(selected.map(item=>item.layerStack==='roof'?'roof':'stage')).size>1){onNotice?.('Cannot group - items are on separate layer stacks.');return}
    const data={id:'group-'+Date.now(),name:'Equipment group',collapsed:false,visible:true},folder=selected[0]?.equipmentFolder||null,nextFolders=equipmentFolders(value,folders).map(entry=>({...entry,itemIds:entry.id===folder?.id?[...entry.itemIds.filter(id=>!selection.includes(id)),...selection]:entry.itemIds.filter(id=>!selection.includes(id))}));const next=[...value.filter(item=>!selection.includes(item.id)),...selected.map(item=>({...item,equipmentGroup:data}))];updateDocument(syncEquipmentFolders(next,nextFolders),nextFolders)
  }
  const ungroupSelected=()=>change({equipmentGroup:null})
  const moveSelection=(originals,target,stationary)=>{
    const raw={dx:target.x-originals[0].xMeters,dy:target.y-originals[0].yMeters};let dx=raw.dx,dy=raw.dy,gridTarget=null
    const translate=(x,y)=>originals.map(item=>({...item,xMeters:item.xMeters+x,yMeters:item.yMeters+y}))
    if(snapping&&snapMode!=='off'){
      const step=snapMode==='advanced'?.01:.1
      dx=Math.round(target.x/step)*step-originals[0].xMeters;dy=Math.round(target.y/step)*step-originals[0].yMeters
      gridTarget=translate(dx,dy)
      const offset=nearestSnapOffset(translate(dx,dy).filter(equipmentVisible),obstacles(stationary),.3)
      if(offset){dx+=offset.dx;dy+=offset.dy}
    }
    if(!collisions)return translate(dx,dy)
    const valid=items=>items.every(item=>allowed(item,stationary))
    if(valid(translate(dx,dy)))return translate(dx,dy)
    if(gridTarget&&valid(gridTarget))return gridTarget
    const rawTarget=translate(raw.dx,raw.dy);if(valid(rawTarget))return rawTarget
    const polygons=[...(visitor?[boundary]:[]),...stageObstacles,...obstacles(stationary).filter(item=>item.collisionEnabled!==false).flatMap(collisionPolygons)]
    const directions=polygons.flatMap(polygon=>polygon.map((point,index)=>({x:polygon[(index+1)%polygon.length].x-point.x,y:polygon[(index+1)%polygon.length].y-point.y})))
    return dragPlacement(originals,dx,dy,valid,directions)
  }
  const start=(event,item,mode='move')=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId)
    let ids=selection.includes(item.id)?selection:memberIds([item.id])
    if(event.shiftKey&&mode==='move'){select([item.id],true);return}
    checkpoint();let originals=value.filter(candidate=>ids.includes(candidate.id))
    if(event.altKey&&mode==='move'){originals=copiesOf(originals);onChange([...value,...originals]);onFoldersChange?.(equipmentFolders([...value,...originals],folders));ids=originals.map(item=>item.id)}
    onSelect?.();setSelection(ids)
    const visibleOriginals=originals.filter(equipmentVisible),geometry=equipmentRotationHandle(visibleOriginals.length?visibleOriginals:originals,screenUnit),pivot=geometry.pivot,p=point(event)
    drag.current={mode,start:p,originals,last:originals,ids,pivot,rotationDelta:0,angle:Math.atan2(p.y-pivot.y,p.x-pivot.x)}
    if(mode.startsWith('drapes-'))drag.current.drapes=item
  }
  useEffect(()=>{
    if(!enabled)return
    const move=event=>{
      const active=drag.current;if(!active)return
      const p=point(event)
      if(active.mode==='marquee'){active.end=p;setMarquee(selectionBox(active.start,p));return}
      const stationary=value.filter(item=>!active.ids.includes(item.id));let updates
      if(active.mode.startsWith('drapes-')){
        const item=active.drapes,angle=(item.rotation||0)*Math.PI/180,half=item.widthMeters/2
        const startPoint={x:item.xMeters-Math.cos(angle)*half,y:item.yMeters-Math.sin(angle)*half},endPoint={x:item.xMeters+Math.cos(angle)*half,y:item.yMeters+Math.sin(angle)*half}
        const start=active.mode==='drapes-start'?p:startPoint,end=active.mode==='drapes-end'?p:endPoint,length=Math.max(.1,Math.hypot(end.x-start.x,end.y-start.y))
        const rotation=wholeDegrees(Math.atan2(end.y-start.y,end.x-start.x)*180/Math.PI),radians=rotation*Math.PI/180
        const anchor=active.mode==='drapes-start'?endPoint:startPoint,direction=active.mode==='drapes-start'?-1:1
        const changed=customDrapesItem({...item,xMeters:anchor.x+direction*Math.cos(radians)*length/2,yMeters:anchor.y+direction*Math.sin(radians)*length/2,widthMeters:length,rotation})
        updates=[changed]
      }else if(active.mode==='rotate'){
        const angle=Math.atan2(p.y-active.pivot.y,p.x-active.pivot.x),step=angle-active.angle
        active.rotationDelta+=Math.atan2(Math.sin(step),Math.cos(step));active.angle=angle
        let delta=wholeDegrees(active.rotationDelta*180/Math.PI)
        if(event.shiftKey)delta=Math.round(delta/15)*15
        const radians=delta*Math.PI/180
        updates=active.originals.map(item=>{const x=item.xMeters-active.pivot.x,y=item.yMeters-active.pivot.y;return {...item,xMeters:active.pivot.x+x*Math.cos(radians)-y*Math.sin(radians),yMeters:active.pivot.y+x*Math.sin(radians)+y*Math.cos(radians),rotation:wholeDegrees(item.rotation)+delta}})
        if(!updates.every(item=>allowed(item,stationary)))return
      }else updates=moveSelection(active.last,{x:active.originals[0].xMeters+p.x-active.start.x,y:active.originals[0].yMeters+p.y-active.start.y},stationary)
      active.last=updates;onChange(value.map(item=>updates.find(update=>update.id===item.id)||item))
    }
    const finish=()=>{const active=drag.current;if(active?.mode==='marquee'){const box=selectionBox(active.start,active.end||active.start);const ids=value.filter(item=>equipmentVisible(item)&&containsBounds(box,placementBounds([item]))).map(item=>item.id);select([...new Set([...active.additive,...ids])]);setMarquee(null)}drag.current=null}
    const key=event=>{
      if(currentDialog())return
      if(['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName)||event.target?.isContentEditable)return
      const command=event.ctrlKey||event.metaKey,k=event.key.toLowerCase();if(!selected.length&&!(command&&k==='v'&&clipboard.current.length))return
      let handled=true
      if(command&&k==='c')clipboard.current=structuredClone(selected)
      else if(command&&k==='v'){const copies=copiesOf(clipboard.current);update([...value,...copies]);setSelection(copies.map(item=>item.id))}
      else if(command&&k==='a')select(value.map(item=>item.id))
      else if(command&&k==='g'){const groupIds=[...new Set(selected.map(item=>item.equipmentGroup?.id).filter(Boolean))],groupId=groupIds[0];if(groupIds.length===1&&value.filter(item=>item.equipmentGroup?.id===groupId).every(item=>selection.includes(item.id)))ungroupSelected();else groupSelected()}
      else if(event.key==='Delete'||event.key==='Backspace')remove()
      else if(command&&k==='d')duplicate()
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        const amount=event.shiftKey?.1:.01,dx=event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0,dy=event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0
        const moved=collisions?slidePlacement(selected,dx,dy,items=>items.every(item=>allowed(item,value.filter(other=>!selection.includes(other.id))))):selected.map(item=>({...item,xMeters:item.xMeters+dx,yMeters:item.yMeters+dy}))
        update(value.map(item=>moved.find(next=>next.id===item.id)||item))
      }else if(event.key==='Escape')setSelection([])
      else handled=false
      if(handled){event.preventDefault();event.stopImmediatePropagation()}
    }
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('keydown',key,true)
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('keydown',key,true)}
  })

  const visible=library.filter(asset=>(!group||asset.groupId===group)&&asset.label.toLowerCase().includes(search.toLowerCase()))
  const pixel=screenUnit,selectedVisible=selected.filter(equipmentVisible),rotationHandle=selectedVisible.length?equipmentRotationHandle(selectedVisible,pixel):null,selectionBounds=selectedVisible.length>1?placementBounds(selectedVisible):null
  const renderItem=item=><g className={'placed-equipment stock-'+itemStockState(item)+(selection.includes(item.id)?' selected':'')} data-stock-state={itemStockState(item)} key={item.id} data-equipment-id={item.id} transform={'translate('+item.xMeters+' '+item.yMeters+') rotate('+(item.rotation||0)+')'} onPointerDown={event=>start(event,item)}>
    <rect x={-item.widthMeters/2} y={-item.depthMeters/2} width={item.widthMeters} height={item.depthMeters} fill="transparent" stroke={selectedVisible.length===1&&selection.includes(item.id)?selectionColour(item):'none'} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
    <svg x={-item.widthMeters/2} y={-item.depthMeters/2} width={item.widthMeters} height={item.depthMeters} overflow="visible" pointerEvents="none"><EquipmentArtwork item={item}/></svg>
    {item.customType==='drapes'&&selection.length===1&&selection.includes(item.id)&&[-1,1].map(side=><circle key={side} className="drapes-endpoint" aria-label={side<0?'Drapes start endpoint':'Drapes end endpoint'} cx={side*item.widthMeters/2} cy="0" r={5*pixel} onPointerDown={event=>start(event,item,side<0?'drapes-start':'drapes-end')}/>)}
    {item.showLabel&&<text y={(item.labelOffset??1)*(item.depthMeters/2+.2)} textAnchor="middle" dominantBaseline="middle" fontSize=".15" pointerEvents="none">{item.label}</text>}
  </g>
  const controls=rotationHandle&&<g className="equipment-controls"><line x1={rotationHandle.edge.x} y1={rotationHandle.edge.y} x2={rotationHandle.handle.x} y2={rotationHandle.handle.y} stroke="#718c24" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/><circle aria-label="Rotate equipment" role="button" cx={rotationHandle.handle.x} cy={rotationHandle.handle.y} r={5*pixel} fill="#d6f264" stroke="#52643c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" onPointerDown={event=>start(event,selectedVisible[0],'rotate')}/></g>
  const selectionOutline=selectionBounds&&<rect className="group-selection" x={selectionBounds.x-pixel*3} y={selectionBounds.y-pixel*3} width={selectionBounds.right-selectionBounds.x+pixel*6} height={selectionBounds.bottom-selectionBounds.y+pixel*6} pointerEvents="none"/>
  const outlineInRoof=selectedVisible.some(item=>item.layerStack==='roof')
  const svg=<g className="equipment-placements">{value.filter(item=>item.layerStack!=='roof').filter(equipmentVisible).map(renderItem)}{!outlineInRoof&&selectionOutline}{selectedVisible.some(item=>item.layerStack!=='roof')&&controls}{marquee&&<rect className="equipment-marquee" x={marquee.x} y={marquee.y} width={marquee.right-marquee.x} height={marquee.bottom-marquee.y} fill="#7198c2" fillOpacity=".15" stroke="#527da9" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}</g>
  const roofSvg=<g className="roof-equipment-placements">{value.filter(item=>item.layerStack==='roof').filter(equipmentVisible).map(renderItem)}{outlineInRoof&&selectionOutline}{selectedVisible.some(item=>item.layerStack==='roof')&&controls}</g>
  const layerProps={items:value,folders,updateDocument,selection,select,update,groupSelected,ungroupSelected,onLayerDrag}
  const layers=<EquipmentLayers {...layerProps} title={visitor?'Equipment layers':'Fixed Equipment'}/>
  const roofLayers=visitor?null:<EquipmentLayers {...layerProps} bare band="roof"/>
  const shared=key=>selected.every(item=>item[key]===selected[0]?.[key])?selected[0]?.[key]:''
  const field=(key,label,type='number',min,step)=>{const change=event=>{const next=key==='rotation'?wholeDegrees(event.target.value):type==='number'?Number(event.target.value):event.target.value;if(type!=='number'||Number.isFinite(next))update(value.map(item=>{if(!selection.includes(item.id))return item;const changed={...item,[key]:next};return item.customType==='staging'?customStagingItem(changed):item.customType==='text'?customTextItem(changed):item.customType==='drapes'?customDrapesItem(changed):changed}))};return <label className="field" key={key}>{label}{type==='color'?<ColourPicker value={shared(key)??'#000000'} label={label} onChange={change}/>:<input aria-label={label} type={type} min={min} step={step??.01} value={typeof shared(key)==='number'?Number(shared(key).toFixed(4)):shared(key)??''} onChange={change}/>}</label>}
  const check=(label,test,apply)=>{const states=selected.map(test),mixed=states.some(Boolean)&&!states.every(Boolean);return <label className="canvas-checkbox"><input type="checkbox" ref={input=>{if(input)input.indeterminate=mixed}} checked={states.every(Boolean)} onChange={event=>update(value.map(item=>selection.includes(item.id)?apply(item,event.target.checked):item))}/>{label}</label>}
  const allDecks=selected.length>0&&selected.every(item=>item.customType==='staging'),allText=selected.length>0&&selected.every(item=>item.customType==='text'),allDrapes=selected.length>0&&selected.every(item=>item.customType==='drapes')
  const placementComponents=single?normaliseComponents(single.components):[]
  const inspector=<section className="placement-inspector">{single&&field('label','Label','text')}<div className="field-row">{field('xMeters','X (m)')}{field('yMeters','Y (m)')}{field('rotation','Rotation','number',undefined,1)}</div>
    {allDecks&&<><div className="field-row">{field('widthMeters','Deck width (m)','number',.1,.1)}{field('depthMeters','Deck depth (m)','number',.1,.1)}{field('heightMm','Deck height (mm)','number',0,1)}</div>{check('Show deck height',item=>item.showHeight!==false,(item,showHeight)=>({...item,showHeight}))}<div className="deck-colour-controls">{field('fill','Deck fill colour','color')}{field('line','Deck line colour','color')}{field('textColor','Deck text colour','color')}</div>{['fillOpacity','lineOpacity','textOpacity'].map((key,index)=><label className="field" key={key}>{['Fill opacity','Line opacity','Text opacity'][index]}<input aria-label={['Fill opacity','Line opacity','Text opacity'][index]} type="range" min="0" max="1" step=".01" value={shared(key)??1} onChange={event=>change({[key]:Number(event.target.value)})}/></label>)}</>}
    {allText&&<>{single&&<label className="field">Text<textarea value={single.text} onChange={event=>update(value.map(item=>item.id===single.id?customTextItem({...item,text:event.target.value}):item))}/></label>}{field('fontSize','Text size (m)','number',.01)}{field('fill','Text colour','color')}{check('Bold text',item=>item.bold===true,(item,bold)=>customTextItem({...item,bold}))}{check('Italic text',item=>item.italic===true,(item,italic)=>customTextItem({...item,italic}))}</>}
    {allDrapes&&<>{field('widthMeters','Drapes length (m)','number',.1,.1)}<label className="field">Drapes thickness <span>{Math.round((shared('thickness')||.02)*1000)} mm</span><input aria-label="Drapes thickness (mm)" type="range" min="1" max="200" step="1" value={Math.round((shared('thickness')||.02)*1000)} onChange={event=>change({thickness:Number(event.target.value)/1000})}/></label>{field('color','Drapes colour','color')}<label className="field">Opacity <span>{Math.round((shared('opacity')||0)*100)}%</span><input aria-label="Drapes opacity" type="range" min="0" max="1" step=".01" value={shared('opacity')??1} onChange={event=>change({opacity:Number(event.target.value)})}/></label></>}
    {single&&<PartRotationInspector item={single} onChange={controls=>change({controls})}/>}
    {single&&sharedParts(selected).map(part=>check(part.name,item=>partState([item],part.name)===true,(item,on)=>setPart(item,part.name,on)))}
    {placementComponents.length>0&&<section className="placement-components"><h4>Components</h4><div className="placement-component-card"><label className="placement-component-parent"><input type="checkbox" checked={single.showAsComponent===true&&single.baseComponentEnabled!==false} disabled={!single.showAsComponent} onChange={event=>update(value.map(item=>item.id===single.id?{...item,baseComponentEnabled:event.target.checked}:item))}/><span>{single.label}</span></label><div className="placement-component-rows">{placementComponents.map(component=>{const state=single.componentState?.[component.id]||{},enabled=state.enabled!==false,supply=state.supply==='client'?'client':'venue';return <div className="placement-component-row" key={component.id}><span>{component.label}</span><button type="button" onClick={()=>update(value.map(item=>item.id===single.id?{...item,componentState:{...item.componentState,[component.id]:{...state,supply:supply==='venue'?'client':'venue'}}}:item))}>{supply==='venue'?'Venue':'Client'}</button><input aria-label={`Include ${component.label}`} type="checkbox" checked={enabled} onChange={event=>update(value.map(item=>item.id===single.id?{...item,componentState:{...item.componentState,[component.id]:{...state,enabled:event.target.checked}}}:item))}/></div>})}</div></div></section>}
    {selected.length>0&&<>{check('Visible on canvas',item=>item.visible!==false,(item,visible)=>({...item,visible}))}{check('Show label',item=>item.showLabel===true,(item,showLabel)=>({...item,showLabel}))}<label className="field">Label position<input aria-label="Label position" type="range" min="-2" max="2" step=".05" value={selected.every(item=>(item.labelOffset??1)===(selected[0]?.labelOffset??1))?(selected[0]?.labelOffset??1):0} onChange={event=>change({labelOffset:Number(event.target.value)})}/><small>Above / 0: over item / below</small></label>{check('Equipment collision',item=>item.collisionEnabled!==false,(item,collisionEnabled)=>({...item,collisionEnabled}))}<label className="field">Equipment source<select aria-label="Equipment source" value={selected.every(item=>(item.supplyOverride|| (item.useExternal?'client':'auto'))===(selected[0]?.supplyOverride||(selected[0]?.useExternal?'client':'auto')))?selected[0]?.supplyOverride||(selected[0]?.useExternal?'client':'auto'):''} onChange={event=>change({supplyOverride:event.target.value,useExternal:event.target.value==='client'})}>{selected.length>1&&<option value="" disabled>Mixed sources</option>}<option value="auto">Automatic - venue stock first</option><option value="venue">Venue supplied</option><option value="client">Client supplied</option></select></label></>}
    {selected.length>1&&<div className="equipment-align-tools">{[['left','Align left'],['hcentre','Centre X'],['top','Align top'],['vcentre','Centre Y']].map(([mode,label])=><button key={mode} onClick={()=>{const moved=alignItems(selected,mode);update(value.map(item=>moved.find(next=>next.id===item.id)||item))}}>{label}</button>)}{selected.length>2&&<button onClick={()=>{const moved=distributeItems(selected,'horizontal');update(value.map(item=>moved.find(next=>next.id===item.id)||item))}}>Distribute horizontally</button>}</div>}
    {selected.length>0&&<><button onClick={()=>update([...value.filter(item=>!selection.includes(item.id)),...selected])}>Bring forward</button><button onClick={()=>update([...selected,...value.filter(item=>!selection.includes(item.id))])}>Send back</button><button onClick={duplicate}>Duplicate equipment</button><button className="delete" onClick={remove}>Delete equipment</button></>}
  </section>
  const equipmentButton=asset=><button className={'custom-tool '+(!trackStock||allocation.remaining.get(asset.id)===null?'stock-untracked':allocation.remaining.get(asset.id)>0?'stock-available':'stock-external')} data-stock-state={!trackStock||allocation.remaining.get(asset.id)===null?'untracked':allocation.remaining.get(asset.id)>0?'available':'external'} key={asset.id} draggable onDragStart={event=>event.dataTransfer.setData('application/x-stageplot-equipment',asset.id)} onClick={()=>add(asset)}><svg viewBox={'0 0 '+asset.dimensions.widthMeters+' '+asset.dimensions.depthMeters}><EquipmentArtwork item={{...asset,widthMeters:asset.dimensions.widthMeters,depthMeters:asset.dimensions.depthMeters}}/></svg><span>{asset.label}</span>{trackStock&&<small>{allocation.remaining.get(asset.id)===null?'Untracked':(allocation.remaining.get(asset.id)??0)+' available'}</small>}</button>
  const libraryPanel=<section className="canvas-equipment-library"><div className="canvas-library-heading"><b>Equipment library</b>{onCreateEquipment&&<button onClick={onCreateEquipment}>Create equipment</button>}<input type="search" aria-label="Search equipment" placeholder="Search equipment" value={search} onChange={event=>setSearch(event.target.value)}/><select aria-label="Equipment group" value={group} onChange={event=>setGroup(event.target.value)}><option value="">All groups</option>{groups.map(entry=><option key={entry.id} value={entry.id}>{entry.label}</option>)}</select><label className="canvas-checkbox"><input type="checkbox" checked={collisions} onChange={event=>setCollisions(event.target.checked)}/>Collision checks</label><label className="canvas-checkbox"><input type="checkbox" checked={snapping} onChange={event=>setSnapping(event.target.checked)}/>Equipment snapping</label><button onClick={()=>setReport(true)}>Equipment list</button>{trackStock&&<small className="stock-legend"><span>Stock</span><span>External</span><span>Untracked</span></small>}</div>{notice&&<p role="status">{notice}</p>}<div className="canvas-equipment-tools">{visible.map(equipmentButton)}{!visitor&&<><button className="custom-tool stock-untracked" onClick={()=>add(customStagingItem({widthMeters:2,depthMeters:1}))}><svg viewBox="0 0 2 1" aria-hidden="true"><EquipmentArtwork item={customStagingItem({widthMeters:2,depthMeters:1,showHeight:false})}/></svg><span>Stage deck</span></button><button className="custom-tool stock-untracked" onClick={()=>add(customDrapesItem())}><svg viewBox="0 0 64 30" aria-hidden="true"><path d="M4 15 C8 4 12 4 16 15 S24 26 28 15 S36 4 40 15 S48 26 52 15 S58 4 60 15" fill="none" stroke="#25261f" strokeWidth="3" strokeLinecap="round"/></svg><span>Drapes</span></button><button className="custom-tool stock-untracked" onClick={()=>add(customTextItem())}><svg viewBox="0 0 60 48" aria-hidden="true"><path d="M12 10h36v8M12 18v-8M30 10v29M22 39h16" fill="none" stroke="#52643c" strokeWidth="3" strokeLinecap="round"/></svg><span>Text annotation</span></button></>}{!visible.length&&<p>No matching equipment.</p>}</div></section>
  const notesPanel=visitor?<section className="layout-notes"><h3>{project}</h3><p>{status}</p><p>Stage layers and installed equipment are locked.</p>{reviewNote&&<p className="review-note">{reviewNote}</p>}<label className="field">Performance notes<textarea value={notes} maxLength="10000" onChange={event=>onNotesChange(event.target.value)}/></label>{trackStock&&<><h4>{organisationId?'Organisation stock':'Available stage stock'}</h4>{library.filter(asset=>value.some(item=>item.assetId===asset.id)||stock.has(asset.id)).map(asset=>{const placements=value.filter(item=>item.assetId===asset.id),external=placements.filter(item=>allocation.external.has(item.id)).length;return <p className={external?'stock-shortfall':''} key={asset.id}>{asset.label}: {placements.length-external} stock / {external} external / {allocation.remaining.get(asset.id)===null?'untracked':(allocation.remaining.get(asset.id)??0)+' remaining'}</p>})}</>}</section>:null
  return {beginMarquee:event=>{event.preventDefault();event.stopPropagation();onSelect?.();event.currentTarget.setPointerCapture(event.pointerId);drag.current={mode:'marquee',start:point(event),additive:event.shiftKey?selection:[]}},svg,roofSvg,layers,roofLayers,moveToBand,inspector,libraryPanel,notesPanel,addDeck:()=>add(customStagingItem({widthMeters:2,depthMeters:1})),addDrapes:()=>add(customDrapesItem()),addText:()=>add(customTextItem()),selected:selected.length>0,clear:()=>setSelection([]),drop:event=>{const asset=library.find(item=>item.id===event.dataTransfer.getData('application/x-stageplot-equipment'));if(asset){event.preventDefault();add(asset,point(event))}},report:report?<EquipmentList organisation={organisation} stageName={stage.label} project={project||stage.label} rows={equipmentRows(sourcedItems,stockLibrary,allocation,trackStock,visitor&&!trackStock,visitor?stage.fixedEquipment||[]:[],visitor?null:'Stage Equipment')} supplyTracking={visitor&&!trackStock} trackStock={trackStock||visitor} onClose={()=>setReport(false)}/>:null}
}
