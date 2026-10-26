import {AccountModal} from './account-modal.jsx'
import {createContext,useContext,useEffect,useState} from 'react'
import {accountRequest} from './account-api.js'
import './accounts.css'

const AccountContext=createContext(null)
// eslint-disable-next-line react-refresh/only-export-components
export const useAccount=()=>useContext(AccountContext)
export function AccountProvider({children,studio=false}) {
  const [account,setAccount]=useState({ready:false,user:null,githubConfigured:false,ownerConfigured:false,error:''})
  const [open,setOpen]=useState(()=>new URLSearchParams(window.location.search).has('auth_result'))
  const refresh=async()=>{try{const data=await accountRequest('/auth/session');setAccount({ready:true,...data,error:''})}catch(error){setAccount(old=>({...old,ready:true,error:error.message}))}}
  useEffect(()=>{let active=true;const update=async()=>{try{const data=await accountRequest('/auth/session');if(active)setAccount({ready:true,...data,error:''})}catch(error){if(active)setAccount(old=>({...old,ready:true,error:error.message}))}};update();window.addEventListener('focus',update);const interval=setInterval(update,60000);return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',update)}},[])
  useEffect(()=>{const url=new URL(window.location.href);if(url.searchParams.has('auth_result')){url.searchParams.delete('auth_result');window.history.replaceState(null,'',url.href)}},[])
  const user=account.user,allowed=!studio || ['owner','admin','contributor'].includes(user?.role)
  return <AccountContext.Provider value={{...account,refresh,showAccount:()=>setOpen(true)}}>
    {!account.ready ? <div className="account-gate">Loading account…</div> : allowed ? <div key={user?.id || 'anonymous'}>{children}</div> : <div className="account-gate"><h1>Shape Studio</h1><p>{user?'Your account can use Stageplot. Studio requires Contributor, Admin or Owner access.':'Sign in to create equipment and stages.'}</p><button onClick={()=>setOpen(true)}>{user?'Account':'Sign in'}</button>{account.error&&<p role="alert">{account.error}</p>}</div>}
    {(open || studio&&!user&&account.ready)&&<AccountDialog account={account} onClose={()=>setOpen(false)} onChanged={refresh}/>}
  </AccountContext.Provider>
}
export function AccountButton(){const {user,showAccount}=useAccount();return <button className="btn ghost" onClick={showAccount}>{user?`${user.name} · ${user.role}`:'Sign in'}</button>}
export function AppNavigation({studio=false}) {
  const {user,studioUrl,appUrl}=useAccount()
  const [chooseProfile,setChooseProfile]=useState(false)
  if(!['owner','admin','contributor'].includes(user?.role))return null
  const href=studio?appUrl:studioUrl
  if(!href)return null
  if(studio&&user.empire){
    const external=new URL(appUrl,window.location.href);external.searchParams.delete('profile')
    const empire=new URL(external);empire.searchParams.set('profile','empire')
    return <><button className="btn ghost app-navigation" onClick={()=>setChooseProfile(true)}>Stageplot</button>{chooseProfile&&<AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Choose Stageplot profile"><header><h2>Choose Stageplot</h2><button onClick={()=>setChooseProfile(false)}>Close</button></header><nav><a className="profile-choice" href={external.href}>External Stageplot</a><a className="profile-choice" href={empire.href}>Empire Stageplot</a></nav></section></AccountModal>}</>
  }
  return <a className="btn ghost app-navigation" href={href}>{studio?'Stageplot':'Shape Studio'}</a>
}
function AccountDialog({account,onClose,onChanged}) {
  const {user,githubConfigured,ownerConfigured}=account
  const [error,setError]=useState(()=>({pending:'Your GitHub account is awaiting Owner approval. You can still use the public planner.',denied:'Your access request has not been approved. Contact the Owner.',disabled:'Your app account has been disabled. Contact the Owner.','email-required':'Add and verify an email address on GitHub, then try again.',error:'GitHub sign-in could not be completed. Try again or contact the Owner.',cancelled:'GitHub sign-in was cancelled.'}[new URLSearchParams(window.location.search).get('auth_result')] || ''))
  const [busy,setBusy]=useState(false),[users,setUsers]=useState([]),[requests,setRequests]=useState([]),[manage,setManage]=useState(false)
  const reload=async()=>{const [accounts,pending]=await Promise.all([accountRequest('/users'),accountRequest('/access-requests')]);setUsers(accounts);setRequests(pending)}
  const perform=async fn=>{setError('');setBusy(true);try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <AccountModal><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Account">
    <header><h2>{user?'Your account':'Sign in with GitHub'}</h2><button onClick={onClose} aria-label="Close account">×</button></header>
    {error&&<p role="alert">{error}</p>}
    {!user ? <>
      <p>Use your GitHub account to sign in or request access. The Owner approves requests and assigns app roles.</p>
      {!githubConfigured&&<p role="status">GitHub sign-in has not been configured on this server yet.</p>}
      {githubConfigured&&!ownerConfigured&&<p role="status">The server Owner must configure their GitHub account ID before approving users.</p>}
      <button disabled={busy || !githubConfigured} onClick={()=>perform(async()=>{const target=new URL(window.location.href);target.searchParams.delete('auth_result');const {authorizationUrl}=await accountRequest('/auth/github/start','POST',{returnTo:target.href});window.location.assign(authorizationUrl)})}>Continue with GitHub</button>
    </> : <>
      <p>{user.name} · {user.email} · {user.role}</p><p>{user.githubLogin?`Linked to GitHub @${user.githubLogin} (ID ${user.githubId})`:'GitHub account linked'}</p>
      <nav>{user.role==='owner'&&<button disabled={busy} onClick={()=>perform(async()=>{await reload();setManage(true)})}>Manage users &amp; access requests</button>}<button disabled={busy} onClick={()=>perform(async()=>{await accountRequest('/auth/logout','POST');await onChanged();onClose()})}>Sign out</button></nav>
      <p>Password recovery and security settings are managed in your GitHub account.</p>
      {manage&&<>
        <h3>Access requests</h3><p>Approve a new account, or select an existing app account to preserve its projects and assets. Email matches never link automatically.</p>
        {!requests.length&&<p>No pending access requests.</p>}
        {requests.map(member=><form className="account-access-request" key={member.github_id} onSubmit={event=>{event.preventDefault();const input=Object.fromEntries(new FormData(event.currentTarget));perform(async()=>{await accountRequest('/access-requests/'+member.github_id+'/approve','POST',input);await reload()})}}>
          <strong>@{member.login} · GitHub ID {member.github_id}</strong><small>{member.name} · {member.email} · {member.status}</small>
          <label>App account<select name="existingUserId" defaultValue=""><option value="">Create a new account</option>{users.filter(existing=>!existing.githubId && existing.role!=='owner').map(existing=><option key={existing.id} value={existing.id}>{existing.name} ({existing.email}) · {existing.role}</option>)}</select></label>
          <label>Role<select name="role" defaultValue="editor">{['editor','contributor','admin'].map(role=><option key={role}>{role}</option>)}</select></label>
          <div><button disabled={busy}>Approve and link</button> <button type="button" disabled={busy} onClick={()=>perform(async()=>{await accountRequest('/access-requests/'+member.github_id+'/reject','POST',{});await reload()})}>Deny</button></div>
        </form>)}
        <h3>Accounts</h3>{users.map(member=><div className="account-row" key={member.id}><span>{member.name}<small>{member.email}</small><small>{member.githubLogin?`GitHub @${member.githubLogin} · ID ${member.githubId}`:'Not linked to GitHub yet'}</small></span>
          <label className="account-friendly-name">Friendly name<input key={member.id+':'+(member.friendlyName || '')} aria-label={'Friendly name for '+member.email} maxLength={100} defaultValue={member.friendlyName || ''} placeholder={member.githubLogin || member.name} disabled={busy} onBlur={event=>{const friendlyName=event.target.value.trim();if(friendlyName!==(member.friendlyName || ''))perform(async()=>{await accountRequest('/users/'+member.id,'PUT',{friendlyName});await reload();await onChanged()})}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}}}/></label>
          <label className="account-empire-toggle"><input type="checkbox" checked={!!member.empire} disabled={busy} onChange={event=>{const empire=event.target.checked;perform(async()=>{await accountRequest('/users/'+member.id,'PUT',{empire});await reload();await onChanged()})}}/>Empire</label>
          {member.role==='owner'?<strong>Owner</strong>:<><select aria-label={'Role for '+member.email} value={member.role} disabled={busy} onChange={event=>{const role=event.target.value;perform(async()=>{await accountRequest('/users/'+member.id,'PUT',{role});await reload();await onChanged()})}}>{['editor','contributor','admin'].map(role=><option key={role}>{role}</option>)}</select>
          <button disabled={busy} onClick={()=>perform(async()=>{await accountRequest('/users/'+member.id,'PUT',{disabled:!member.disabled});await reload();await onChanged()})}>{member.disabled?'Enable':'Disable'}</button></>}
        </div>)}
      </>}
    </>}
  </section></AccountModal>
}
