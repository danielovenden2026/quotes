'use client';
import {useEffect,useState} from 'react';
import {CreditCard,PlugZap,CheckCircle2} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
type Status={configured:boolean;mode:'sandbox'|'live';verifiedAt:string|null;paymentsEnabled:boolean;testPaymentsEnabled?:boolean;secureStorageReady?:boolean};
async function api(body?:unknown){const r=await fetch('/api/admin/eway',{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data:any=await r.json();if(!r.ok)throw Error(data.error||'eWAY could not be reached.');return data;}
export default function EwayConnection(){
 const [status,setStatus]=useState<Status|null>(null),[mode,setMode]=useState<'sandbox'|'live'>('sandbox'),[apiKey,setApiKey]=useState(''),[apiPassword,setApiPassword]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false;api().then(data=>{if(!cancelled){setStatus(data);setMode(data.mode);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[]);
 async function run(action:'connect'|'test'|'disconnect'){
  if(busy)return;setBusy(true);setNotice('');setError('');
  const payload=action==='connect'?{action,mode,apiKey,apiPassword}:{action};
  if(action==='connect'){setApiKey('');setApiPassword('');}
  try{const data=await api(payload);if(action!=='test'){setStatus(data);setMode(data.mode);}setNotice(data.message);}catch(e){setError(e instanceof Error?e.message:'Unable to update eWAY.');}finally{setBusy(false);}
 }
 return <section className="card connection-settings-card"><div className="connection-card-heading"><CreditCard/><div><h2>eWAY payments</h2><p>Rapid API connection for quote checkout</p></div><span className={'connection-badge '+(status?.configured?'connected':'')}>{loading?'Loading…':status?.configured?(status.mode==='live'?'Live credentials saved':'Test credentials saved'):'Not connected'}</span></div>
 <form onSubmit={e=>{e.preventDefault();void run('connect');}}>
 <label className="field"><span>Connection mode</span><Select value={mode} disabled={loading||busy} onValueChange={v=>setMode(v as 'sandbox'|'live')}><SelectTrigger aria-label="eWAY connection mode"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="sandbox">Test (Sandbox)</SelectItem><SelectItem value="live">Live (Production)</SelectItem></SelectContent></Select></label>
 <label className="field"><span>{status?.configured?'Replacement API Key':'API Key'}</span><input type="password" autoComplete="new-password" spellCheck={false} autoCapitalize="none" value={apiKey} onChange={e=>setApiKey(e.target.value)} maxLength={500} required disabled={loading||busy} placeholder="Paste your eWAY Rapid API Key"/></label>
 <label className="field"><span>{status?.configured?'Replacement API Password':'API Password'}</span><input type="password" autoComplete="new-password" spellCheck={false} autoCapitalize="none" value={apiPassword} onChange={e=>setApiPassword(e.target.value)} maxLength={500} required disabled={loading||busy} placeholder="Enter your eWAY API Password"/></label>
 <p className="connection-help">Use the Rapid API Key and API Password from your eWAY account, not your login password or Pay Now public key. Test and Live use different credentials. Credentials are encrypted and never displayed again.</p>
 {status?.configured&&<p className="connection-help">Saved mode: <strong>{status.mode==='live'?'Live':'Test (Sandbox)'}</strong>. Enter both credentials to change the saved connection. A failed connection test keeps the existing settings.</p>}
 <div className="actions"><button type="submit" className="btn primary" disabled={loading||busy||apiKey.trim().length<10||!apiPassword||status?.secureStorageReady===false}><PlugZap size={16}/>{busy?'Working…':'Verify & save connection'}</button>{status?.configured&&<><button type="button" className="btn outline" disabled={busy||loading} onClick={()=>void run('test')}><CheckCircle2 size={16}/>Test saved connection</button><button type="button" className="btn outline" disabled={busy||loading} onClick={()=>void run('disconnect')}>Disconnect</button></>}</div>
 </form>{status?.verifiedAt&&<p className="connection-help">Verified when saved: {new Date(status.verifiedAt).toLocaleString('en-AU',{timeZone:'Australia/Sydney'})} (Sydney)</p>}
 <p className="connection-help">Connection tests do not charge a card. Live credentials enable real card payments from approved saved quotes. Sandbox credentials enable test payments only. Successful live card payments mark the quote accepted, but Magento / EXO order creation is still separate.</p>
 {error&&<p className="connection-feedback error" role="alert">{error}</p>}{notice&&<p className="connection-feedback success" role="status">{notice}</p>}
 </section>;
}
