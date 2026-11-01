import {wholeDegrees} from '../rotation-angle.js'
import {normaliseCrop} from '../image-layer.js'
import {customStagingItem,customTextItem} from '../custom-items.js'
import {boundaryBounds,translateBoundaryNodes,resizeRectangularZone} from './stage-zone.js'
import {normaliseComponents} from '../equipment-components.js'
import {toggleableParts,setPart} from '../part-toggles.js'

const property=(id,label,type='number',options={})=>({id,label,type,get:item=>item[id],set:(item,value)=>({...item,[id]:value}),...options})
const scalar=(id,label,fallback=0,options={})=>property(id,label,'number',{get:item=>item[id]??fallback,step:.01,...options})
const flag=(id,label,fallback=false,options={})=>property(id,label,'checkbox',{get:item=>item[id]??fallback,...options})
const colour=(id,label,fallback='#25261f',options={})=>property(id,label,'color',{get:item=>item[id]??fallback,allowNone:['fill','stroke','line'].includes(id),...options})
const opacity=(id,label='Opacity')=>scalar(id,label,1,{type:'range',min:0,max:1,step:.01,scale:100,suffix:'%'})
const length=(id,label,scale=1,options={})=>scalar(id,label,0,{scale,step:.01,...options})
const rotation=()=>scalar('rotation','Rotation (degrees)',0,{step:1,set:(item,value)=>({...item,rotation:wholeDegrees(value)})})
const choices=(id,label,options,fallback)=>property(id,label,'select',{options,get:item=>item[id]??fallback})

export function artworkProperties(item,unit='cm') {
  const scale=unit==='cm'?100:1,suffix=`(${unit})`
  const fields=[property('name','Layer name','text'),length('x',`X ${suffix}`,scale),length('y',`Y ${suffix}`,scale),rotation(),flag('editorVisible','Visible on canvas',true),flag('editorLocked','Locked')]
  if(!item.collisionOnly)fields.push(flag('toggleable','Toggleable in Stageplot'))
  if(item.type!=='text')fields.push(length('width',`Width ${suffix}`,scale,{min:.01}),length('height',`Height ${suffix}`,scale,{min:.01}))
  if(item.type==='circle')for(const field of fields.filter(field=>['width','height'].includes(field.id)))field.set=(item,value)=>({...item,width:value,height:value})
  if(item.type==='tripod')for(const field of fields.filter(field=>['width','height'].includes(field.id)))field.set=(item,value)=>{const radius=field.id==='width'?value/Math.sqrt(3):value/1.5;return {...item,width:radius*Math.sqrt(3),height:radius*1.5,legRadius:radius}}
  if(item.type==='circle')fields.push(length('radius',`Radius ${suffix}`,scale,{min:.01,get:item=>item.width/2,set:(item,value)=>({...item,width:value*2,height:value*2})}),length('diameter',`Diameter ${suffix}`,scale,{min:.02,get:item=>item.width,set:(item,value)=>({...item,width:value,height:value})}))
  if(item.type==='tripod')fields.push(length('legRadius',`Leg radius ${suffix}`,scale,{min:.01,get:item=>item.legRadius??item.width/Math.sqrt(3),set:(item,value)=>({...item,legRadius:value,width:value*Math.sqrt(3),height:value*1.5})}))
  if(!['compound','text','image'].includes(item.type)&&!item.collisionOnly)fields.push(colour('fill','Fill colour'),colour('stroke','Stroke colour'),scalar('strokeWidth','Stroke width (px)',2,{type:'range',min:0,max:8,step:.5}))
  if(item.type==='polygon')fields.push(scalar('sides','Number of sides',6,{min:3,max:16,step:1}))
  if(item.type==='trapezoid')for(const [id,label] of [['leftInset','Left inset'],['rightInset','Right inset'],['slew','Slew']])fields.push(length(id,`${label} ${suffix}`,scale))
  if(item.type==='text')fields.push(property('text','Text','textarea'),length('fontSize',`Text size ${suffix}`,scale,{min:.01,get:item=>item.fontSize??.2}),flag('bold','Bold'),flag('italic','Italic'),choices('textAlign','Horizontal alignment',[['left','Left'],['center','Centre'],['right','Right']],'left'),scalar('lineSpacing','Line spacing',1.2,{min:.1,step:.1}),colour('fill','Text colour'))
  if(item.type==='image')fields.push(opacity('opacity'))
  if(item.type==='image')for(const side of ['left','right','top','bottom'])fields.push(scalar('crop-'+side,`Crop ${side} (%)`,0,{min:0,max:.95,step:.01,scale:100,get:item=>normaliseCrop(item.crop)[side],set:(item,value)=>{const crop=normaliseCrop(item.crop),opposite={left:'right',right:'left',top:'bottom',bottom:'top'}[side];return {...item,crop:normaliseCrop({...crop,[side]:Math.min(value,.99-crop[opposite])})}}}))
  return fields
}

export function stageProperties(item) {
  const geometry=['zone','boundary'].includes(item.assetType)
  const anchor=item=>{const bounds=boundaryBounds(item.nodes);return item.anchorMode==='centre'?{x:bounds.centreX,y:bounds.centreY}:{x:bounds.x,y:bounds.y}}
  const position=axis=>length(axis,`${axis.toUpperCase()} (m)`,1,geometry?{get:item=>anchor(item)[axis],set:(item,value)=>({...item,nodes:translateBoundaryNodes(item.nodes,axis==='x'?value-anchor(item).x:0,axis==='y'?value-anchor(item).y:0)})}:{})
  const fields=[property('name','Name','text'),position('x'),position('y'),flag('visible','Visible on canvas',true),flag('locked','Locked')]
  if(item.assetType==='boundary')return fields
  if(item.assetType!=='image'&&!(item.assetType==='line'&&item.type!=='curtain'))fields.push(flag('toggleable','Toggleable in Stageplot'))
  if(item.assetType==='zone'){
    fields.push(choices('zoneType','Zone type',[['aesthetic','Aesthetic'],['solid','Solid (collision)'],['label','Label']],'aesthetic'),flag('collision','Collision',false,{get:item=>item.solid===true,set:(item,value)=>({...item,solid:value,...(value?{label:false}:{})})}),choices('anchorMode','Position anchor',[['topLeft','Top-left'],['centre','Centre']],'topLeft'),choices('fillMode','Colour mode',[['single','Single colour'],['multicolour','Multicoloured']],'single'),colour('fill','Fill colour','#8eb6d8'),colour('fill2','Second fill colour','#25261f'),length('stripeSpacing','Stripe spacing (m)',1,{min:.05,get:item=>item.stripeSpacing??.5}),colour('stroke','Line colour','#447799'),scalar('strokeWidth','Line thickness (px)',2,{type:'range',min:0,max:10,step:.5}),opacity('fillOpacity','Fill opacity'),opacity('strokeOpacity','Line opacity'))
    const type=fields.find(field=>field.id==='zoneType');type.get=item=>item.label?'label':item.solid?'solid':'aesthetic';type.set=(item,value)=>({...item,solid:value==='solid',label:value==='label'})
    if(item.zoneShape==='rectangle')for(const [id,label] of [['width','Width (m)'],['height','Length (m)']])fields.push(length(id,label,1,{min:.01,get:item=>boundaryBounds(item.nodes)[id],set:(item,value)=>{const bounds=boundaryBounds(item.nodes);return resizeRectangularZone(item,id==='width'?value:bounds.width,id==='height'?value:bounds.height)}}))
  }
  if(item.assetType==='text')fields.push(property('text','Text','textarea'),length('fontSize','Text size (m)',1,{min:.05,get:item=>item.fontSize??.3}),colour('color','Colour'),opacity('opacity'))
  if(item.assetType==='image'){
    for(const axis of ['width','height'])fields.push(length(axis,axis==='width'?'Width (m)':'Height (m)',1,{min:.05,set:(item,value)=>{
      const ratio=item.aspectRatio||item.width/item.height
      return {...item,[axis]:value,...((item.lockAspect??true)?axis==='width'?{height:value/ratio}:{width:value*ratio}:{})}
    }}))
    fields.push(flag('lockAspect','Lock aspect ratio',true,{set:(item,value)=>({...item,lockAspect:value,aspectRatio:item.width/item.height})}),opacity('opacity'))
  }
  if(item.assetType==='line'){
    fields.push(length('length','Line length (m)',1,{min:.01,max:1000}),rotation(),colour('color','Colour'))
    if(item.type==='curtain')fields.push(flag('collision','Collision',true,{get:item=>item.collisionEnabled!==false,set:(item,value)=>({...item,collisionEnabled:value})}),scalar('thickness','Thickness (mm)',.02,{type:'range',min:.001,max:.2,step:.001,scale:1000}),opacity('opacity'))
  }
  return fields
}

export function placementProperties(item) {
  const fields=[property('label','Label','text'),length('xMeters','X (m)'),length('yMeters','Y (m)'),rotation(),flag('visible','Visible on canvas',true),flag('showLabel','Show label'),scalar('labelOffset','Label position',1,{type:'range',min:-2,max:2,step:.05}),flag('collisionEnabled','Equipment collision',true),choices('supplyOverride','Equipment source',[['auto','Automatic - venue stock first'],['venue','Venue supplied'],['client','Client supplied']],'auto')]
  const source=fields.find(field=>field.id==='supplyOverride');source.get=item=>item.supplyOverride||(item.useExternal?'client':'auto');source.set=(item,value)=>({...item,supplyOverride:value,useExternal:value==='client'})
  if(item.customType==='staging')fields.push(length('widthMeters','Deck width (m)',1,{min:1,step:1}),length('depthMeters','Deck depth (m)',1,{min:1,step:1}),scalar('heightMm','Deck height (mm)',200,{min:0,step:1}),flag('showHeight','Show deck height',true),colour('fill','Fill colour','#d6d2c5'),colour('line','Deck line colour'),colour('textColor','Deck text colour'),opacity('fillOpacity','Fill opacity'),opacity('lineOpacity','Line opacity'),opacity('textOpacity','Text opacity'))
  if(item.customType==='text')fields.push(property('text','Text','textarea'),length('fontSize','Text size (m)',1,{min:.01,get:item=>item.fontSize??.3}),colour('fill','Fill colour'),flag('bold','Bold text'),flag('italic','Italic text'),scalar('lineSpacing','Line spacing',1.2,{min:.1,step:.1}))
  for(const part of item.rotationParts||[]){
    const name=part.name||part.label||part.id
    fields.push(scalar('rotation-part:'+name,name,0,{
      min:Math.ceil(part.minRotation??-360),max:Math.floor(part.maxRotation??360),step:1,
      get:item=>item.controls?.[part.id]?.rotation??part.defaultRotation??0,
      set:(item,value)=>({...item,controls:{...item.controls,[part.id]:{...item.controls?.[part.id],rotation:wholeDegrees(value)}}})
    }))
  }
  for(const part of toggleableParts(item))fields.push(flag('part:'+part.name,part.name,true,{get:item=>part.ids.every(id=>item.partVisibility?.[id]!==false),isMixed:item=>part.ids.some(id=>item.partVisibility?.[id]===false)&&part.ids.some(id=>item.partVisibility?.[id]!==false),set:(item,value)=>setPart(item,part.name,value)}))
  const counts=new Map()
  for(const component of normaliseComponents(item.components)){
    const occurrence=counts.get(component.label)||0;counts.set(component.label,occurrence+1)
    const id=`component:${component.label}:${occurrence}`
    fields.push(
      flag(id,component.label,true,{get:item=>item.componentState?.[component.id]?.enabled!==false,set:(item,value)=>({...item,componentState:{...item.componentState,[component.id]:{...item.componentState?.[component.id],enabled:value}}})}),
      property(id+':note',component.label+' note','text',{get:item=>item.componentState?.[component.id]?.note||'',set:(item,value)=>({...item,componentState:{...item.componentState,[component.id]:{...item.componentState?.[component.id],note:value.slice(0,2000)}}})})
    )
  }
  return fields
}

export function sharedProperties(items,context,unit='cm') {
  if(!items.length)return []
  const schemas=items.map(item=>new Map((context==='stage'?stageProperties(item):context==='placement'?placementProperties(item):artworkProperties(item,unit)).map(field=>[field.id,field])))
  return [...schemas[0].values()].filter(field=>schemas.every(schema=>schema.get(field.id)?.type===field.type)).map(field=>{
    const descriptors=schemas.map(schema=>schema.get(field.id)),values=items.map((item,index)=>descriptors[index].get(item)),byId=new Map(items.map((item,index)=>[item.id,descriptors[index]]))
    const min=Math.max(...descriptors.map(field=>field.min??-Infinity)),max=Math.min(...descriptors.map(field=>field.max??Infinity))
    return {...field,min:Number.isFinite(min)?min:undefined,max:Number.isFinite(max)?max:undefined,values,value:values[0],mixed:values.some((value,index)=>!Object.is(value,values[0])||descriptors[index].isMixed?.(items[index])),disabled:min>max,set:(item,value)=>byId.get(item.id).set(item,value)}
  })
}

export function normalisePlacement(item) {
  return item.customType==='staging'?customStagingItem(item):item.customType==='text'?customTextItem(item):item
}
