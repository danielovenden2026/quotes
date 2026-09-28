import {readQuote,requirePermission} from '@/lib/workspace-access';
import {db,fail} from '@/lib/store';
import {quotePdf} from '@/lib/pdf';
import {serverPdfImages} from '@/lib/pdf-images-server';
export async function GET(r:Request,{params}:any){try{const id=(await params).id;await requirePermission(r,'sendQuotes');const row=await readQuote(r,id);const q=row.quote;if(!['Ready','Accepted'].includes(q.status))throw Error('Approve the quote before downloading a customer PDF.');const bytes=await quotePdf(q,new URL('/quote/'+id,r.url).href,await serverPdfImages(q,row.owner));return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+q.number+'-Rev'+q.revision+'.pdf"','Cache-Control':'no-store'}});}catch(e){return fail(e);}}
