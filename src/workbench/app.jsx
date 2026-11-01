import {useAccount} from '../accounts.jsx'
import {StageReviewCanvas} from './stage-review.jsx'
import Dashboard from './dashboard.jsx'
import {newId} from './api.js'
import {StageCanvas,LayoutCanvas,EquipmentCanvas} from './canvases.jsx'
import {ClientInvitation} from './sharing.jsx'
import {OrganisationInvitation} from './organisation.jsx'
import {Shell,Empty} from './ui.jsx'
import './styles.css'
export default function App() {
  const {ready,user,showAccount}=useAccount(),params=new URLSearchParams(window.location.search)
  if(!ready)return <div className="workbench-loading">Opening your workspace...</div>
  if(params.has('stageInvite'))return <Shell><ClientInvitation token={params.get('stageInvite')} user={user} showAccount={showAccount}/></Shell>
  if(params.has('organisationInvite'))return <Shell><OrganisationInvitation token={params.get('organisationInvite')} user={user} showAccount={showAccount}/></Shell>
  if(params.has('clientLayout'))return <LayoutCanvas token={params.get('clientLayout')}/>
  const editor=['stage','layout','editEquipment','reviewEquipment','reviewStage'].some(key=>params.has(key))
  if(editor&&!user)return <Shell><Empty title="Sign in to open your workspace"><button onClick={showAccount}>Sign in</button></Empty></Shell>
  if(params.has('reviewStage'))return ['owner','admin'].includes(user?.role)?<StageReviewCanvas id={params.get('reviewStage')}/>:<Shell><Empty title="Public stage reviews require an administrator"/></Shell>
  if(params.has('stage'))return <StageCanvas id={params.get('stage')} organisationId={params.get('organisation')}/>
  if(params.has('layout'))return <LayoutCanvas id={params.get('layout')}/>
  if(params.has('reviewEquipment')&&!['owner','admin'].includes(user?.role))return <Shell><Empty title="Public reviews require an administrator"/></Shell>
  if(params.has('editEquipment')||params.has('reviewEquipment')){if(params.get('editEquipment')==='new'&&!params.has('draft')){params.set('draft',newId());window.history.replaceState({},'','?'+params)}return <EquipmentCanvas id={params.get('editEquipment')} draft={params.get('draft')} reviewId={params.get('reviewEquipment')} returnTo={params.get('returnTo')}/>}
  return <Dashboard view={params.get('view')||'home'} organisationId={params.get('organisation')||''}/>
}
