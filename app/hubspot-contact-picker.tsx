'use client';
import {useEffect,useRef,useState} from 'react';
import {Search,Link2,CheckCircle2} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {hubSpotQuotePatch,type HubSpotContact,type HubSpotCompany} from '@/lib/hubspot-contact';
import type {Quote} from '@/lib/quote';
import {stateDisplayName} from '@/lib/delivery-address';

type Result=Pick<HubSpotContact,'id'|'contact'|'email'|'company'|'address'|'suburb'|'state'|'postcode'>&{companies:HubSpotCompany[];companiesIncomplete?:boolean};
async function request(body:unknown,signal?:AbortSignal){
 const response=await fetch('/api/admin/hubspot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal});
 const data:any=await response.json();if(!response.ok)throw Error(data.error||'Unable to connect to HubSpot.');return data;
}
export default function HubSpotContactPicker({quote,disabled,onChoose}:{quote:Quote;disabled:boolean;onChoose:(patch:Partial<Quote>)=>void}){
 const [open,setOpen]=useState(false),[configured,setConfigured]=useState<boolean|null>(null),[settings,setSettings]=useState(false),[managed,setManaged]=useState(false);
 const [token,setToken]=useState(''),[query,setQuery]=useState(''),[results,setResults]=useState<Result[]>([]),[after,setAfter]=useState<string|null>(null),[searched,setSearched]=useState('');
 const [selected,setSelected]=useState<HubSpotContact|null>(null),[companies,setCompanies]=useState<HubSpotCompany[]>([]),[companyId,setCompanyId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0);
 const [searching,setSearching]=useState(false),[searchWarnings,setSearchWarnings]=useState<string[]>([]);const searchRequest=useRef<AbortController|null>(null);
 useEffect(()=>{if(!open)return;const version=++generation.current;setBusy(true);setError('');request({action:'status'}).then(data=>{if(version===generation.current){setConfigured(data.configured);setManaged(data.managedByHosting);setSettings(!data.configured);}}).catch(e=>{if(version===generation.current)setError(e.message);}).finally(()=>{if(version===generation.current)setBusy(false);});return ()=>{generation.current++;};},[open]);
 async function run(work:()=>Promise<void>){const version=generation.current;setBusy(true);setError('');try{await work();}catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Please try again.');}finally{if(version===generation.current)setBusy(false);}}
 async function search(term:string,next?:string){
  searchRequest.current?.abort();const controller=new AbortController();searchRequest.current=controller;
  setSearching(true);setError('');setSelected(null);setSearchWarnings([]);
  try{const data=await request({action:'search',query:term,...(next?{after:next}:{})},controller.signal);if(controller.signal.aborted)return;setResults(prev=>next?[...prev,...data.contacts]:data.contacts);setAfter(data.after);setSearched(term);setSearchWarnings(data.warnings||[]);}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Please try again.');}
  finally{if(!controller.signal.aborted)setSearching(false);}
 }
 useEffect(()=>{
  searchRequest.current?.abort();setResults([]);setAfter(null);setSearched('');setSelected(null);setSearching(false);setSearchWarnings([]);
  if(!open||!configured||settings)return;
  setError('');const term=query.trim();if(term.length<2)return;
  setSearching(true);const timer=setTimeout(()=>{void search(term);},300);
  return ()=>{clearTimeout(timer);searchRequest.current?.abort();};
 },[query,open,configured,settings]);
 function choose(){if(!selected)return;const company=companies.find(c=>c.id===companyId);onChoose(hubSpotQuotePatch(selected,company,quote));setOpen(false);setSelected(null);}
 function close(value:boolean){setOpen(value);if(!value){setToken('');setResults([]);setSelected(null);setQuery('');setSearched('');setAfter(null);}}
 return <div className="hubspot-picker">
  <button type="button" className="btn outline" disabled={disabled} onClick={()=>setOpen(true)}><Search size={16}/>Choose HubSpot contact</button>
  {quote.hubspotContactId&&<span className="hubspot-linked"><CheckCircle2 size={14}/>HubSpot contact selected</span>}
  <Dialog open={open} onOpenChange={close}><DialogContent className="app-dialog hubspot-dialog"><DialogHeader><DialogTitle>{settings?'Connect HubSpot':'Choose a HubSpot contact'}</DialogTitle><DialogDescription>{settings?'Connect your private app for contact and company lookup.':'Search by contact name or email, then check their address before using it.'}</DialogDescription></DialogHeader>
   {error&&<p className="hubspot-error" role="alert">{error}</p>}
   {configured===null&&busy?<p role="status">Checking connection…</p>:settings?<>
    {managed?<p>This connection’s token is managed in hosting settings.</p>:<form onSubmit={event=>{event.preventDefault();const entered=token;setToken('');const version=generation.current;void run(async()=>{await request({action:'connect',token:entered});if(version===generation.current){setConfigured(true);setSettings(false);}});}}>
     <label className="field"><span>Private-app access token</span><input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e=>setToken(e.target.value)} maxLength={1000} disabled={busy} placeholder="Paste your HubSpot token here"/></label>
     <p className="dialog-note">Use the Access token only; the Client secret is not required. Requires Contacts read and Companies read permissions. The token is encrypted in server storage and is never shown again.</p>
     <button type="submit" className="btn primary" disabled={busy||token.trim().length<20}><Link2 size={16}/>{busy?'Checking connection…':configured?'Update connection':'Connect HubSpot'}</button>
    </form>}
    {configured&&<div className="actions"><button type="button" className="btn outline" disabled={busy} onClick={()=>setSettings(false)}>Back to contacts</button>{!managed&&<button type="button" className="text-button" disabled={busy} onClick={()=>{const version=generation.current;void run(async()=>{await request({action:'disconnect'});if(version===generation.current){setConfigured(false);setResults([]);setSelected(null);setSearched('');}});}}>Disconnect HubSpot</button>}</div>}
   </>:configured?<>
    <div className="hubspot-search"><label className="field"><span>Contact name or email</span><input value={query} onChange={e=>{searchRequest.current?.abort();setQuery(e.target.value);}} maxLength={200} disabled={busy} autoComplete="off" placeholder="Start typing a name or email…" aria-describedby="hubspot-search-status"/></label></div><p id="hubspot-search-status" role="status" aria-live="polite">{searching?'Searching contacts…':query.trim().length<2?'Type at least 2 characters to search.':searched&&!error?`${results.length} contact${results.length===1?'':'s'} found${after?' — more available':''}.`:''}</p>
    {busy&&<p role="status">Loading…</p>}{searchWarnings.map(warning=><p className="hubspot-warning" key={warning}>{warning}</p>)}
    {!selected&&<><div className="hubspot-results">{results.map(contact=><button type="button" key={contact.id} disabled={busy||searching} onClick={()=>{const version=generation.current;void run(async()=>{const data=await request({action:'contact',id:contact.id});if(version!==generation.current)return;setSelected(data.contact);setCompanies(data.companies);setCompanyId(data.companies.length===1?data.companies[0].id:'');});}}><strong>{contact.contact||'Unnamed contact'}</strong><span>{contact.email||'No email address'}</span>{contact.companies.length>0?<span className="hubspot-result-companies"><span className="hubspot-company-label">Linked companies</span>{contact.companies.map(company=><span className="hubspot-result-company" key={company.id}><b>{company.name}</b><span>Vendor No: {company.vendorNumber===undefined?'Unavailable':company.vendorNumber||'Not provided'}</span></span>)}</span>:<span>{contact.company?'Company (contact field): '+contact.company:contact.companiesIncomplete?'Linked companies unavailable':'No linked companies'}</span>}{contact.companiesIncomplete&&<span className="hubspot-company-warning">Company lookup incomplete — select this contact to retry.</span>}<span className="hubspot-result-address"><b>Address:</b> {[contact.address,[contact.suburb,stateDisplayName(contact.state),contact.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')||'Not provided'}</span></button>)}</div>{searched===query.trim()&&searched&&!results.length&&!busy&&!searching&&!error&&<p>No contacts found. Try another name or email.</p>}{after&&searched===query.trim()&&<button className="btn outline" disabled={busy||searching} onClick={()=>void search(searched,after)}>Show more contacts</button>}</>}
    {selected&&<div className="hubspot-preview"><h3>{selected.contact||'Unnamed contact'}</h3><p>{selected.email||'No email address'}</p>
     {companies.length>1?<label className="field"><span>Company for this quote</span><select value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Choose a linked company</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}{selected.company&&<option value="contact">Use contact’s company field: {selected.company}</option>}</select></label>:<p><strong>Company:</strong> {companies[0]?.name||selected.company||'Not set — enter on the quote'}</p>}
     {companies.find(company=>company.id===companyId)?.vendorNumber&&<p><strong>Vendor Number:</strong> {companies.find(company=>company.id===companyId)!.vendorNumber}</p>}
     <p><strong>Contact address:</strong><br/>{selected.address||'No street address'}<br/>{[selected.suburb,stateDisplayName(selected.state),selected.postcode].filter(Boolean).join(' ')}</p>
     {selected.warnings.map(warning=><p className="hubspot-warning" key={warning}>{warning}</p>)}
     <p className="dialog-note">This replaces the customer details on this draft. The selected company’s Verdex Vendor No fills Vendor Number when available. Selecting a different contact or company clears the customer reference and customer terms. Save the draft to keep your changes.</p>
     <div className="actions"><button className="btn outline" disabled={busy} onClick={()=>setSelected(null)}>Back to results</button><button className="btn primary" disabled={busy||disabled||(companies.length>1&&!companyId)} onClick={choose}>Use this contact</button></div>
    </div>}
    <button type="button" className="text-button" disabled={busy} onClick={()=>{setSettings(true);setToken('');setSelected(null);setError('');}}>Manage HubSpot connection</button>
   </>:<button className="btn outline" onClick={()=>setSettings(true)}>Set up connection</button>}
  </DialogContent></Dialog>
 </div>;
}
