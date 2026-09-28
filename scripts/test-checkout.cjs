const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict'),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const e={};cache.set(file,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n),e);return e;}
const {newQuote,totals}=load('lib/quote.ts'),{initialCheckout}=load('lib/checkout.ts'),{freightNeedsRefresh,freightFingerprint}=load('lib/freight.ts'),{applyQuoteAction}=load('lib/quote-actions.ts');
const q={...newQuote(true),expiry:'2099-12-31'};q.items[0].discount={type:'percent',value:10};const d=initialCheckout(q);d.billing.phone='02 8866 4600';d.purchaseOrder='PO123';d.orderComment='Call before delivery';d.discountCode='EXTRA';
const action=(source,checkout)=>applyQuoteAction(source,{version:source.version,action:'checkout-save',checkout,freight:0,items:[]});
const saved=action(q,d);assert.equal(saved.status,'Ready');assert.equal(saved.acceptedAt,undefined);assert.deepEqual(saved.items,q.items);assert.equal(totals(saved).total,totals(q).total);assert.equal(saved.po,'PO123');assert.equal(saved.checkout.billing.phone,d.billing.phone);assert.equal(freightNeedsRefresh(saved),false);assert.equal(saved.version,q.version+1);
const changed=action(q,{...d,billing:{...d.billing,postcode:'3000',state:'VIC'}});assert.equal(freightNeedsRefresh(changed),true,'Even manually quoted freight is invalidated by a changed destination');assert.throws(()=>applyQuoteAction(changed,{action:'accept',version:changed.version,name:'Test Customer',agreed:true,payment:'checkout'}),/freight/);
const separate=action(q,{...d,sameAddress:false,shipping:{...d.billing,street1:'Other Road',postcode:'0800',state:'NT'}});assert.equal(separate.postcode,'0800');assert.equal(separate.address,'Other Road');assert.equal(freightNeedsRefresh(separate),true);
const forklift=action(q,{...d,hasForklift:true});assert.equal(forklift.handling,0);assert.equal(totals(q).total-totals(forklift).total,2750);
for(const fulfilmentMethod of ['pickup','own-freight'])assert.throws(()=>action(q,{...d,fulfilmentMethod}),/not available/);
const pickup=action({...q,hidePickup:false},{...d,fulfilmentMethod:'pickup'});assert.equal(totals(pickup).subtotal,totals(pickup).items+3500);
for(const status of ['Draft','Accepted','Changes requested','Declined','Awaiting approval'])assert.throws(()=>action({...q,status},d),/approval|expired/);
assert.throws(()=>action({...q,expiry:'2000-01-01'},d),/expired/);
assert.throws(()=>action(q,{...d,billing:{...d.billing,phone:''}}),/Phone/);
assert.throws(()=>action(q,{...d,billing:{...d.billing,postcode:'12'}}),/postcode/);
assert.throws(()=>applyQuoteAction(q,{action:'checkout-save',version:0,checkout:d}),/another window/);
console.log('PASS: checkout saves validated details without acceptance, payment or price changes; hidden fulfilment enforced; destination changes invalidate freight; discounts, GST, pickup and unloading totals retained; status/version guards hold.');
