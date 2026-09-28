const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(p){p=path.resolve(root,p);if(cache.has(p))return cache.get(p);const e={};cache.set(p,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(p),n+'.ts')):require(n),e);return e;}
const {parseFeed}=load('lib/product-feed.ts'),{syncAutoOptions}=load('lib/auto-options.ts'),{newQuote,totals,lineKey}=load('lib/quote.ts'),{applyQuoteAction}=load('lib/quote-actions.ts'),{customerQuoteSections}=load('lib/quote-layout.ts'),{freightInput}=load('lib/freight.ts'),{sharedDemoQuote}=load('lib/shared-demo.ts');
const xml='<rss xmlns:g="http://base.google.com/ns/1.0"><channel>'+[
 ['MAIN',' r1, R2 ,r1,missing, MAIN ','R2, o1','100'],['R1','','','10'],['R2','','','20'],['O1','','','30'],['MANUAL','','','5']
].map(([sku,related,other,price])=>`<item><g:id>${sku}</g:id><title>${sku}</title><g:price>${price}</g:price><related><![CDATA[${related}]]></related><otherskus>${other}</otherskus></item>`).join('')+'</channel></rss>';
const products=parseFeed(xml).products;assert.deepEqual(products[0].relatedSkus,['r1','R2','missing','MAIN']);assert.deepEqual(products[0].otherSkus,['R2','o1']);
const make=(sku,optional=false)=>({...products.find(i=>i.sku===sku),lineId:crypto.randomUUID(),optional,selected:!optional});
let q={...newQuote(true),status:'Draft',expiry:'2099-01-01',items:[make('MAIN'),make('R2',true),make('MANUAL',true),make('MAIN')]};
const synced=syncAutoOptions(q,products);
assert.deepEqual(synced.items.map(i=>i.sku),['MAIN','R2','MANUAL','R1','O1','MAIN','R1','R2','O1']);
assert.equal(new Set(synced.items.map(lineKey)).size,synced.items.length);
assert.equal(synced.items[3].autoOptionSource,'related');assert.equal(synced.items[4].autoOptionSource,'otherskus');
assert.deepEqual(syncAutoOptions(synced,products),synced);
assert.equal(totals(synced).items,totals(q).items);assert.equal(freightInput(synced).items.length,2);
const selected={...synced,items:synced.items.map((i,n)=>n===3?{...i,selected:true,qty:3,price:1234}:i)};
const resynced=syncAutoOptions(selected,products);assert.deepEqual(resynced.items[3],selected.items[3]);
assert.equal(totals(resynced).items,totals(q).items+3*1234);assert.equal(freightInput(resynced).items.length,3);
const blocked=syncAutoOptions({...synced,items:synced.items.map((i,n)=>n===0?{...i,noAutoOptions:true}:i)},products);
assert.deepEqual(blocked.items.map(i=>i.sku),['MAIN','R2','MANUAL','MAIN','R1','R2','O1']);
assert.equal(customerQuoteSections(synced).filter(s=>s.kind==='options').length,2);
const saved=applyQuoteAction(q,{action:'save',version:q.version,quote:synced});assert.equal(saved.items[3].autoOptionFor,q.items[0].lineId);
const ready=applyQuoteAction(saved,{action:'ready',version:saved.version});
const customer=applyQuoteAction(ready,{action:'customer',version:ready.version,items:ready.items.map((i,n)=>n===3?{...i,selected:true,price:1,noAutoOptions:true}:i)});
assert.equal(customer.items[3].price,ready.items[3].price);assert.equal(customer.items[3].selected,true);assert.equal(customer.items[3].noAutoOptions,undefined);
assert.equal(sharedDemoQuote(saved).items[3].autoOptionFor,q.items[0].lineId);
const noLinks=products.map(i=>({...i,relatedSkus:[],otherSkus:[]}));assert.equal(syncAutoOptions(q,noLinks).items.length,q.items.length);
const allManual={...q,items:[...Array(49)].map(()=>make('MAIN'))};assert.equal(syncAutoOptions(allManual,products).items.length,50);assert.equal(syncAutoOptions(allManual,products).items.filter(i=>i.autoOptionFor).length,1);
console.log('PASS: XML CSV fields, blanks, case-insensitive matching, manual/related/other ordering, deduplication, unknown/self SKU exclusion, per-parent opt-out, duplicate parents, stable IDs, saved flags, customer selection/totals/freight, server price protection, shared demo and line limit.');

const manyProducts=[...products,...Array.from({length:35},(_,n)=>({...products[1],sku:'AUTO-'+n}))];
const manyFeed=manyProducts.map(p=>p.sku==='MAIN'?{...p,relatedSkus:Array.from({length:25},(_,n)=>'AUTO-'+n),otherSkus:Array.from({length:10},(_,n)=>'AUTO-'+(25+n))}:p);
const oneMain={...q,items:[make('MAIN'),make('MANUAL',true)]};
const limited=syncAutoOptions(oneMain,manyFeed);
assert.equal(limited.items.filter(i=>i.autoOptionFor).length,20);
assert.deepEqual(limited.items.slice(2).map(i=>i.sku),Array.from({length:20},(_,n)=>'AUTO-'+n));
assert.deepEqual(syncAutoOptions(oneMain,manyFeed,0).items,oneMain.items);
assert.equal(syncAutoOptions(oneMain,manyFeed,30).items.filter(i=>i.autoOptionFor).length,30);
assert.equal(syncAutoOptions(oneMain,manyFeed,5).items.filter(i=>i.autoOptionFor).length,5);
const full={...q,items:Array.from({length:50},()=>make('MAIN'))};assert.equal(syncAutoOptions(full,manyFeed,50).items.length,50);
const off={...synced,items:synced.items.map(i=>i.optional?i:{...i,noAutoOptions:true})};
assert.equal(syncAutoOptions(off,products).items.some(i=>i.autoOptionFor),false);
assert.deepEqual(syncAutoOptions(off,products).items.filter(i=>i.optional).map(i=>i.sku),['R2','MANUAL']);
assert.equal(syncAutoOptions({...off,items:off.items.map(i=>({...i,noAutoOptions:false}))},products).items.filter(i=>i.autoOptionFor).length,5);
console.log('PASS: default 20 automatic options, configured 0/5/30 limits, ordered truncation, room reserved for manual lines, 50-line quotes, all-product opt-out and re-enable.');
