const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(p){p=path.resolve(root,p);if(cache.has(p))return cache.get(p);const e={};cache.set(p,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n==='server-only'?{}:n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(p),n+'.ts')):require(n),e);return e;}

const {newQuote,totals,money,needsReview}=load('lib/quote.ts'),{netUnitPrice,lineSubtotal,validDiscount}=load('lib/line-pricing.ts'),{applyQuoteAction}=load('lib/quote-actions.ts'),{calculateMargins}=load('lib/margin-math.ts'),{parseMarginItems}=load('lib/gross-profit.ts'),{freightFingerprint}=load('lib/freight.ts'),{quotePdf}=load('lib/pdf.ts');
(async()=>{
 const base={...newQuote(true),status:'Draft',expiry:'2099-10-25',number:'VQ-DISCOUNT',freight:0,handling:0,items:[]};
 const line={sku:'V4000',name:'Forklift Safety Cage / Work Platform',price:10000,standardPrice:10000,qty:3,baseQty:3,optional:false,selected:true,note:''};
 assert.equal(netUnitPrice(line),10000);
 const pct={...line,discount:{type:'percent',value:12.5}},amount={...line,sku:'V4000A',name:'Cage Assembly',discount:{type:'amount',value:1250}};
 for(const i of [pct,amount]){assert.equal(netUnitPrice(i),8750);assert.equal(lineSubtotal(i),26250);assert.ok(validDiscount(i));}
 assert.equal(netUnitPrice({...line,price:999,discount:{type:'percent',value:12.5}}),874);
 const rounded={...line,price:999,discount:{type:'percent',value:33.33}};assert.equal(lineSubtotal(rounded),1998);
 assert.deepEqual(totals({...base,items:[pct,amount,{...line,optional:true,selected:false}]}),{items:52500,subtotal:52500,gst:5250,total:57750});
 let saved=applyQuoteAction(base,{action:'save',version:base.version,quote:{...base,items:[pct,amount]}});assert.deepEqual(saved.items[0].discount,pct.discount);assert.equal(saved.items[0].price,10000);
 for(const discount of [{type:'percent',value:101},{type:'percent',value:-1},{type:'percent',value:1.234},{type:'amount',value:10001},{type:'amount',value:1.5},{type:'bad',value:3},{type:'percent',value:NaN}])assert.throws(()=>applyQuoteAction(base,{action:'save',version:base.version,quote:{...base,items:[{...line,discount}]}}));
 const free=applyQuoteAction(base,{action:'save',version:base.version,quote:{...base,items:[{...line,discount:{type:'percent',value:100}}]}});assert.equal(totals(free).total,0);assert.throws(()=>applyQuoteAction(free,{action:'ready',version:free.version}));
 const parsed=parseMarginItems(saved.items),costs=new Map([['V4000',{averageCost:60}],['V4000A',{averageCost:60}]]),m=calculateMargins(parsed,costs,new Set(costs.keys()));assert.ok(Math.abs(m.overall.pct-31.428571428571427)<1e-8);assert.ok(m.lines.every(i=>i.low));
 const approved=applyQuoteAction(saved,{action:'ready',version:saved.version});assert.deepEqual(approved.snapshots[0].quote.items[0].discount,pct.discount);
 const changed=applyQuoteAction(approved,{action:'customer',version:approved.version,items:[{sku:'V4000',qty:5,selected:true,price:1,discount:{type:'percent',value:99}}]});assert.equal(changed.items[0].price,10000);assert.equal(netUnitPrice(changed.items[0]),8750);assert.equal(changed.items[0].qty,5);assert.equal(changed.status,'Ready');
 const reduced=applyQuoteAction(approved,{action:'customer',version:approved.version,items:[{sku:'V4000',qty:2,selected:true}]});assert.equal(reduced.status,'Changes requested');assert.ok(needsReview({...approved,items:[{...pct,qty:2}]}));
 const revised=applyQuoteAction(approved,{action:'revise',version:approved.version});assert.deepEqual(revised.items[0].discount,pct.discount);
 assert.notEqual(freightFingerprint({...base,items:[line]}),freightFingerprint({...base,items:[pct]}));
 const reset=applyQuoteAction(saved,{action:'save',version:saved.version,quote:{...saved,items:[line]}});assert.equal(totals(reset).items,30000);assert.equal(reset.items[0].discount,undefined);
 const preview={...approved,expiry:'2026-10-25',items:[pct,amount,{...line,sku:'PLAIN',name:'Product without discount',qty:1}]};
 const bytes=await quotePdf(preview,'https://example.invalid/quote/test');const out='/workspace/scratch/df17ab7930d5/tmp/pdfs/quote-discounts.pdf';fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,bytes);
 const r=require('child_process').spawnSync('pdftotext',['-','-'],{input:Buffer.from(bytes)});assert.equal(r.status,0);const text=r.stdout.toString().replace(/\s+/g,' ');for(const s of ['Discount: 12.5% off','Discount: $12.50 off / unit','$100.00','$87.50','$262.50',money(totals(preview).total)])assert.ok(text.includes(s),s);
 console.log('PASS: discounted totals/GST, rounding, invalid discounts, save/revision/restore, customer price tampering, quantity approval, GP, freight and PDF output.');console.log(out);
})().catch(e=>{console.error(e);process.exit(1);});
