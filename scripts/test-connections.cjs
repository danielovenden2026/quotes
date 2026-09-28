const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),objects=new Map(),modules=new Map();
const config={COST_ADMIN_USER_IDS:'admin',COST_SHEET_ID:'original_sheet_identifier_12345',COST_SHEET_TAB:'Costs',BUCKET:{get:async key=>objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null,put:async(key,value)=>objects.set(key,value)}};
function load(file){file=path.resolve(root,file);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file));if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','exports',js)(name=>{if(name==='server-only')return {};if(name==='cloudflare:workers')return {env:config};if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);return load((name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name))+(name.endsWith('.json')?'':'.ts'));},exports);return exports;}
let calls=0,fail=false;
global.fetch=async(url,init)=>{calls++;assert.equal(init.redirect,'manual');if(fail)return new Response('unavailable',{status:503});if(String(url).startsWith('https://docs.google.com/'))return new Response('SKU,Average Cost,Total Stock,Melbourne,Brisbane,Sydney,Committed\n test ,123.45,12,3,4,5,8',{headers:{'Content-Type':'text/csv'}});return new Response('<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>TEST</g:id><title>Test</title><g:price>200</g:price></item></channel></rss>');};
const headers={'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'admin@example.test','origin':'https://quote.test','content-type':'application/json'};
const request=(body,extra={})=>new Request('https://quote.test/api/admin/connections',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
(async()=>{
 const settings=load('lib/connection-settings.ts'),route=load('app/api/admin/connections/route.ts'),costs=load('lib/cost-data.ts'),catalogue=load('lib/catalogue-data.ts');
 assert.equal((await settings.getSheetSettings()).sheetId,config.COST_SHEET_ID);
 assert.equal(settings.parseSheetSettings({sheetId:' https://docs.google.com/spreadsheets/d/replacement_identifier_12345/edit#gid=0 ',tab:' Costs '}).sheetId,'replacement_identifier_12345');
 for(const url of ['http://www.verdex.com.au/media/feed.xml','https://evil.test/media/feed.xml','https://www.verdex.com.au.evil.test/media/feed.xml','https://user:pass@www.verdex.com.au/media/feed.xml','https://www.verdex.com.au/media/../admin/feed.xml','https://127.0.0.1/media/feed.xml','https://www.verdex.com.au/media/feed.xml?target=x'])assert.throws(()=>settings.parseFeedSettings({url}));
 for(const kind of ['sheet','feed','gp','autoOptions'])for(const action of ['test','save','refresh']){
  assert.equal((await route.POST(request({kind,action},{'oai-authenticated-user-id':''}))).status,401);
  assert.equal((await route.POST(request({kind,action},{'oai-authenticated-user-id':'outsider'}))).status,403);
  assert.equal((await route.POST(request({kind,action},{origin:'https://evil.test'}))).status,403);
 }
 assert.equal(calls,0);assert.equal(objects.size,0);
 assert.equal((await route.GET(new Request('https://quote.test/api/admin/connections'))).status,401);
 const get=await route.GET(new Request('https://quote.test/api/admin/connections',{headers}));assert.match(get.headers.get('cache-control'),/private, no-store/);assert.equal((await get.json()).sheet.tab,'Costs');
 assert.equal((await route.POST(request({kind:'sheet',action:'save',settings:{sheetId:'x'.repeat(9000)}}))).status,400);
 assert.equal((await settings.getSheetSettings()).refreshMinutes,15);
 assert.equal((await settings.getFeedSettings()).refreshMinutes,15);
 for(const refreshMinutes of [0,-1,1.5,1441,'15',null])for(const kind of ['sheet','feed']){
  const invalid=kind==='sheet'?{sheetId:config.COST_SHEET_ID,tab:'Costs',refreshMinutes}:{url:'https://www.verdex.com.au/media/feed.xml',refreshMinutes};
  assert.equal((await route.POST(request({kind,action:'save',settings:invalid}))).status,400);
 }
 const candidate={refreshMinutes:2,sheetId:'replacement_identifier_12345',tab:'Costs'};
 let response=await route.POST(request({kind:'sheet',action:'test',settings:candidate}));assert.equal(response.status,200);assert.equal(objects.size,0);assert.doesNotMatch(await response.text(),/123\.45|averageCost/);
 fail=true;response=await route.POST(request({kind:'sheet',action:'save',settings:candidate}));assert.equal(response.status,400);assert.equal((await settings.getSheetSettings()).sheetId,config.COST_SHEET_ID);
 fail=false;response=await route.POST(request({kind:'sheet',action:'save',settings:candidate}));assert.equal(response.status,200);assert.equal((await settings.getSheetSettings()).sheetId,candidate.sheetId);let count=calls;assert.equal((await settings.getSheetSettings()).refreshMinutes,2);assert.equal((await costs.getCosts()).get('TEST').stock.committedStock,8);assert.equal((await costs.getCosts()).get('TEST').averageCost,123.45);assert.equal(calls,count,'saved sheet should seed the cache');
 await settings.saveConnectionSettings('sheet',{...candidate,sheetId:'different_identifier_12345'});await costs.getCosts();assert.equal(calls,++count,'source change must reload costs');await costs.getCosts(true);assert.equal(calls,++count,'refresh must bypass cache');
 const feed={refreshMinutes:3,url:'https://www.verdex.com.au/media/feed/testing.xml'};
 response=await route.POST(request({kind:'feed',action:'test',settings:feed}));assert.equal(response.status,200);assert.notEqual((await settings.getFeedSettings()).url,feed.url);
 response=await route.POST(request({kind:'feed',action:'save',settings:feed}));assert.equal(response.status,200);assert.equal((await settings.getFeedSettings()).url,feed.url);count=calls;assert.equal((await catalogue.getCatalogue()).products[0].sku,'TEST');assert.equal(calls,count,'saved feed should seed the cache');
 const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
 try{
  await costs.getCosts(true);await catalogue.getCatalogue(true);count=calls;
  clock+=119999;await costs.getCosts();await catalogue.getCatalogue();assert.equal(calls,count);
  clock+=1;await costs.getCosts();await catalogue.getCatalogue();assert.equal(calls,++count,'sheet uses its two-minute interval');
  clock+=60000;await catalogue.getCatalogue();assert.equal(calls,++count,'feed uses its three-minute interval');
  await settings.saveConnectionSettings('feed',{...feed,refreshMinutes:1});await catalogue.getCatalogue();assert.equal(calls,++count,'changed interval invalidates warm feed cache');
  await settings.saveConnectionSettings('sheet',{...candidate,refreshMinutes:1});await costs.getCosts();assert.equal(calls,++count,'changed interval invalidates warm sheet cache');
  clock+=60000;await costs.getCosts();await catalogue.getCatalogue();assert.equal(calls,count+2);
 }finally{Date.now=realNow;}
 fail=true;response=await route.POST(request({kind:'feed',action:'save',settings:{url:'https://www.verdex.com.au/media/feed/broken.xml'}}));assert.equal(response.status,400);assert.equal((await settings.getFeedSettings()).url,feed.url);assert.equal((await catalogue.getCatalogue()).products[0].sku,'TEST');
 assert.equal((await route.POST(request({kind:'feed',action:'refresh'}))).status,400);
 fail=false;assert.equal((await route.POST(request({kind:'feed',action:'refresh'}))).status,200);
 modules.clear();assert.equal((await load('lib/connection-settings.ts').getFeedSettings()).url,feed.url,'settings persist across module restarts');
 const gpSettings=load('lib/gp-settings.ts');assert.equal((await gpSettings.getGpSettings()).targetPct,40);
 for(const targetPct of [-1,101,35.55,'35',null]){assert.equal((await route.POST(request({kind:'gp',action:'save',settings:{targetPct}}))).status,400);assert.equal((await gpSettings.getGpSettings()).targetPct,40);}
 assert.equal((await route.POST(request({kind:'gp',action:'test',settings:{targetPct:35}}))).status,400);
 count=calls;const gpSave=await route.POST(request({kind:'gp',action:'save',settings:{targetPct:35}}));assert.equal(gpSave.status,200);assert.equal(calls,count,'GP setting must not fetch the sheet or catalogue');
 assert.equal((await gpSettings.getGpSettings()).targetPct,35);
 modules.clear();assert.equal((await load('lib/gp-settings.ts').getGpSettings()).targetPct,35,'GP target survives restarts');
 const gpGet=await route.GET(new Request('https://quote.test/api/admin/connections',{headers}));assert.equal((await gpGet.json()).gp.targetPct,35);
 for(const targetPct of [0,35.5,100])assert.equal(gpSettings.parseGpSettings({targetPct}).targetPct,targetPct);
 const autoSettings=load('lib/auto-options-settings.ts');
 assert.equal((await autoSettings.getAutoOptionsSettings()).maxOptions,20);
 for(const maxOptions of [-1,51,2.5,'20',null]){assert.equal((await route.POST(request({kind:'autoOptions',action:'save',settings:{maxOptions}}))).status,400);assert.equal((await autoSettings.getAutoOptionsSettings()).maxOptions,20);}
 assert.equal((await route.POST(request({kind:'autoOptions',action:'refresh'}))).status,400);
 assert.equal((await route.POST(request({kind:'autoOptions',action:'save',settings:{maxOptions:10}}))).status,200);
 modules.clear();assert.equal((await load('lib/auto-options-settings.ts').getAutoOptionsSettings()).maxOptions,10);
 const autoGet=await route.GET(new Request('https://quote.test/api/admin/connections',{headers}));assert.equal((await autoGet.json()).autoOptions.maxOptions,10);
 const publicCatalogue=await load('app/api/catalogue/route.ts').GET();const publicData=await publicCatalogue.json();assert.equal(publicData.autoOptionsLimit,10);assert.equal(publicData.products[0].sku,'TEST');assert.equal(publicData.sheet,undefined);
 for(const maxOptions of [0,20,50])assert.equal(autoSettings.parseAutoOptionsSettings({maxOptions}).maxOptions,maxOptions);
 console.log('PASS: automatic options default, authenticated/admin/origin checks, integer bounds, persistence, settings readback and current catalogue limit.');
 console.log('PASS: GP target default, admin-only updates, decimal/range validation and persistence across restarts.');
 console.log('PASS: authenticated settings, origin checks, bounded input, URL restrictions, test without save, failed-save preservation, persistent settings, cache refresh and invalidation, and no raw costs in responses.');
})().catch(error=>{console.error(error);process.exit(1);});
