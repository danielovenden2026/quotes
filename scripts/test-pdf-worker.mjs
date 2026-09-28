// Verify image requests and PDF generation in the actual Workers runtime.
import {build} from 'vite';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {Miniflare}=await import(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const out=await mkdtemp(join(tmpdir(),'verdex-pdf-worker-'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=','base64');
let mf;const requests=[];
try{
 await build({configFile:false,logLevel:'error',build:{outDir:out,emptyOutDir:true,minify:true,rolldownOptions:{output:{chunkFileNames:'[name]-[hash].mjs'}},lib:{entry:{pdf:'lib/pdf.ts',images:'lib/pdf-images.ts',quote:'lib/quote.ts'},formats:['es'],fileName:(_,name)=>name+'.mjs'}}});
 await writeFile(join(out,'worker.mjs'),`import {quotePdf} from './pdf.mjs';import {newQuote} from './quote.mjs';import {collectPdfImages,fetchPublicPdfImage} from './images.mjs';
export default {async fetch(req){const source='https://www.verdex.com.au/media/catalog/product/';if(new URL(req.url).pathname==='/unsafe'){const bytes=await fetchPublicPdfImage(source+'unsafe.png');return Response.json({blocked:bytes===null});}
 const q=newQuote(true);q.items=[{...q.items[0],sku:'SELECTED',lineId:'selected',image:source+'redirect.png',optional:true,selected:true},{...q.items[0],sku:'OMITTED',lineId:'omitted',image:source+'unselected.png',optional:true,selected:false}];
 const images=await collectPdfImages(q,(item,signal)=>fetchPublicPdfImage(item.image,signal));if(images.size!==1)throw new Error('Selected product image was not loaded');
 return new Response(await quotePdf(q,'https://example.invalid/quote',images),{headers:{'Content-Type':'application/pdf'}});
}};`);
 mf=new Miniflare({rootPath:out,modulesRoot:out,modules:true,scriptPath:join(out,'worker.mjs'),outboundService:request=>{
  const u=new URL(request.url);requests.push(u.href);assert.equal(u.hostname,'www.verdex.com.au');
  if(u.pathname.endsWith('/unsafe.png'))return new Response(null,{status:302,headers:{Location:'https://blocked.invalid/private.png'}});
  if(u.pathname.endsWith('/redirect.png'))return new Response(null,{status:302,headers:{Location:'./actual.png'}});
  return new Response(png,{headers:{'Content-Type':'image/png'}});
 }});
 const r=await mf.dispatchFetch('http://localhost/');assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());
 const {PDFDocument,PDFName,PDFDict}=await import('pdf-lib');const doc=await PDFDocument.load(bytes);
 const objects=doc.getPage(0).node.Resources().lookup(PDFName.of('XObject'),PDFDict);assert.ok(objects.keys().length>=2,'Logo and product image must both be embedded');
 const text=require('node:child_process').spawnSync('pdftotext',['-','-'],{input:Buffer.from(bytes)}).stdout.toString();assert.ok(text.includes('SELECTED'));assert.ok(!text.includes('OMITTED'));assert.ok(!text.includes('No image'));assert.ok(!text.includes('ADDITIONAL OPTIONS'));
 assert.ok(!requests.some(u=>u.endsWith('/unselected.png')));assert.deepEqual(await (await mf.dispatchFetch('http://localhost/unsafe')).json(),{blocked:true});
 console.log('PASS: Worker fetches and embeds product images, follows only allowed redirects, blocks other hosts and excludes unselected options.');
}finally{await mf?.dispose();await rm(out,{recursive:true,force:true});}
