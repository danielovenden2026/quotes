const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(p){p=path.resolve(root,p);if(cache.has(p))return cache.get(p);const e={};cache.set(p,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(p),n+'.ts')):require(n),e);return e;}
async function pdfText(q,url){const bytes=await load('lib/pdf.ts').quotePdf(q,url);const r=require('child_process').spawnSync('pdftotext',['-','-'],{input:Buffer.from(bytes)});assert.equal(r.status,0);return r.stdout.toString().replace(/\s+/g,' ');}
(async()=>{

const {newQuote,totals}=load('lib/quote.ts'),{applyQuoteAction:act}=load('lib/quote-actions.ts'),{quotePdf}=load('lib/pdf.ts'),{sharedDemoQuote}=load('lib/shared-demo.ts');
const q=newQuote(true);q.hidePickup=false;q.hideOwnFreight=false;q.expiry='2099-01-01';const original=totals(q);
const customer=(quote,extra={})=>act(quote,{action:'customer',version:quote.version,items:quote.items,po:'',instructions:'',...extra});
const picked=customer(q,{fulfilmentMethod:'pickup',freight:0,handling:0,pickupFee:0});
assert.equal(picked.status,'Ready');assert.equal(picked.fulfilmentMethod,'pickup');assert.equal(picked.freight,8726);assert.equal(picked.handling,2500);
assert.deepEqual(totals(picked),{items:124500,subtotal:128000,gst:12800,total:140800});
assert.deepEqual(totals(customer(picked,{fulfilmentMethod:'delivery'})),original);
const legacy={...q};delete legacy.fulfilmentMethod;assert.deepEqual(totals(legacy),original);assert.equal(customer(legacy).fulfilmentMethod,'delivery');
assert.throws(()=>customer(q,{fulfilmentMethod:'free'}));assert.throws(()=>customer(q,{version:0,fulfilmentMethod:'pickup'}));
const draft=act(picked,{action:'revise',version:picked.version});const saved=act(draft,{action:'save',version:draft.version,quote:{...draft,fulfilmentMethod:'pickup',pickupFee:1}});assert.equal(totals(saved).total,140800);
const ready=act(saved,{action:'ready',version:saved.version});assert.equal(ready.snapshots.at(-1).quote.fulfilmentMethod,'pickup');
const accepted=act(ready,{action:'accept',version:ready.version,name:'Alex Smith',agreed:true,payment:'account',po:'P123',fulfilmentMethod:'delivery'});assert.equal(accepted.fulfilmentMethod,'pickup');assert.equal(totals(accepted).total,140800);assert.throws(()=>customer(accepted,{fulfilmentMethod:'delivery'}));
assert.equal(sharedDemoQuote(picked).fulfilmentMethod,'pickup');
const pdf=await pdfText(picked,'https://example.invalid');assert.match(pdf,/Pickup/);assert.doesNotMatch(pdf,/Pickup from Verdex/);assert.match(pdf,/35.00/);assert.doesNotMatch(pdf,/Site handling|87.26/);
const discount={...q,items:q.items.map((i,n)=>n?i:{...i,qty:2,baseQty:2,standardPrice:i.price+1000})};const reduced=customer(discount,{fulfilmentMethod:'pickup',items:discount.items.map((i,n)=>n?i:{...i,qty:1})});assert.equal(reduced.status,'Changes requested');assert.equal(reduced.snapshots.at(-1).quote.fulfilmentMethod,'delivery');assert.equal(reduced.fulfilmentMethod,'pickup');
console.log('PASS: fixed ex-GST pickup, delivery restoration, legacy defaults, server validation/tamper resistance, save/approval/revision/acceptance, shared demo, PDF and discounted quantity review.');

const hidden=act(draft,{action:'save',version:draft.version,quote:{...draft,hidePickup:true,fulfilmentMethod:'pickup'}});assert.equal(hidden.hidePickup,true);assert.equal(hidden.fulfilmentMethod,'delivery');assert.deepEqual(totals(hidden),original);
const hiddenReady=act(hidden,{action:'ready',version:hidden.version});assert.equal(hiddenReady.snapshots.at(-1).quote.hidePickup,true);assert.equal(sharedDemoQuote(hiddenReady).hidePickup,true);
assert.throws(()=>customer(hiddenReady,{fulfilmentMethod:'pickup',hidePickup:false}),/Pickup is not available/);assert.equal(customer(hiddenReady,{fulfilmentMethod:'delivery',hidePickup:false}).hidePickup,true);
const hiddenRevision=act(hiddenReady,{action:'revise',version:hiddenReady.version});assert.equal(hiddenRevision.hidePickup,true);
const visible=act(hiddenRevision,{action:'save',version:hiddenRevision.version,quote:{...hiddenRevision,hidePickup:false}});const visibleReady=act(visible,{action:'ready',version:visible.version});assert.equal(customer(visibleReady,{fulfilmentMethod:'pickup'}).fulfilmentMethod,'pickup');
console.log('PASS: hide-pickup persistence, delivery normalization, customer enforcement, revision/demo preservation and re-enabling pickup.');

const own=customer(q,{fulfilmentMethod:'own-freight'});
assert.deepEqual(totals(own),{items:124500,subtotal:124500,gst:12450,total:136950});
assert.deepEqual(totals(customer(own,{fulfilmentMethod:'delivery'})),original);
const ownSaved=act(draft,{action:'save',version:draft.version,quote:{...draft,fulfilmentMethod:'own-freight',hidePickup:true,ownFreightNotes:'Carrier ABC\nAccount 123'}});
assert.equal(ownSaved.fulfilmentMethod,'own-freight');
const ownReady=act(ownSaved,{action:'ready',version:ownSaved.version});
assert.equal(ownReady.fulfilmentMethod,'own-freight');
assert.equal(ownReady.snapshots.at(-1).quote.ownFreightNotes,'Carrier ABC\nAccount 123');
assert.equal(sharedDemoQuote(ownReady).ownFreightNotes,'Carrier ABC\nAccount 123');
assert.equal(customer(ownReady,{ownFreightNotes:'Forged notes'}).ownFreightNotes,'Carrier ABC\nAccount 123');
const ownPdf=await pdfText(ownReady,'https://example.invalid');
assert.match(ownPdf,/Own Freight/);assert.doesNotMatch(ownPdf,/Carrier ABC/);assert.doesNotMatch(ownPdf,/Site handling|87.26/);
const ownHidden=act(draft,{action:'save',version:draft.version,quote:{...draft,fulfilmentMethod:'own-freight',hideOwnFreight:true}});
assert.equal(ownHidden.fulfilmentMethod,'delivery');assert.deepEqual(totals(ownHidden),original);
const ownHiddenReady=act(ownHidden,{action:'ready',version:ownHidden.version});
assert.equal(ownHiddenReady.snapshots.at(-1).quote.hideOwnFreight,true);
assert.equal(sharedDemoQuote(ownHiddenReady).hideOwnFreight,true);
assert.throws(()=>customer(ownHiddenReady,{fulfilmentMethod:'own-freight',hideOwnFreight:false}),/Own Freight is not available/);
assert.equal(customer(ownHiddenReady,{fulfilmentMethod:'pickup'}).fulfilmentMethod,'pickup');
const ownHiddenRevision=act(ownHiddenReady,{action:'revise',version:ownHiddenReady.version});
assert.equal(ownHiddenRevision.hideOwnFreight,true);
const ownUnhidden=act(ownHiddenRevision,{action:'save',version:ownHiddenRevision.version,quote:{...ownHiddenRevision,hideOwnFreight:false}});
const ownUnhiddenReady=act(ownUnhidden,{action:'ready',version:ownUnhidden.version});
assert.equal(customer(ownUnhiddenReady,{fulfilmentMethod:'own-freight'}).fulfilmentMethod,'own-freight');
console.log('PASS: Own Freight totals, notes, PDF, independent visibility, customer enforcement, revisions and shared demo.');

// Customers select an unloading method; only the server sets its fixed price.
const forklift=customer(q,{hasForklift:true,handling:99999});
assert.equal(forklift.handling,0);assert.equal(forklift.freight,q.freight);assert.equal(forklift.status,'Ready');
assert.equal(totals(forklift).total,original.total-2750);
assert.match(forklift.events.at(-1).text,/Forklift available/);
const handUnload=customer(forklift,{hasForklift:false,handling:1});
assert.equal(handUnload.handling,2500);assert.deepEqual(totals(handUnload),original);
assert.match(handUnload.events.at(-1).text,/Hand unload selected/);
assert.throws(()=>customer(q,{hasForklift:'true'}));
assert.equal(customer({...q,handling:7000},{handling:0}).handling,7000);
assert.deepEqual(totals(customer(picked,{hasForklift:false})),totals(picked));
assert.deepEqual(totals(customer(own,{hasForklift:false})),totals(own));
assert.equal(sharedDemoQuote(forklift).handling,0);
const forkliftRevision=act(forklift,{action:'revise',version:forklift.version});assert.equal(forkliftRevision.handling,0);
const forkliftAcceptance=act(forklift,{action:'accept',version:forklift.version,name:'Alex Smith',agreed:true,payment:'account',po:'P456'});
assert.equal(forkliftAcceptance.handling,0);assert.equal(totals(forkliftAcceptance).total,totals(forklift).total);
assert.throws(()=>customer(forkliftAcceptance,{hasForklift:false}));
console.log('PASS: customer forklift selection, fixed hand-unload fee, GST, tamper resistance, pickup/own freight totals, revisions, demo and acceptance.');
const {freightFingerprint}=load('lib/freight.ts');
const calculated={...q,freightEstimate:{fingerprint:freightFingerprint(q),carrierCode:'carriertablerate',methodCode:'carriertablerate',label:'Delivery',amount:q.freight,calculatedAt:new Date().toISOString()}};
assert.equal(customer(calculated,{hasForklift:true}).status,'Ready');

})().catch(e=>{console.error(e);process.exitCode=1;});
