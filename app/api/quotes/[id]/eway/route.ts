import {requirePermission,readQuote} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {ewayStatus,EwayError} from '@/lib/eway';
import {startEwayPayment} from '@/lib/eway-payment';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
async function quote(r:Request,id:string){const user=await requirePermission(r,'sendQuotes');return (await readQuote(r,id,user)).quote;}
export async function GET(r:Request,{params}:any){try{await quote(r,(await params).id);}catch{return json({error:'Sign in with permission to access this quote and send quotes.'},403);}try{const s=await ewayStatus();return json({configured:s.configured,mode:s.mode,paymentsEnabled:s.configured&&s.mode==='live',testPaymentsEnabled:s.configured&&s.mode==='sandbox'});}catch{return json({error:'eWAY status could not be loaded.'},503);}}
export async function POST(r:Request,{params}:any){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 let q;try{q=await quote(r,(await params).id);}catch{return json({error:'Sign in with permission to access this quote and send quotes.'},403);}
 if(!r.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 try{const raw=await r.text();if(raw.length>1024)return json({error:'Request is too large.'},413);const body=JSON.parse(raw);if(!Number.isInteger(body.version))return json({error:'Invalid quote version.'},400);return json(await startEwayPayment(q,body.version,new URL(r.url).origin));}catch(e){return json({error:e instanceof EwayError?e.message:'Unable to start the payment. Save checkout details and try again.'},e instanceof EwayError?e.status:400);}
}
