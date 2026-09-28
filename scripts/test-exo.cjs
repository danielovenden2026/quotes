const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),objects=new Map(),modules=new Map();
const config={COST_ADMIN_USER_IDS:'admin',COST_SHEET_ID:'original_sheet_identifier_12345',COST_SHEET_TAB:'Costs',BUCKET:{get:async key=>objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null,put:async(key,value)=>objects.set(key,value)}};
function load(file){file=path.resolve(root,file);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file));if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','exports',js)(name=>{if(name==='server-only')return {};if(name==='cloudflare:workers')return {env:config};if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);return load((name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name))+(name.endsWith('.json')?'':'.ts'));},exports);return exports;}

const csv='SKU,Description,Sell Price,Sales HTML,Average Cost\n EX-1 ,Test EXO,"$1,234.50","<ul><li>Safe</li></ul><script>unsafe()</script>",999\nZERO,Zero product,0,Details,999\nex-1,Duplicate,1,,\n,Missing SKU,22,,\nBAD,Bad price,nope,,';
let calls=0;
global.fetch=async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(csv,{headers:{'content-type':'text/csv'}});};
(async()=>{
 const exo=load('lib/exo-catalogue.ts'),settings=load('lib/connection-settings.ts'),search=load('app/api/workspace/exo-products/route.ts'),connections=load('app/api/admin/connections/route.ts');
 const parsed=exo.parseExoCsv(csv);assert.equal(parsed.products.length,2);assert.equal(parsed.skipped,3);assert.equal(parsed.products[0].price,123450);assert.equal(parsed.products[1].price,0);assert.equal(parsed.products[0].exoDescriptionHtml,'<ul><li>Safe</li></ul>');assert.equal(parsed.products[0].averageCost,undefined);
 assert.throws(()=>exo.parseExoCsv('SKU,Description\nA,Name'));
 assert.equal((await settings.getExoSettings()).tab,'exo');assert.equal((await settings.getExoSettings()).sheetId,config.COST_SHEET_ID);
 assert.equal((await search.GET(new Request('https://quote.test/api/workspace/exo-products?q=EX'))).status,401);assert.equal(calls,0);
 const staff={'oai-authenticated-user-id':'staff','oai-authenticated-user-email':'staff@example.test'};
 const response=await search.GET(new Request('https://quote.test/api/workspace/exo-products?q=test%20EXO',{headers:staff}));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);const result=await response.json();assert.equal(result.products.length,1);assert.equal(result.products[0].sku,'EX-1');assert.doesNotMatch(JSON.stringify(result),/averageCost|999/);
 await exo.getExoCatalogue();assert.equal(calls,1);await exo.getExoCatalogue(true);assert.equal(calls,2);
 const realNow=Date.now;Date.now=()=>realNow()+16*60_000;await exo.getExoCatalogue();assert.equal(calls,3);Date.now=realNow;
 const candidate={sheetId:'exo_sheet_identifier_12345',tab:'Stock',refreshMinutes:5};
 const request=(action,id='admin')=>new Request('https://quote.test/api/admin/connections',{method:'POST',headers:{...staff,'oai-authenticated-user-id':id,origin:'https://quote.test','content-type':'application/json'},body:JSON.stringify({kind:'exo',action,settings:candidate})});
 assert.equal((await connections.POST(request('save','staff'))).status,403);
 assert.equal((await connections.POST(request('test'))).status,200);assert.equal((await settings.getExoSettings()).tab,'exo');
 assert.equal((await connections.POST(request('save'))).status,200);assert.equal((await settings.getExoSettings()).tab,'Stock');assert.equal((await settings.getSheetSettings()).tab,'Costs');
 const before=calls;await exo.getExoCatalogue();assert.equal(calls,before);assert.equal((await connections.POST(request('refresh'))).status,200);assert.equal(calls,before+1);
 const line={...parsed.products[0],lineId:'11111111-1111-4111-8111-111111111111',sku:' ex-1 ',standardPrice:1,exoDescriptionHtml:'<script>bad()</script>',price:500};
 const saved=await exo.withExoProducts({items:[line]},{items:[]});assert.equal(saved.items[0].standardPrice,123450);assert.equal(saved.items[0].price,500);assert.equal(saved.items[0].sku,'EX-1');assert.equal(saved.items[0].exoDescriptionHtml,parsed.products[0].exoDescriptionHtml);
 const edited=await exo.withExoProducts({items:[{...saved.items[0],name:'Edited name',standardPrice:1,exoDescriptionHtml:'fake'}]},saved);assert.equal(edited.items[0].standardPrice,123450);assert.equal(edited.items[0].name,'Edited name');assert.equal(edited.items[0].exoDescriptionHtml,parsed.products[0].exoDescriptionHtml);
 await assert.rejects(()=>exo.withExoProducts({items:[{...saved.items[0],productSource:undefined}]},saved));
 const standards=load('lib/standard-prices.ts');const standard=await standards.withStandardPrices(saved,{items:[]});assert.equal(standard.items[0].standardPrice,123450);
 if(process.env.EXO_SAMPLE){const full=exo.parseExoCsv(fs.readFileSync(process.env.EXO_SAMPLE,'utf8'));assert.ok(full.products.length>100);console.log('Actual EXO sheet:',full.products.length,'valid products;',full.skipped,'invalid/duplicate rows skipped.');}
 console.log('PASS: EXO mapping, sanitised details, zero price, duplicates, staff search, admin settings, independent source, cache/refresh and trusted saved product metadata.');
})().catch(e=>{console.error(e);process.exit(1);});
