const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cache=new Map();
const alternate=process.argv.includes('--new-quote'),demoSlug=alternate?'vq-4be95871':'vq-ecbe1bd3',demoId=alternate?'4be95871-dc22-454a-91fe-c62d29ef553b':'ecbe1bd3-9939-4a26-8c74-a6804110f4b7';
const stock={totalStock:5,committedStock:2,melbourne:2,brisbane:0,sydney:3};
const source=new Map([['A',{averageCost:60,stock}],['PRIVATE',{averageCost:987654,stock}],['DUP',{averageCost:4,stock,duplicate:true}]]);
let force=0,missing=false;const edited={quote_id:demoId,sku:'A',source_sku:'A',cost:7500,cost_from_feed:1};
const saved={id:demoId,number:demoSlug.toUpperCase(),items:[{sku:' a '},{sku:'DUP'},{sku:'CUSTOM',adhocId:'valid-id'}]};
function load(p){p=path.resolve(root,p);if(cache.has(p))return cache.get(p);const e={};cache.set(p,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>{
 if(n==='server-only')return {};
 if(n==='cloudflare:workers')return {env:{BUCKET:{get:async key=>key==='preview-image'?{body:new Uint8Array([137,80,78,71,13,10,26,10])}:null}}};
 const target=n.startsWith('@/')?path.join(root,n.slice(2)+'.ts'):n.startsWith('.')?path.resolve(path.dirname(p),n+'.ts'):null;
 if(target===path.join(root,'lib/store.ts'))return {db:()=>({prepare:()=>({bind:id=>{assert.equal(id,saved.id);return {first:async()=>missing?null:{data:JSON.stringify(saved),owner:'owner'}};}})})};
 if(target===path.join(root,'lib/cost-data.ts'))return {getCosts:async refresh=>{if(refresh)force++;return source;}};
 if(target===path.join(root,'lib/catalogue-data.ts'))return {getCatalogue:async()=>({products:[{sku:'A'},{sku:'PRIVATE'},{sku:'DUP'}]})};
 if(target===path.join(root,'lib/adhoc-products.ts'))return {adhocImages:row=>row.image_key?[{key:row.image_key,type:row.image_type}]:[],getAdhoc:async(id,owner)=>{assert.equal(owner,'owner');if(id==='feed-edit')return edited;assert.equal(id,'valid-id');return {quote_id:saved.id,sku:'CUSTOM',cost:2500,image_key:'preview-image',image_type:'image/png'};}};
 return target?load(target):require(n);
},e);return e;}
(async()=>{
 const {GET,POST}=load('app/demo/'+demoSlug+'/metrics/[kind]/route.ts');
 const context=kind=>({params:Promise.resolve({kind})});
 const item=(sku,price=10000)=>({sku,price,qty:1,optional:false,selected:true});
 const request=(kind,body,origin='https://test.invalid')=>new Request('https://test.invalid/demo/'+demoSlug+'/metrics/'+kind,{method:'POST',headers:{origin},body:kind==='gp'?new URLSearchParams(body):JSON.stringify(body)});
 const cost=sku=>GET(new Request('https://test.invalid/demo/'+demoSlug+'/metrics/cost?sku='+encodeURIComponent(sku)),context('cost'));
 const a=await cost(' a ');assert.equal(a.status,200);assert.match(await a.text(),/\$60\.00/);assert.match(a.headers.get('content-security-policy'),/sandbox/);assert.match(a.headers.get('cache-control'),/no-store/);
 for(const sku of ['PRIVATE','UNKNOWN','DUP']){const response=await cost(sku);const html=await response.text();assert.match(html,/N\/A/);assert.doesNotMatch(html,/987654|<script/);}
 assert.match(await (await cost('CUSTOM')).text(),/\$25\.00/);
 const status=await POST(request('status',{items:[item('A',9000),item('PRIVATE')]}),context('status'));assert.deepEqual(await status.json(),{targetPct:40,lowSkus:['A'],lowLines:['A']});
 const gp=await POST(request('gp',{kind:'summary',items:JSON.stringify([item('A')])}),context('gp'));const html=await gp.text();assert.match(html,/40\.0%/);assert.doesNotMatch(html,/<script|latestCost|averageCost|987654/);
 const blocked=await POST(request('gp',{kind:'summary',items:JSON.stringify([item('PRIVATE')])}),context('gp'));assert.match(await blocked.text(),/N\/A/);
 const quoteGp=await POST(request('quote-gp',{items:[item('A')]}),context('quote-gp'));const aggregate=await quoteGp.json();assert.equal(aggregate.pct,40);assert.doesNotMatch(JSON.stringify(aggregate),/averageCost|987654|stock/);
 const unknownGp=await POST(request('quote-gp',{items:[item('PRIVATE')]}),context('quote-gp'));assert.equal((await unknownGp.json()).pct,null);
 const stocks=await POST(request('stock',{skus:['A','PRIVATE']}),context('stock'));assert.deepEqual(await stocks.json(),{stock:{A:stock,PRIVATE:{totalStock:null,committedStock:null,melbourne:null,brisbane:null,sydney:null}}});
 assert.equal((await POST(request('refresh',{}),context('refresh'))).status,200);assert.equal(force,1);
 assert.equal((await POST(request('refresh',{},'https://other.invalid'),context('refresh'))).status,403);assert.equal(force,1);
 assert.equal((await POST(request('status',{items:[{...item('A'),adhocId:'ad1bf4c4-dfbd-4e59-8a21-d11cc7cb7020'}]}),context('status'))).status,400);
 const {GET:demoImage}=load('app/demo/'+demoSlug+'/images/route.ts');
 assert.equal((await demoImage(new Request('https://test.invalid/demo/'+demoSlug+'/images?sku=CUSTOM&index=0'))).status,200);
 for(const query of ['sku=PRIVATE','sku=A','sku=CUSTOM&index=1','sku=CUSTOM&index=-1'])assert.equal((await demoImage(new Request('https://test.invalid/demo/'+demoSlug+'/images?'+query))).status,404);
 saved.items[0]={sku:'A',adhocId:'feed-edit'};
 assert.match(await (await cost('A')).text(),/\$60\.00/);
 const inheritedStock=await POST(request('stock',{skus:['A']}),context('stock'));assert.deepEqual(await inheritedStock.json(),{stock:{A:stock}});
 edited.cost_from_feed=0;assert.match(await (await cost('A')).text(),/\$75\.00/);
 const overrideStock=await POST(request('stock',{skus:['A']}),context('stock'));assert.deepEqual(await overrideStock.json(),{stock:{A:stock}});
 const overridden=await POST(request('gp',{kind:'summary',items:JSON.stringify([{...item('A'),demoCost:2500}])}),context('gp'));assert.match(await overridden.text(),/75\.0%/);
 assert.match(await (await cost('A')).text(),/\$75\.00/); // Original source cost was not changed by the hypothetical $25.
 for(const demoCost of [-1,NaN,'25',100000001,1.2])assert.equal((await POST(request('status',{items:[{...item('A'),demoCost}]}),context('status'))).status,400);
 const firstLine=crypto.randomUUID(),secondLine=crypto.randomUUID();
 const repeated=await POST(request('status',{items:[{...item('A'),lineId:firstLine,demoCost:5000},{...item('A'),lineId:secondLine,demoCost:8000}]}),context('status'));
 assert.deepEqual(await repeated.json(),{targetPct:40,lowSkus:['A'],lowLines:[secondLine]});
 const repeatedGp=await POST(request('gp',{kind:'summary',items:JSON.stringify([{...item('A'),lineId:firstLine,demoCost:5000},{...item('A'),lineId:secondLine,demoCost:8000}])}),context('gp'));assert.match(await repeatedGp.text(),/35\.0%/);
 saved.items[0].lineId=firstLine;
 const copyGp=await POST(request('gp',{kind:'summary',items:JSON.stringify([{...item('A'),lineId:secondLine,demoCostLineId:firstLine}])}),context('gp'));assert.match(await copyGp.text(),/25\.0%/);
 missing=true;const failed=await cost('A');assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/\$60/);
 console.log('PASS: anonymous access limited to shared quote SKUs, server-only costs/GP, live stock projection, custom cost ownership, refresh reload, origin checks, and unavailable source handling.');
})().catch(e=>{console.error(e);process.exitCode=1;});
