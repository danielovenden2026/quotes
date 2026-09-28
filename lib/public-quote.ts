import 'server-only';
import {db} from './store';
import type {Quote} from './quote';

export type SharedQuoteRecord={quote:Quote;owner:string;token:string};

function randomToken(bytes=24){return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}

export async function shareTokenForQuote(quoteId:string){
 const row=await db().prepare('SELECT token,active FROM quote_share_tokens WHERE quote_id=?').bind(quoteId).first<{token:string;active:number}>();
 return row?.active?row.token:null;
}

export async function createOrEnableShareToken(quoteId:string,createdBy:string){
 const existing=await db().prepare('SELECT token FROM quote_share_tokens WHERE quote_id=?').bind(quoteId).first<{token:string}>();
 const now=new Date().toISOString();
 if(existing){
  await db().prepare('UPDATE quote_share_tokens SET active=1,revoked_at=NULL WHERE quote_id=?').bind(quoteId).run();
  return existing.token;
 }
 const token=randomToken();
 await db().prepare('INSERT INTO quote_share_tokens (token,quote_id,active,created,created_by) VALUES (?,?,?,?,?)').bind(token,quoteId,1,now,createdBy).run();
 return token;
}

export async function revokeShareToken(quoteId:string){
 await db().prepare('UPDATE quote_share_tokens SET active=0,revoked_at=? WHERE quote_id=?').bind(new Date().toISOString(),quoteId).run();
}

export async function sharedQuote(token:string):Promise<SharedQuoteRecord|null>{
 if(!/^[a-f0-9]{48}$/.test(token))return null;
 const row=await db().prepare(`SELECT q.data,q.version,q.owner,s.token
 FROM quote_share_tokens s JOIN quotes q ON q.id=s.quote_id
 WHERE s.token=? AND s.active=1`).bind(token).first<{data:string;version:number;owner:string;token:string}>();
 if(!row)return null;
 const quote={...JSON.parse(row.data),version:row.version} as Quote;
 if(!['Ready','Changes requested','Accepted','Declined'].includes(quote.status))return null;
 return {quote,owner:row.owner,token:row.token};
}
