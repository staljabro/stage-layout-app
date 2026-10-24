import {createContext,useContext,useEffect,useState} from 'react'
import {accountRequest} from './account-api.js'
import './accounts.css'

const AccountContext=createContext(null)
// eslint-disable-next-line react-refresh/only-export-components
export const useAccount=()=>useContext(AccountContext)
export function AccountProvider({children,studio=false}) {
  const [account,setAccount]=useState({ready:false,user:null,setupRequired:false,error:''})
  const [open,setOpen]=useState(false)
  const refresh=async()=>{try{const data=await accountRequest('/auth/session');setAccount({ready:true,...data,error:''})}catch(error){setAccount(old=>({...old,ready:true,error:error.message}))}}
  useEffect(()=>{let active=true;const update=async()=>{try{const data=await accountRequest('/auth/session');if(active)setAccount({ready:true,...data,error:''})}catch(error){if(active)setAccount(old=>({...old,ready:true,error:error.message}))}};update();window.addEventListener('focus',update);const interval=setInterval(update,60000);return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',update)}},[])
  const user=account.user,allowed=!studio || ['owner','admin','contributor'].includes(user?.role)
  return <AccountContext.Provider value={{...account,refresh,showAccount:()=>setOpen(true)}}>
    {!account.ready ? <div className="account-gate">Loading account…</div> : allowed ? <div key={user?.id || 'anonymous'}>{children}</div> : <div className="account-gate"><h1>Shape Studio</h1><p>{user?'Your account can use Stageplot. Studio requires Contributor, Admin or Owner access.':'Sign in to create equipment and stages.'}</p><button onClick={()=>setOpen(true)}>{user?'Account':'Sign in'}</button>{account.error&&<p role="alert">{account.error}</p>}</div>}
    {(open || studio&&!user&&account.ready)&&<AccountDialog account={account} onClose={()=>setOpen(false)} onChanged={refresh}/>}
  </AccountContext.Provider>
}
export function AccountButton(){const {user,showAccount}=useAccount();return <button className="btn ghost" onClick={showAccount}>{user?`${user.name} · ${user.role}`:'Sign in'}</button>}
function AccountDialog({account,onClose,onChanged}) {
  const {user,setupRequired}=account
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[users,setUsers]=useState([])
  const [tab,setTab]=useState('account')
  const perform=async fn=>{setError('');setBusy(true);try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const values=event=>Object.fromEntries(new FormData(event.currentTarget))
  return <div className="account-backdrop"><section className="account-dialog" role="dialog" aria-modal="true" aria-label="Account">
    <header><h2>{user?'Your account':setupRequired?'Create the Owner account':'Sign in'}</h2><button onClick={onClose} aria-label="Close account">×</button></header>
    {error&&<p role="alert">{error}</p>}
    {!user ? <form onSubmit={event=>{event.preventDefault();const input=values(event);perform(async()=>{await accountRequest(setupRequired?'/auth/setup':'/auth/login','POST',input);await onChanged();onClose()})}}>
      {setupRequired&&<><p>Enter the setup token from the server’s account-data/setup-token file, or the configured setup token.</p><label>Setup token<input name="setupToken" required autoComplete="off"/></label><label>Name<input name="name" required autoComplete="name"/></label></>}
      <label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<input name="password" type="password" minLength={setupRequired?12:undefined} maxLength="256" autoComplete={setupRequired?'new-password':'current-password'} required/></label>
      <button disabled={busy}>{setupRequired?'Create Owner':'Sign in'}</button>
    </form> : <>
      <p>{user.name} · {user.email} · {user.role}</p><nav><button onClick={()=>setTab('account')}>Password</button>{user.role==='owner'&&<button onClick={()=>perform(async()=>{setUsers(await accountRequest('/users'));setTab('users')})}>Manage users</button>}<button disabled={busy} onClick={()=>perform(async()=>{await accountRequest('/auth/logout','POST');await onChanged();onClose()})}>Sign out</button></nav>
      {tab==='account'&&<form onSubmit={event=>{event.preventDefault();const input=values(event),form=event.currentTarget;perform(async()=>{await accountRequest('/auth/password','POST',input);form.reset();await onChanged();setError('Password changed. Other sessions have been signed out.')})}}><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required/></label><label>New password<input name="password" type="password" minLength="12" maxLength="256" autoComplete="new-password" required/></label><button disabled={busy}>Change password</button></form>}
      {tab==='users'&&<><h3>Create account</h3><form onSubmit={event=>{event.preventDefault();const input=values(event),form=event.currentTarget;perform(async()=>{await accountRequest('/users','POST',input);form.reset();setUsers(await accountRequest('/users'))})}}><label>Name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Initial password<input name="password" type="password" autoComplete="new-password" minLength="12" required/></label><label>Role<select name="role" defaultValue="editor">{['editor','contributor','admin','owner'].map(role=><option key={role}>{role}</option>)}</select></label><button disabled={busy}>Create account</button></form>
        <h3>Accounts</h3>{users.map(member=><div className="account-row" key={member.id}><span>{member.name}<small>{member.email}</small></span><select aria-label={'Role for '+member.email} value={member.role} disabled={busy} onChange={event=>{const role=event.target.value;perform(async()=>{await accountRequest('/users/'+member.id,'PUT',{role});setUsers(await accountRequest('/users'));await onChanged()})}}>{['editor','contributor','admin','owner'].map(role=><option key={role}>{role}</option>)}</select><button disabled={busy} onClick={()=>perform(async()=>{await accountRequest('/users/'+member.id,'PUT',{disabled:!member.disabled});setUsers(await accountRequest('/users'));await onChanged()})}>{member.disabled?'Enable':'Disable'}</button><button disabled={busy} onClick={()=>{const password=window.prompt('New password (at least 12 characters) for '+member.email);if(password)perform(async()=>{await accountRequest('/users/'+member.id,'PUT',{password});setError('Password reset. Share it with the user securely.')})}}>Reset password</button></div>)}</>}
    </>}
  </section></div>
}
