import {Dialog} from './workspace-ui.jsx'
export function WorkspaceCreate({onClose,onChoose}) {
  return <Dialog title="Create" onClose={onClose}><div className="workspace-create-options">{[['production','Client production','One client layout in a reusable venue space.'],['festival','Festival','Stages and independent band plots.'],['eisteddfod','Eisteddfod','A shared stage and a layout for each group.'],['space','Stage','Prepare a venue for future events and clients.']].map(([id,label,description])=><button key={id} onClick={()=>onChoose(id)}><b>{label}</b><span>{description}</span></button>)}</div></Dialog>
}
