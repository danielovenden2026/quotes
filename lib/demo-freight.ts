import 'server-only';
import {z} from 'zod';
import {db} from './store';
import {newQuote,lineKey,type Quote} from './quote';
import {sharedDemoQuote} from './shared-demo';
import {applyQuoteAction} from './quote-actions';
import {freightFingerprint} from './freight';
import {refreshCustomerFreight} from './customer-freight';
import {FreightError} from './magento-freight';
import {privateHeaders} from './admin-access';
const ids={'VQ-ECBE1BD3':'ecbe1bd3-9939-4a26-8c74-a6804110f4b7','VQ-4BE95871':'4be95871-dc22-454a-91fe-c62d29ef553b'} as const;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
// Only explicitly shared quotations; no arbitrary quote lookup, SKU or destination.
export async function demoFreight(request:Request,demo:keyof typeof ids|'sample'){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 try{
  const reader=request.body?.getReader();if(!reader)throw Error('Invalid request.');
  let bytes=0,raw='';const decoder=new TextDecoder();
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>20000)throw Error('Freight request is too large.');raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel();reader.releaseLock();}
  const body=z.object({items:z.array(z.object({lineId:z.string().uuid().optional(),sku:z.string().max(100),qty:z.number().int().min(0).max(10000),selected:z.boolean()})).max(50),shipmentFingerprint:z.string().max(15000)}).parse(JSON.parse(raw));
  let source:Quote;
  if(demo==='sample')source=newQuote(true,'public-sample-freight');
  else{const row=await db().prepare('SELECT data FROM quotes WHERE id=?').bind(ids[demo]).first<{data:string}>();if(!row)throw Error('Demo unavailable.');const stored=JSON.parse(row.data) as Quote;if(stored.number!==demo)throw Error('Demo unavailable.');source=sharedDemoQuote(stored);}
  if(body.items.some(i=>!source.items.some(s=>lineKey(s)===lineKey(i)&&s.sku===i.sku)))throw Error('Live demo freight is available for the original shared products and address.');
  // Omitted rows represent products removed earlier in this temporary demo.
  const items=source.items.map(i=>body.items.find(v=>lineKey(v)===lineKey(i))||{lineId:i.lineId,sku:i.sku,qty:0,selected:false});
  const changes={action:'customer',version:source.version,items,fulfilmentMethod:'delivery'};
  const candidate=applyQuoteAction(source,changes);
  if(freightFingerprint(candidate)!==body.shipmentFingerprint)throw Error('Live demo freight uses the original shared products, prices and address. Open the saved quote to calculate edited shipments.');
  const result=await refreshCustomerFreight(source,changes);
  return json({freight:result.freight,freightEstimate:result.freightEstimate});
 }catch(e){return json({error:e instanceof z.ZodError?'Check the selected products and quantities.':e instanceof FreightError?e.message:e instanceof Error&&/^(Live demo freight|Demo unavailable|This quote is not available|Online freight calculation is unavailable|The quoted delivery service is unavailable|A freight calculation is already running|Duplicate items|Freight request is too large)/.test(e.message)?e.message:'Freight could not be calculated. Please try again.'},400);}
}
