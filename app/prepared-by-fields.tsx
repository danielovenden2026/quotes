'use client';
import {useEffect,useState} from 'react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import type {Quote} from '@/lib/quote';
type Contact=NonNullable<Quote['salesperson']>;
export default function PreparedByFields({value,canChoose,disabled,demo,onChange}:{value?:Contact;canChoose:boolean;disabled:boolean;demo:boolean;onChange:(value:Contact)=>void}){
 const [users,setUsers]=useState<Contact[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{if(!canChoose||demo)return;let active=true;setLoading(true);setError('');fetch('/api/workspace/quote-owners',{cache:'no-store'}).then(async r=>{const data:any=await r.json();if(!r.ok)throw Error(data.error);if(active)setUsers(data.users);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return ()=>{active=false};},[canChoose,demo,attempt]);
 const display=value||{name:'Daniel Ovenden',email:'daniel@verdex.com.au',phone:'(02) 8866 4600'};
 const options=display&&!users.some(u=>u.email===display.email)?[display,...users]:users;
 return <div className="prepared-by-section"><div className="prepared-by-grid"><label className="field"><span>Prepared By</span>{canChoose&&!demo?<Select value={display.email} disabled={disabled||loading||!!error} onValueChange={email=>{const contact=users.find(u=>u.email===email);if(contact)onChange(contact);}}><SelectTrigger aria-label="Prepared By"><SelectValue placeholder={loading?'Loading users…':'Choose a user'}/></SelectTrigger><SelectContent>{options.map(u=><SelectItem key={u.email} value={u.email}>{u.name} · {u.email}</SelectItem>)}</SelectContent></Select>:<input readOnly value={value?.name||'Daniel Ovenden'} aria-label="Prepared By"/>}</label><label className="field"><span>Contacts Number</span><input type="tel" readOnly value={value?.phone??'(02) 8866 4600'} placeholder="Add a phone number in Users" aria-label="Contacts Number"/></label><label className="field"><span>Contacts Email</span><input type="email" readOnly value={value?.email||'daniel@verdex.com.au'} aria-label="Contacts Email"/></label></div>{error&&<p className="price-warning" role="alert">{error} <button type="button" className="text-button" onClick={()=>setAttempt(a=>a+1)}>Retry users</button></p>}</div>;
}
