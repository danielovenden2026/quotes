const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),loaded=new Map(),config={COST_ADMIN_USER_IDS:'test-admin'};
let reads=0;
const costs=new Map([['A',{averageCost:60,latestCost:999}],['B',{averageCost:80,latestCost:999}],['LOSS',{averageCost:150,latestCost:999}],['ZERO',{averageCost:0,latestCost:999}]]);
const skus=new Set(['A','B','LOSS','ZERO','MISSING']);
function load(file){
 file=path.resolve(root,file);if(loaded.has(file))return loaded.get(file);
 const exports={};loaded.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(name=>{
  if(name==='server-only')return {};
  if(name==='cloudflare:workers')return {env:config};
  const target=path.resolve(name.startsWith('@/')?path.join(root,name.slice(2)+'.ts'):path.join(path.dirname(file),name+'.ts'));
  if(target===path.join(root,'lib/cost-data.ts'))return {getCosts:async()=>{reads++;return costs;}};
  if(target===path.join(root,'lib/catalogue-data.ts'))return {getCatalogue:async()=>({products:[...skus].map(sku=>({sku}))})};
  return load(target);
 },exports);return exports;
}
const item=(sku,qty=1,price=10000,optional=false,selected=true)=>({sku,qty,price,optional,selected});
(async()=>{
 const {calculateMargins,parseMarginItems}=load('lib/gross-profit.ts');
 const calc=items=>calculateMargins(items,costs,skus);
 assert.equal(calc([item('A')]).lines[0].pct,40);assert.equal(calc([item('A')]).lines[0].low,false);
 assert.equal(calc([item('A',1,9900)]).lines[0].low,true);
 const boundary=calculateMargins([item('FRACTION',1,3)],new Map([['FRACTION',{averageCost:0.018000000000000002,latestCost:null}]]),new Set(['FRACTION']));assert.equal(boundary.lines[0].low,false);assert.equal(boundary.overall.low,false);
 assert.equal(calc([item('LOSS')]).overall.pct,-50);
 assert.equal(calc([item('ZERO')]).overall.pct,100);
 assert.equal(calc([item('A'),item('B',9)]).overall.pct,22);
 assert.equal(calc([item('A'),item('MISSING',1,10000,true,false)]).overall.pct,40);
 assert.equal(calc([item('A'),item('MISSING',1,10000,true,true)]).overall.pct,null);
 assert.equal(calc([item('A'),item('MISSING',0)]).overall.pct,40);
 assert.equal(calc([item('A',1,0)]).overall.pct,null);
 assert.equal(calc([]).overall.pct,null);
 assert.equal(calc([item(' a ')]).overall.pct,40);
 assert.equal(calculateMargins([item('A')],costs,new Set()).overall.pct,null);
 assert.throws(()=>parseMarginItems([item('A'),item(' a ')]));
 assert.throws(()=>parseMarginItems([item('A',-1)]));
 assert.throws(()=>parseMarginItems([item('A',1,NaN)]));
 assert.throws(()=>parseMarginItems(Array.from({length:51},(_,i)=>item(String(i)))));
 const clean=parseMarginItems([{...item('A'),averageCost:0,gp:100}]);assert.equal(clean[0].averageCost,undefined);
 const api=load('app/api/admin/gp-status/route.ts'),frame=load('app/admin/gp/route.ts');
 function request(items,user='test-admin',origin='https://test.invalid',html=false){return new Request('https://test.invalid/'+(html?'admin/gp':'api/admin/gp-status'),{method:'POST',headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'test@example.invalid'}:{}),origin,'Content-Type':html?'application/x-www-form-urlencoded':'application/json'},body:html?new URLSearchParams({items:JSON.stringify(items),kind:'summary'}):JSON.stringify({items})});}
 for(const user of ['', 'not-admin']){assert.equal((await api.POST(request([item('A')],user))).status,user?403:401);assert.equal((await frame.POST(request([item('A')],user,undefined,true))).status,user?403:401);}
 assert.equal(reads,0);
 assert.equal((await api.POST(request([item('A')],'test-admin','https://other.invalid'))).status,403);
 assert.equal((await frame.POST(request([item('A')],'test-admin','https://other.invalid',true))).status,403);
 assert.equal(reads,0);
 assert.equal((await api.POST(request([item('A',-1)]))).status,400);
 const response=await api.POST(request([item('A'),item('B')]));assert.deepEqual(await response.json(),{lowSkus:['B']});assert.match(response.headers.get('cache-control'),/no-store/);
 const html=await frame.POST(request([item('A'),item('B',9)],'test-admin',undefined,true));const text=await html.text();assert.match(text,/22\.0%/);assert.match(text,/Below the 40% target/);assert.doesNotMatch(text,/<script|averageCost|latestCost|999/);assert.match(html.headers.get('content-security-policy'),/sandbox/);
 const missing=await frame.POST(request([item('A'),item('MISSING')],'test-admin',undefined,true));assert.match(await missing.text(),/N\/A/);
 config.COST_ADMIN_USER_IDS='';assert.equal((await frame.POST(request([item('A')],'test-admin',undefined,true))).status,403);
 console.log('PASS: weighted GP, exact 40% boundary, losses, zero/missing costs, optional/zero quantity handling, validation, admin/origin enforcement and script-free private rendering.');
})().catch(e=>{console.error(e);process.exitCode=1;});
