import 'server-only';
import {getEwayCredentials,EwayError} from './eway';
import {db} from './store';
import {checkoutSchema} from './checkout';
import {expired,needsReview,needsPrice,totals,type Quote} from './quote';
import {freightNeedsRefresh} from './freight';
export type TestPayment={id:string;quote_id:string;quote_version:number;amount:number;invoice:string;connection:string;status:string;access_code:string|null;payment_url:string|null;transaction_id:string|null;response_code:string|null;created:string;updated:string};
const sandboxHost='https://api.sandbox.ewaypayments.com';
async function sandboxCredentials(){const c=await getEwayCredentials();if(!c)throw new EwayError('Connect eWAY in Workspace Connections first.');if(c.mode!=='sandbox')throw new EwayError('Test payments require separate eWAY Sandbox credentials. In Workspace Connections, select Test (Sandbox) and save your Sandbox API Key and API Password. Live payments are not enabled.');return c;}
async function call(path:string,credentials:Awaited<ReturnType<typeof sandboxCredentials>>,body?:unknown){
 let r:Response;try{r=await fetch(sandboxHost+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+btoa(credentials.apiKey+':'+credentials.apiPassword),'Content-Type':'application/json',Accept:'application/json','X-EWAY-APIVERSION':'47'},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(20000)});}catch{throw new EwayError('eWAY could not be reached. Please try again.',503);}
 if(r.status===401||r.status===403)throw new EwayError('eWAY rejected the saved Sandbox credentials. Verify the connection in Workspace Connections.');
 if(!r.ok)throw new EwayError('eWAY could not complete this request. Please try again.',503);
 try{return await r.json() as any;}catch{throw new EwayError('eWAY returned an unreadable response. Please try again.',503);}
}
export function checkPayable(q:Quote){
 if(q.status!=='Ready'||expired(q)||needsReview(q))throw new EwayError('This quote requires approval or has expired. Return to the quote.');
 if(freightNeedsRefresh(q))throw new EwayError('Refresh freight cost before starting payment.');
 const selected=q.items.filter(i=>(!i.optional||i.selected)&&i.qty>0);
 if(!selected.length||selected.some(needsPrice))throw new EwayError('The quote needs selected products with valid prices.');
 const details=checkoutSchema.safeParse(q.checkout);if(!details.success||details.data.paymentMethod!=='card')throw new EwayError('Complete your checkout details and select Credit / debit card first.');
 const amount=totals(q).total;if(!Number.isSafeInteger(amount)||amount<=0||amount>9999999999)throw new EwayError('This quote total cannot be processed by eWAY.');
 return {details:details.data,amount};
}
export function safePaymentUrl(value:unknown){
 if(typeof value!=='string'||value.length>2048)throw new EwayError('eWAY did not return a payment page.',503);
 let u:URL;try{u=new URL(value);}catch{throw new EwayError('eWAY returned an invalid payment page.',503);}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!['secure-au.sandbox.ewaypayments.com','secure.sandbox.ewaypayments.com'].includes(u.hostname))throw new EwayError('eWAY returned an unexpected payment page.',503);
 return u.href;
}
export async function readTestPayment(id:string){return db().prepare('SELECT * FROM eway_test_payments WHERE id=?').bind(id).first<TestPayment>();}
export function paymentSummary(p:TestPayment){return {id:p.id,quoteId:p.quote_id,quoteVersion:p.quote_version,amount:p.amount,status:p.status,transactionId:p.transaction_id,responseCode:p.response_code,mode:'sandbox',created:p.created};}
export async function startTestPayment(q:Quote,version:number,origin:string){
 if(version!==q.version)throw new EwayError('This quote changed. Reload it before paying.',409);
 const {details,amount}=checkPayable(q),credentials=await sandboxCredentials();
 let existing=await db().prepare('SELECT * FROM eway_test_payments WHERE quote_id=? AND quote_version=?').bind(q.id,q.version).first<TestPayment>();
 if(existing){
  if(existing.connection!==credentials.verifiedAt)throw new EwayError('The eWAY connection changed. Save checkout details again before starting another test.');
  if(existing.status==='succeeded')return {...paymentSummary(existing),resultUrl:'/payment-result?id='+existing.id};
  if(existing.status==='pending'&&existing.payment_url&&Date.now()-Date.parse(existing.created)<3600000)return {...paymentSummary(existing),paymentUrl:safePaymentUrl(existing.payment_url)};
  throw new EwayError(existing.status==='creating'?'A payment session is being prepared. Wait a moment and retry.':'Save checkout details again to start a new test payment.',409);
 }
 const id=crypto.randomUUID(),at=new Date().toISOString(),invoice='TEST-'+id;
 // Unique quote/version key makes simultaneous requests reuse one payment session.
 const inserted=await db().prepare("INSERT OR IGNORE INTO eway_test_payments (id,quote_id,quote_version,amount,invoice,connection,status,created,updated) SELECT ?,id,version,?,?,?,'creating',?,? FROM quotes WHERE id=? AND version=?").bind(id,amount,invoice,credentials.verifiedAt,at,at,q.id,q.version).run();
 if(!inserted.meta.changes)throw new EwayError('The quote changed or a payment session is already being prepared. Reload and try again.',409);
 try{
  const a=details.billing;
  // All totals come from the stored quote; no card data ever passes through this app.
  const data=await call('/AccessCodesShared',credentials,{Customer:{FirstName:a.firstName.slice(0,50),LastName:a.lastName.slice(0,50),CompanyName:a.company.slice(0,50),Street1:a.street1.slice(0,50),Street2:a.street2.slice(0,50),City:a.city.slice(0,50),State:a.state,PostalCode:a.postcode,Country:'au',Email:details.email.slice(0,50),Phone:a.phone.slice(0,32)},Payment:{TotalAmount:amount,InvoiceNumber:invoice,InvoiceReference:id,CurrencyCode:'AUD',InvoiceDescription:('Sandbox quote '+q.number).slice(0,64)},RedirectUrl:origin+'/payment-result?id='+id,CancelUrl:origin+'/payment-result?id='+id+'&cancelled=1',Method:'ProcessPayment',TransactionType:'Purchase',CustomerReadOnly:true,HeaderText:'Verdex — test payment',Language:'EN'});
  if(data.Errors)throw new EwayError('eWAY could not create the test payment. Check your billing details and Sandbox connection.');
  if(typeof data.AccessCode!=='string'||!data.AccessCode||data.AccessCode.length>512)throw new EwayError('eWAY did not return a valid payment session.',503);
  const url=safePaymentUrl(data.SharedPaymentUrl);
  await db().prepare("UPDATE eway_test_payments SET access_code=?,payment_url=?,status='pending',updated=? WHERE id=? AND status='creating'").bind(data.AccessCode,url,new Date().toISOString(),id).run();
  return {id,mode:'sandbox',status:'pending',amount,paymentUrl:url};
 }catch(e){await db().prepare("UPDATE eway_test_payments SET status='failed',updated=? WHERE id=? AND status='creating'").bind(new Date().toISOString(),id).run();throw e;}
}
export function verifiedOutcome(p:TestPayment,data:any){
 if(data?.Errors)throw new EwayError('The test payment result is not available yet. Check again in a moment.',503);
 if(data?.AccessCode!==p.access_code)throw new EwayError('The returned payment session did not match. Payment has not been confirmed.',503);
 const transactionId=String(data?.TransactionID||'');
 if(!/^[1-9]\d*$/.test(transactionId))return {status:'pending',transactionId:null,responseCode:null};
 if(data.InvoiceNumber!==p.invoice||data.InvoiceReference!==p.id||data.TotalAmount!==p.amount)throw new EwayError('The payment amount or reference did not match. Payment has not been confirmed.',503);
 if(data.TransactionStatus!==true&&data.TransactionStatus!==false)throw new EwayError('eWAY has not confirmed the payment status yet.',503);
 return {status:data.TransactionStatus===true?'succeeded':'declined',transactionId,responseCode:typeof data.ResponseCode==='string'&&/^\d{2}$/.test(data.ResponseCode)?data.ResponseCode:null};
}
export async function verifyTestPayment(p:TestPayment){
 if(['succeeded','declined','failed'].includes(p.status))return paymentSummary(p);
 if(!p.access_code)return paymentSummary(p);
 const credentials=await sandboxCredentials();if(credentials.verifiedAt!==p.connection)throw new EwayError('The eWAY connection changed. Restore the original Sandbox account or check this transaction in eWAY.');
 const outcome=verifiedOutcome(p,await call('/AccessCode/'+encodeURIComponent(p.access_code),credentials));
 if(outcome.status!=='pending')await db().prepare("UPDATE eway_test_payments SET status=?,transaction_id=?,response_code=?,updated=? WHERE id=? AND status='pending'").bind(outcome.status,outcome.transactionId,outcome.responseCode,new Date().toISOString(),p.id).run();
 return paymentSummary({...p,...outcome,transaction_id:outcome.transactionId,response_code:outcome.responseCode});
}
