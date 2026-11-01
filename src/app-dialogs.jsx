import {useEffect,useRef,useState,useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {subscribeDialogs,currentDialog,finishDialog} from './app-dialogs.js'

function MessageDialog({request}) {
  const dialog=useRef(null),frame=useRef(null),[value,setValue]=useState(request.initial),[ready,setReady]=useState(false)
  const cancel=()=>finishDialog(request.id,request.kind==='prompt'?null:false)
  useEffect(()=>{const node=dialog.current;node.showModal();return()=>node.close()},[])
  return createPortal(<dialog className={'app-message-dialog'+(request.kind==='preview'?' app-preview-dialog':'')} ref={dialog} aria-label={request.kind==='confirm'?'Confirm action':request.kind==='prompt'?'Enter a value':request.kind==='preview'?request.message:'Notice'} onCancel={event=>{event.preventDefault();cancel()}} onClick={event=>{if(event.target===event.currentTarget)cancel()}}>
    <form onSubmit={event=>{event.preventDefault();finishDialog(request.id,request.kind==='prompt'?value:true)}}>
      <header><h2>{request.kind==='confirm'?'Confirm action':request.kind==='prompt'?'Enter a value':request.kind==='preview'?request.message:'Notice'}</h2></header>
      {request.kind==='preview'?<iframe ref={frame} title={request.message} srcDoc={request.initial} onLoad={()=>setReady(true)}/>:<p>{request.message}</p>}
      {request.kind==='prompt'&&<input aria-label={request.message} autoFocus value={value} onChange={event=>setValue(event.target.value)}/>}
      <footer>{request.kind==='preview'?<><button type="button" onClick={cancel}>Close preview</button><button type="button" className="app-dialog-primary" disabled={!ready} onClick={async()=>{const content=frame.current.contentWindow;await Promise.all(Array.from(content.document.images).map(image=>image.decode().catch(()=>{})));content.focus();content.print()}}>Print / save PDF</button></>:<>{request.kind!=='alert'&&<button type="button" onClick={cancel}>Cancel</button>}<button autoFocus={request.kind!=='prompt'} className="app-dialog-primary" type="submit">{request.kind==='confirm'?'Continue':'OK'}</button></>}</footer>
    </form>
  </dialog>,document.body)
}
export function AppDialogs(){const request=useSyncExternalStore(subscribeDialogs,currentDialog);return request?<MessageDialog key={request.id} request={request}/>:null}
