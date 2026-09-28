import {sharedQuote} from '@/lib/public-quote';
import {quotePdf} from '@/lib/pdf';
import {serverPdfImages} from '@/lib/pdf-images-server';

export async function GET(r:Request,{params}:any){
 try{
  const token=(await params).token,record=await sharedQuote(token);
  if(!record)return Response.json({error:'This quotation link is invalid or no longer available.'},{status:404,headers:{'X-Robots-Tag':'noindex, nofollow'}});
  const q=record.quote;
  if(!['Ready','Accepted'].includes(q.status))throw Error('This quotation is not available for download.');
  const bytes=await quotePdf(q,new URL('/q/'+token,r.url).href,await serverPdfImages(q,record.owner));
  return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+q.number+'-Rev'+q.revision+'.pdf"','Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'PDF could not be created.'},{status:400,headers:{'X-Robots-Tag':'noindex, nofollow'}});}
}
