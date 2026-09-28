import {sanitiseProductDescription} from '@/lib/product-description';
import {getCatalogue} from '@/lib/catalogue-data';
import {catalogue as samples} from '@/lib/quote';
export const dynamic = 'force-dynamic';

const escape = (s:string) => s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function httpsUrl(value:string|undefined) {
  try {const url=new URL(value||'');return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;} catch {return undefined;}
}
export async function GET(request:Request) {
  const descriptionOnly=new URL(request.url).searchParams.get('descriptionOnly')==='1';
  const sku=(new URL(request.url).searchParams.get('sku')||'').trim().toUpperCase();
  let content='<p>Product details are unavailable for this item.</p>', status=404;
  if(sku&&sku.length<=100) {
    try {
      const feed=await getCatalogue();
      const live=feed.products.find(p=>p.sku.trim().toUpperCase()===sku);
      const product=live||samples.find(p=>p.sku.trim().toUpperCase()===sku);
      if(product) {
        const image=httpsUrl(product.image), url=httpsUrl(product.url);
        const description=live?sanitiseProductDescription(live.description):'';
        content=descriptionOnly?'<section><div class="description">'+(description||'<p>No detailed description is available for this item.</p>')+'</div></section>':(image?'<img class="product-image" src="'+escape(image)+'" alt="'+escape(product.name)+'" referrerpolicy="no-referrer">':'')+'<section><p class="sku">SKU '+escape(product.sku)+'</p><h1>'+escape(product.name)+'</h1><div class="description">'+(description||'<p>No detailed description is available for this item.</p>')+'</div>'+(url?'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">View product on website ↗</a>':'')+(live?'':'<p class="source">Sample quote item.</p>')+(live&&feed.warning?'<p class="source">Showing the last available product information.</p>':'')+'</section>';
        status=200;
      }
    } catch {content='<p>Product details could not be loaded. Close this window and try again shortly.</p>';status=503;}
  }
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verdex product details</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#fff;color:#142a3d;font:16px/1.7 Arial,sans-serif}main{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:28px;align-items:start}main>p{grid-column:1/-1}.product-image{width:100%;max-height:400px;object-fit:contain}.sku,.source{font-size:13px;color:#4c6275}h1{font-size:24px;line-height:1.35;margin:8px 0 20px}.description{overflow-wrap:anywhere}.description p{margin:0 0 14px}.description ul,.description ol{padding-left:25px;margin:12px 0 18px}.description ul{list-style:disc}.description ol{list-style:decimal}.description li{margin:6px 0}.description ul ul{list-style:circle}.description strong,.description b{font-weight:700}.description table{width:100%;border-collapse:collapse;margin:16px 0}.description td,.description th{border:1px solid #bacbd9;padding:8px;text-align:left}.description blockquote{border-left:3px solid #174d73;margin:16px 0;padding-left:16px}.description h2,.description h3,.description h4{line-height:1.4;margin:20px 0 10px}a{display:inline-block;color:#005c99;text-decoration:underline;margin:14px 0}.source{margin-top:24px}section:only-child{grid-column:1/-1}body.description-only{padding:0}body.description-only main{display:block}@media(max-width:600px){body{padding:16px}main{grid-template-columns:1fr;gap:12px}.product-image{max-height:220px}h1{font-size:21px}}</style></head><body'+(descriptionOnly?' class="description-only"':'')+'><main>'+content+'</main></body></html>',{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'none'; img-src https:; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-popups allow-popups-to-escape-sandbox"}});
}
