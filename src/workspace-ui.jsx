import {useState} from 'react'
import {AccountButton,AppNavigation} from './accounts.jsx'
import {AccountModal} from './account-modal.jsx'
import {AppMark} from './app-mark.jsx'
import {EventHelp} from './help-dialog.jsx'

export function EventHeader({children}) {
  const [help,setHelp]=useState(false)
  return <><header className="events-header"><a className="events-brand" href={window.location.pathname}><AppMark/><span>STAGEPLOT<small>SPACES · PRODUCTIONS · EVENTS</small></span></a><nav>{children}<button className="btn ghost" onClick={()=>setHelp(true)}>Help</button><AppNavigation/><AccountButton/></nav></header>{help&&<EventHelp onClose={()=>setHelp(false)}/>}</>
}
export function Dialog({title,onClose,children}) {
  return <AccountModal><section className="account-dialog event-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose}>Close</button></header>{children}</section></AccountModal>
}
