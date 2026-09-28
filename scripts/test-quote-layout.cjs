const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(p){p=path.resolve(root,p);if(cache.has(p))return cache.get(p);const e={};cache.set(p,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(p),n+'.ts')):require(n),e);return e;}

async function pdfText(q,url){const bytes=await load('lib/pdf.ts').quotePdf(q,url);const r=require('child_process').spawnSync('pdftotext',['-','-'],{input:Buffer.from(bytes)});assert.equal(r.status,0);return r.stdout.toString().replace(/\s+/g,' ');}
(async()=>{

const {newQuote,totals}=load('lib/quote.ts'),{applyQuoteAction:act}=load('lib/quote-actions.ts'),{quoteRows,moveQuoteRow,noteHtml,noteText,reanchorBlocks}=load('lib/quote-layout.ts'),{quotePdf}=load('lib/pdf.ts'),{sharedDemoQuote}=load('lib/shared-demo.ts');
const q=newQuote(true);q.status='Draft';q.expiry='2099-01-01';
const note={id:crypto.randomUUID(),kind:'note',beforeSku:q.items[1].sku,content:[{type:'p',children:[{type:'strong',children:[{type:'text',text:'Supplied assembled'}]}]},{type:'ul',children:[{type:'li',children:[{type:'text',text:'Inspect before use'}]}]}]};
const divider={id:crypto.randomUUID(),kind:'divider',beforeSku:q.items[1].sku,content:[]};q.blocks=[divider,note];
assert.deepEqual(quoteRows(q).slice(0,4).map(r=>r.id),[q.items[0].sku,'block:'+divider.id,'block:'+note.id,q.items[1].sku]);
assert.deepEqual(totals(q),totals({...q,blocks:[]}));
const moved={...q,...moveQuoteRow(q,'block:'+note.id,q.items[0].sku,'before')};assert.equal(quoteRows(moved)[0].id,'block:'+note.id);assert.deepEqual(moved.items,q.items);
const productMoved={...moved,...moveQuoteRow(moved,q.items[1].sku,'block:'+note.id,'before')};assert.equal(quoteRows(productMoved)[0].id,q.items[1].sku);assert.equal(quoteRows(productMoved)[1].id,'block:'+note.id);
assert.equal(reanchorBlocks(q,q.items.filter((i,n)=>n!==1))[0].beforeSku,q.items[2].sku);
const saved=act(q,{action:'save',version:q.version,quote:q});assert.deepEqual(saved.blocks,q.blocks);const ready=act(saved,{action:'ready',version:saved.version});assert.deepEqual(ready.snapshots.at(-1).quote.blocks,q.blocks);
const customer=act(ready,{action:'customer',version:ready.version,items:ready.items,blocks:[],po:'',instructions:''});assert.deepEqual(customer.blocks,q.blocks);
const revised=act(customer,{action:'revise',version:customer.version});assert.deepEqual(revised.blocks,q.blocks);assert.deepEqual(revised.snapshots.at(-1).quote.blocks,q.blocks);
assert.deepEqual(sharedDemoQuote(q).blocks,q.blocks);
const evil={...q,blocks:[{...note,content:[{type:'script',text:'evil()'},{type:'p',onclick:'evil()',children:[{type:'text',text:'<img src=x onerror=evil()>'}]}]}]};
const safe=act(q,{action:'save',version:q.version,quote:evil});assert.doesNotMatch(JSON.stringify(safe.blocks),/onclick|"script"/);assert.match(noteHtml(safe.blocks[0].content),/&lt;img/);assert.doesNotMatch(noteHtml(safe.blocks[0].content),/<img|<script/);
assert.throws(()=>act(q,{action:'save',version:q.version,quote:{...q,blocks:[note,note]}}));assert.throws(()=>act(q,{action:'save',version:q.version,quote:{...q,blocks:[{...note,content:[{type:'text',text:'x'.repeat(31000)}]}]}}));
const pdf=await pdfText(q,'https://example.invalid');assert.match(pdf,/Supplied assembled/);assert.match(pdf,/- Inspect before use/);assert.ok(pdf.indexOf('Supplied assembled')<pdf.indexOf('Cage Storage Stand'));
assert.match(noteHtml(note.content),/<strong>Supplied assembled<\/strong>/);assert.match(noteText([{type:'ol',children:[{type:'li',children:[{type:'text',text:'Step one'}]}]}]),/1. Step one/);
console.log('PASS: mixed row ordering, moving products and blocks, deletion anchors, unchanged totals, save/approval/customer/revision persistence, shared demo, safe formatting, limits and PDF position.');

// Repeated SKUs have independent row identity, editing and address dividers.
const duplicateId=crypto.randomUUID(),baseItem={...q.items[0],baseQty:1,qty:1,price:10000,standardPrice:10000,note:'Sydney'},duplicate={...baseItem,lineId:duplicateId,price:9000,baseQty:2,qty:2,note:'Melbourne'};
const repeated={...q,items:[baseItem,duplicate],blocks:[{...divider,beforeSku:duplicateId}]};
const duplicateSaved=act(repeated,{action:'save',version:repeated.version,quote:repeated});
assert.deepEqual(duplicateSaved.items.map(i=>[i.sku,i.qty,i.price,i.note]),[[baseItem.sku,1,10000,'Sydney'],[baseItem.sku,2,9000,'Melbourne']]);
assert.equal(totals(duplicateSaved).items,28000);
assert.deepEqual(quoteRows(duplicateSaved).map(r=>r.id),[baseItem.sku,'block:'+divider.id,duplicateId]);
const duplicateReady=act(duplicateSaved,{action:'ready',version:duplicateSaved.version});
const changed=act(duplicateReady,{action:'customer',version:duplicateReady.version,items:duplicateReady.items.map(i=>i.lineId===duplicateId?{...i,qty:3}:i)});
assert.deepEqual(changed.items.map(i=>i.qty),[1,3]);assert.equal(changed.status,'Ready');
const reduction=act(duplicateReady,{action:'customer',version:duplicateReady.version,items:duplicateReady.items.map(i=>i.lineId===duplicateId?{...i,qty:1}:i)});
assert.equal(reduction.status,'Changes requested');assert.deepEqual(reduction.items.map(i=>i.qty),[1,1]);
const reordered={...repeated,...moveQuoteRow(repeated,duplicateId,baseItem.sku,'before')};assert.deepEqual(reordered.items.map(i=>i.lineId),[duplicateId,undefined]);
assert.equal(quoteRows(reordered).length,3);assert.equal(reanchorBlocks(repeated,[baseItem])[0].beforeSku,null);
assert.equal(sharedDemoQuote(repeated).items[1].lineId,duplicateId);
const dupPdf=await pdfText(repeated,'https://example.invalid');assert.ok(dupPdf.indexOf('Sydney')<dupPdf.indexOf('Melbourne'));assert.match(dupPdf,/280.00/);
assert.throws(()=>act(repeated,{action:'save',version:repeated.version,quote:{...repeated,items:[duplicate,duplicate]}}),/unique reference/);
const {reviewDemoMargins}=load('lib/demo-margins.ts');const gp=reviewDemoMargins([{...baseItem,demoCost:5000},{...duplicate,demoCost:7000}]);assert.equal(gp.lines[0].pct,50);assert.equal(gp.lines[0].low,false);assert.equal(gp.lines[1].low,true);assert.ok(Math.abs(gp.overall.pct-32.142857142857146)<1e-9);
console.log('PASS: duplicate SKU persistence, independent customer quantities, discounted review, totals, GP, dividers, reordering, removal anchors, demo and PDF.');

const {customerQuoteRows}=load('lib/quote-layout.ts');
const standardRemoved=act(duplicateReady,{action:'customer',version:duplicateReady.version,items:duplicateReady.items.map(i=>i.lineId===duplicateId?i:{...i,qty:0})});
assert.equal(standardRemoved.status,'Ready');assert.equal(standardRemoved.items.length,1);assert.equal(standardRemoved.items[0].lineId,duplicateId);assert.equal(totals(standardRemoved).items,18000);
assert.equal(customerQuoteRows(standardRemoved).filter(r=>r.kind==='product').length,1);
const discountedRemoved=act(duplicateReady,{action:'customer',version:duplicateReady.version,items:duplicateReady.items.map(i=>i.lineId===duplicateId?{...i,qty:0}:i)});
assert.equal(discountedRemoved.status,'Changes requested');assert.equal(discountedRemoved.items[1].qty,0);assert.equal(discountedRemoved.snapshots.at(-1).quote.items[1].qty,2);
assert.deepEqual(customerQuoteRows(discountedRemoved).filter(r=>r.kind==='product').map(r=>r.id),[baseItem.sku]);
assert.equal(customerQuoteRows({...duplicateReady,items:discountedRemoved.items},duplicateReady).filter(r=>r.kind==='product').length,2); // Clear/retype remains possible before saving.
const approvedRemoval=act(discountedRemoved,{action:'ready',version:discountedRemoved.version});assert.equal(approvedRemoval.items.length,1);
const emptyQuote={...duplicateReady,items:[baseItem]};const emptied=act(emptyQuote,{action:'customer',version:emptyQuote.version,items:[{...baseItem,qty:0}]});assert.equal(emptied.items.length,0);assert.equal(customerQuoteRows(emptied).filter(r=>r.kind==='product').length,0);
assert.throws(()=>act(emptied,{action:'accept',version:emptied.version,agreed:true,name:'Test User',payment:'checkout'}),/no items/);
assert.equal(customerQuoteRows({...duplicateReady,items:duplicateReady.items.map(i=>({...i,qty:0}))}).filter(r=>r.kind==='product').length,0);
console.log('PASS: customer removals persist by line, discounted removals retain approval evidence, saved zero rows hide, dividers survive and empty quotes cannot be accepted.');

// Zero quoted prices are valid draft values and remain flagged for review.
const {needsPrice}=load('lib/quote.ts');
const zeroQuote={...q,items:q.items.map((i,index)=>index===0?{...i,price:0}:i)};
for(const status of ['Draft','Changes requested']){
 const draft=act({...zeroQuote,status},{action:'save',version:zeroQuote.version,quote:zeroQuote});
 assert.equal(draft.items[0].price,0);assert.equal(needsPrice(draft.items[0]),true);
 assert.equal(draft.items[0].standardPrice,q.items[0].standardPrice);
 assert.equal(draft.version,zeroQuote.version+1);
 assert.throws(()=>act(draft,{action:'ready',version:draft.version}),/before approval/);
 const priced=act(draft,{action:'save',version:draft.version,quote:{...draft,items:q.items}});
 assert.equal(needsPrice(priced.items[0]),false);
 assert.equal(act(priced,{action:'ready',version:priced.version}).status,'Ready');
}
for(const price of [-1,1.5,NaN])assert.throws(()=>act(q,{action:'save',version:q.version,quote:{...q,items:[{...q.items[0],price}]}}));
console.log('PASS: zero quoted prices save in drafts and changed quotes, remain flagged, retain web price, still require pricing before approval, and invalid prices remain rejected.');

// Customer optional groups follow mixed workspace order and unique line IDs.
const {customerQuoteSections}=load('lib/quote-layout.ts');
const orderedItems=[
 {...baseItem,lineId:'main-one',optional:false},
 {...baseItem,lineId:'option-one',optional:true,selected:false},
 {...baseItem,lineId:'option-two',optional:true,selected:true},
 {...baseItem,lineId:'main-two',optional:false},
 {...baseItem,lineId:'option-three',optional:true,selected:false}
];
const orderedQuote={items:orderedItems,blocks:[]};
const sections=customerQuoteSections(orderedQuote);
assert.deepEqual(sections.map(r=>r.id),['main-one','options:option-one','main-two','options:option-three']);
assert.deepEqual(sections[1].items.map(i=>i.lineId),['option-one','option-two']);
assert.deepEqual(sections[3].items.map(i=>i.lineId),['option-three']);
assert.deepEqual(customerQuoteSections({...orderedQuote,blocks:[{...divider,id:'between-options',beforeSku:'option-two'}]}).map(r=>r.id),['main-one','options:option-one','block:between-options','options:option-two','main-two','options:option-three']);
assert.deepEqual(customerQuoteSections({...orderedQuote,items:[orderedItems[4],orderedItems[0],orderedItems[1]]}).map(r=>r.id),['options:option-three','main-one','options:option-one']);
assert.deepEqual(customerQuoteSections({...orderedQuote,items:orderedItems.filter(i=>i.optional)}).flatMap(r=>r.kind==='options'?r.items.map(i=>i.lineId):[]),['option-one','option-two','option-three']);
const removedMain={...orderedQuote,items:orderedItems.map(i=>i.lineId==='main-two'?{...i,qty:0}:i)};
assert.equal(customerQuoteSections(removedMain).some(r=>r.id==='main-two'),false);
assert.equal(customerQuoteSections(removedMain,orderedQuote).some(r=>r.id==='main-two'),true);
assert.deepEqual(orderedQuote.items.map(i=>i.lineId),orderedItems.map(i=>i.lineId));
console.log('PASS: optional groups stay in workspace order, multiple groups and duplicate SKUs retain unique identities, blocks split groups, leading/only options remain visible, saved removals and unsaved quantities retained.');

// Staff hides generated suggestions without dropping customer selections or financial data.
const {staffQuoteRows}=load('lib/quote-layout.ts');
const autoQuote={...q,items:[orderedItems[0],orderedItems[1],{...orderedItems[2],autoOptionFor:'main-one',autoOptionSource:'related'},orderedItems[3]],blocks:[{...divider,id:'auto-anchor',beforeSku:'option-two'}]};
const originalAutoQuote=JSON.stringify(autoQuote),autoTotals=totals(autoQuote);
assert.deepEqual(staffQuoteRows(autoQuote).map(r=>r.id),['main-one','option-one','block:auto-anchor','main-two']);
assert.equal(staffQuoteRows(autoQuote)[1].item,autoQuote.items[1]);
assert.equal(customerQuoteSections(autoQuote).flatMap(r=>r.kind==='options'?r.items:[]).some(i=>i.lineId==='option-two'),true);
assert.deepEqual(totals(autoQuote),autoTotals);assert.equal(JSON.stringify(autoQuote),originalAutoQuote);
assert.equal(staffQuoteRows({...autoQuote,items:autoQuote.items.map(i=>({...i,optional:false}))}).some(r=>r.id==='option-two'),true);
console.log('PASS: automatic options hidden from staff rows, manual options visible, divider anchors retained, customer options, selections and totals unchanged.');

})().catch(e=>{console.error(e);process.exitCode=1;});
