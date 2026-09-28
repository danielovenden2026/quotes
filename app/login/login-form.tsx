'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {LockKeyhole,Mail} from 'lucide-react';
function safeReturn(value:string|null){return value&&value.startsWith('/')&&!value.startsWith('//')?value:'/workspace';}
export default function LoginForm(){
 const params=useSearchParams(),returnTo=safeReturn(params.get('returnTo'));
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'Unable to sign in.');window.location.assign(returnTo);}catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');}finally{setBusy(false);}}
 return <form className="login-card" onSubmit={submit}>
  <img className="login-logo" src="/verdex-logo.svg" alt="Verdex" width={190} height={76}/>
  <div className="login-heading"><h1>Verdex Quotes</h1><p>Sign in to the Sales Workspace</p></div>
  {error&&<div className="login-error" role="alert">{error}</div>}
  <label className="login-field"><span>Email</span><div><Mail size={18}/><input autoFocus required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@verdex.com.au"/></div></label>
  <label className="login-field"><span>Password</span><div><LockKeyhole size={18}/><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/></div></label>
  <button className="btn primary login-button" disabled={busy}>{busy?'Signing in…':'Log in'}</button>
  <p className="login-help">Only users enabled by a Verdex Super Administrator can sign in.</p>
 </form>;
}
