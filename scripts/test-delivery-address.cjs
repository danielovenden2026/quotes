const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(p){p=path.resolve(root,p);if(cache.has(p))return cache.get(p);const e={};cache.set(p,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(p),n+'.ts')):require(n),e);return e;}
async function pdfText(q,url){const bytes=await load('lib/pdf.ts').quotePdf(q,url);const r=require('child_process').spawnSync('pdftotext',['-','-'],{input:Buffer.from(bytes)});assert.equal(r.status,0);return r.stdout.toString().replace(/\s+/g,' ');}
(async()=>{

const {newQuote}=load('lib/quote.ts'),{applyQuoteAction}=load('lib/quote-actions.ts'),{deliveryAddress,australianStates}=load('lib/delivery-address.ts'),{quotePdf}=load('lib/pdf.ts');
const q=newQuote(true);q.status='Draft';
const save=fields=>applyQuoteAction(q,{action:'save',version:q.version,quote:{...q,...fields}});
assert.equal(deliveryAddress(q),'1 Smith Street, Parramatta New South Wales 2150');
for(const state of australianStates)assert.equal(save({state}).state,state);
const saved=save({address:'5 Example Street',suburb:'Darwin',state:'NT',postcode:'0800',vendorNumber:'  VN-0007  ',customerTerms:'  30 DAYS EOM  '});
assert.equal(saved.customerTerms,'30 DAYS EOM');assert.equal(saved.vendorNumber,'VN-0007');assert.equal(saved.postcode,'0800');assert.equal(deliveryAddress(saved),'5 Example Street, Darwin Northern Territory 0800');
assert.match(await pdfText(saved,'https://example.invalid/quote'),/5 Example Street, Darwin Northern Territory 0800/);
assert.match(await pdfText(saved,'https://example.invalid/quote'),/Vendor Number: VN-0007/);
assert.equal(save({vendorNumber:undefined}).vendorNumber,'');
assert.match(await pdfText(saved,'https://example.invalid/quote'),/Customer terms: 30 DAYS EOM/);
assert.equal(save({customerTerms:undefined}).customerTerms,'');
for(const fields of [{customerTerms:'x'.repeat(201)},{vendorNumber:'X'.repeat(101)},{state:'NZ'},{postcode:'800'},{postcode:'08000'},{postcode:'ABCD'}])assert.throws(()=>save(fields));
const legacy=save({address:'1 Smith Street, Parramatta NSW 2150',suburb:undefined,state:undefined,postcode:undefined});assert.equal(deliveryAddress(legacy),'1 Smith Street, Parramatta NSW 2150');
const approved=applyQuoteAction(saved,{action:'ready',version:saved.version});assert.equal(approved.snapshots.at(-1).quote.postcode,'0800');
const customer=applyQuoteAction(approved,{action:'customer',version:approved.version,items:approved.items,po:'',instructions:'',postcode:'9999',vendorNumber:'CHANGED',customerTerms:'CHANGED'});assert.equal(customer.postcode,'0800');assert.equal(customer.vendorNumber,'VN-0007');assert.equal(customer.customerTerms,'30 DAYS EOM');assert.equal(approved.snapshots.at(-1).quote.customerTerms,'30 DAYS EOM');assert.equal(approved.snapshots.at(-1).quote.vendorNumber,'VN-0007');
console.log('PASS: all Australian states/territories, four-digit postcodes and leading zeros, legacy addresses, save/approval/customer preservation and full PDF address.');

})().catch(e=>{console.error(e);process.exitCode=1;});
