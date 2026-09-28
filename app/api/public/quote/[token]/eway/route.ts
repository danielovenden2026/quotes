import {sharedQuote} from '@/lib/public-quote';
import {ewayStatus,EwayError} from '@/lib/eway';
import {processEwaySecureFieldsPayment,startEwayPayment} from '@/lib/eway-payment';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow'}});

export async function GET(_r:Request,{params}:any){
 const token=(await params).token,record=await sharedQuote(token);
 if(!record)return json({error:'This quotation link is invalid or no longer available.'},404);
 try{const s=await ewayStatus();return json({configured:s.configured,mode:s.mode,paymentsEnabled:s.configured&&s.mode==='live'&&s.secureFieldsReady,testPaymentsEnabled:s.configured&&s.mode==='sandbox'&&s.secureFieldsReady,secureFieldsReady:s.secureFieldsReady,publicApiKey:s.publicApiKey});}
 catch{return json({error:'eWAY status could not be loaded.'},503);}
}
export async function POST(r:Request,{params}:any){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 const token=(await params).token,record=await sharedQuote(token);
 if(!record)return json({error:'This quotation link is invalid or no longer available.'},404);
 if(!r.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 try{
  const raw=await r.text();if(raw.length>1024)return json({error:'Request is too large.'},413);
  const body=JSON.parse(raw);if(!Number.isInteger(body.version))return json({error:'Invalid quote version.'},400);
  const resultPath='/q/'+token+'/payment-result';
  return json(typeof body.securedCardData==='string'?await processEwaySecureFieldsPayment(record.quote,body.version,body.securedCardData,resultPath):await startEwayPayment(record.quote,body.version,new URL(r.url).origin,resultPath));
 }catch(e){return json({error:e instanceof EwayError?e.message:'Unable to start payment. Save checkout details and try again.'},e instanceof EwayError?e.status:400);}
}
