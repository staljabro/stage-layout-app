export function LayerEye({visible,label,onClick,asSpan=false}) {
  const Tag=asSpan?'span':'button'
  return <Tag className="layer-eye" type={asSpan?undefined:'button'} role={asSpan?'button':undefined} tabIndex={asSpan?0:undefined} aria-label={(visible?'Hide ':'Show ')+label} aria-pressed={visible} title={(visible?'Hide ':'Show ')+label} onClick={event=>{event.stopPropagation();onClick()}} onKeyDown={event=>{if(asSpan&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();onClick()}}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{!visible&&<path d="m3 3 18 18"/>}</svg></Tag>
}
