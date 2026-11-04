import {AccountModal} from '../account-modal.jsx'

export function FolderDeleteDialog({name,onDeleteContents,onPreserve,onCancel}){
  return <AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label={`Delete ${name}`}><header><h2>Delete folder?</h2></header><p>Choose what should happen to the items in <b>{name}</b>.</p><div className="project-file-actions"><button className="danger" onClick={onDeleteContents}>Delete folder and contents</button><button onClick={onPreserve}>Remove folder and preserve contents</button><button onClick={onCancel}>Cancel</button></div></section></AccountModal>
}
