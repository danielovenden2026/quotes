import 'server-only';
import {db} from './store';
import {totals,type Quote} from './quote';

export const orderStatuses=['New Order','Entered to EXO','Processing','Dispatched','Completed'] as const;
export type OrderStatus=typeof orderStatuses[number];

export type OrderRow={
 id:number;
 public_id:string;
 order_number:string|null;
 owner:string;
 quote_id:string;
 quote_number:string;
 quote_revision:number;
 customer_email:string;
 company:string;
 contact:string;
 total:number;
 payment_method:string;
 payment_status:string;
 payment_reference:string|null;
 status:OrderStatus;
 data:string;
 created:string;
 updated:string;
 entered_exo_at:string|null;
};

export type OrderRecord=Omit<OrderRow,'data'> & {snapshot:Quote};

function mapOrder(row:OrderRow):OrderRecord{
 return {...row,snapshot:JSON.parse(row.data) as Quote} as OrderRecord;
}

export async function readOrderByPublicId(publicId:string){
 const row=await db().prepare('SELECT * FROM orders WHERE public_id=?').bind(publicId).first<OrderRow>();
 return row?mapOrder(row):null;
}

export async function readOrderForQuoteRevision(quoteId:string,revision:number){
 const row=await db().prepare('SELECT * FROM orders WHERE quote_id=? AND quote_revision=?').bind(quoteId,revision).first<OrderRow>();
 return row?mapOrder(row):null;
}

export async function createOrderFromQuote({
 quote,
 owner,
 paymentMethod,
 paymentStatus,
 paymentReference,
}:{
 quote:Quote;
 owner:string;
 paymentMethod:string;
 paymentStatus:string;
 paymentReference?:string|null;
}){
 const existing=await readOrderForQuoteRevision(quote.id,quote.revision);
 if(existing)return existing;
 const publicId=crypto.randomUUID(),now=new Date().toISOString(),amount=totals(quote).total;
 const inserted=await db().prepare(`INSERT OR IGNORE INTO orders
  (public_id,owner,quote_id,quote_number,quote_revision,customer_email,company,contact,total,payment_method,payment_status,payment_reference,status,data,created,updated)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(publicId,owner,quote.id,quote.number,quote.revision,(quote.email||'').trim().toLowerCase(),quote.company||'',quote.contact||'',amount,paymentMethod,paymentStatus,paymentReference||null,'New Order',JSON.stringify(quote),now,now).run();
 if(!inserted.meta.changes){
  const concurrent=await readOrderForQuoteRevision(quote.id,quote.revision);
  if(concurrent)return concurrent;
  throw Error('The order could not be created.');
 }
 const row=await db().prepare('SELECT * FROM orders WHERE public_id=?').bind(publicId).first<OrderRow>();
 if(!row)throw Error('The order could not be loaded after creation.');
 const orderNumber='VO-'+String(10000+row.id);
 await db().prepare('UPDATE orders SET order_number=? WHERE public_id=? AND order_number IS NULL').bind(orderNumber,publicId).run();
 return mapOrder({...row,order_number:orderNumber});
}

export async function listOrders(owner:string,viewTeam:boolean){
 const query=viewTeam
  ?db().prepare('SELECT * FROM orders ORDER BY created DESC')
  :db().prepare('SELECT * FROM orders WHERE owner=? ORDER BY created DESC').bind(owner);
 const rows=await query.all<OrderRow>();
 return rows.results.map(mapOrder);
}

export async function updateOrderStatus(publicId:string,status:OrderStatus){
 const now=new Date().toISOString(),entered=status==='Entered to EXO'?now:null;
 await db().prepare('UPDATE orders SET status=?,updated=?,entered_exo_at=CASE WHEN ? IS NOT NULL THEN ? ELSE entered_exo_at END WHERE public_id=?')
  .bind(status,now,entered,entered,publicId).run();
 return readOrderByPublicId(publicId);
}
