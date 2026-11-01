export function LayerLock({label,locked,onClick,asSpan=false}) {
  const Tag=asSpan?'span':'button'
  return <Tag className="layer-lock" role={asSpan?'button':undefined} tabIndex={asSpan?0:undefined} aria-label={(locked?'Unlock ':'Lock ')+label} aria-pressed={Boolean(locked)} onClick={onClick} onKeyDown={asSpan?event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onClick(event)}}:undefined}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={locked?'M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10H7zm2 0h6V7a3 3 0 0 0-6 0v3z':'M9 10h9.5v11h-13V10H7V7a5 5 0 0 1 9.6-2l-1.9.7A3 3 0 0 0 9 7v3z'}/></svg></Tag>
}
