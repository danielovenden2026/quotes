const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict'),cache=new Map(),objects=new Map();
const config={HUBSPOT_CREDENTIAL_KEY:Buffer.alloc(32,17).toString('base64'),BUCKET:{get:async k=>objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null,put:async(k,v)=>objects.set(k,v),delete:async k=>objects.delete(k)}};
let access=200;
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('/lib/admin-access.ts'))return {adminAccess:async()=>access,privateHeaders:{'Cache-Control':'private, no-store'}};const e={};cache.set(file,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n==='server-only'?{}:n==='cloudflare:workers'?{env:config}:n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n),e);return e;}
const eway=load('lib/eway.ts'),route=load('app/api/admin/eway/route.ts'),calls=[];let mode='success';
global.fetch=async(url,options)=>{calls.push({url,options});if(mode==='reject')return new Response('',{status:401});if(mode==='redirect')return new Response('',{status:302,headers:{location:'https://other.test'}});if(mode==='unexpected')return Response.json({});return Response.json({Errors:'V6171',Transactions:[]});};
const credentials={mode:'sandbox',apiKey:'private-api-key-for-test',apiPassword:'private-password-for-test'};
const req=body=>new Request('https://quote.test/api/admin/eway',{method:body?'POST':'GET',headers:{origin:'https://quote.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
 assert.equal((await eway.ewayStatus()).configured,false);
 const response=await route.POST(req({action:'connect',...credentials}));assert.equal(response.status,200);const status=await response.json();assert.equal(status.configured,true);assert.equal(status.paymentsEnabled,false);assert.equal(status.mode,'sandbox');assert.equal(JSON.stringify(status).includes(credentials.apiKey),false);assert.equal(JSON.stringify(status).includes(credentials.apiPassword),false);
 const stored=[...objects.values()][0];assert.ok(stored);assert.ok(!stored.includes(credentials.apiKey)&&!stored.includes(credentials.apiPassword));assert.equal((await eway.getEwayCredentials()).apiPassword,credentials.apiPassword);
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'manual');assert.ok(calls[0].url.startsWith('https://api.sandbox.ewaypayments.com/Transaction/InvoiceNumber/'));assert.equal(calls[0].options.body,undefined);
 const get=await route.GET(req());assert.equal(get.headers.get('cache-control'),'private, no-store');assert.ok(!(await get.text()).includes(credentials.apiKey));
 for(mode of ['reject','redirect','unexpected']){const failed=await route.POST(req({action:'connect',...credentials,mode:'live'}));assert.notEqual(failed.status,200);assert.equal([...objects.values()][0],stored,'Failed verification must preserve old credentials');assert.ok(!(await failed.text()).includes(credentials.apiPassword));}
 mode='success';await eway.saveEwayConnection({...credentials,mode:'live'});assert.ok(calls.at(-1).url.startsWith('https://api.ewaypayments.com/'));assert.equal((await eway.ewayStatus()).mode,'live');
 access=403;const before=calls.length;assert.equal((await route.POST(req({action:'test'}))).status,403);assert.equal((await route.GET(req())).status,403);assert.equal(calls.length,before);
 access=200;const cross=req({action:'disconnect'});cross.headers.set('origin','https://other.test');assert.equal((await route.POST(cross)).status,403);assert.equal((await eway.ewayStatus()).configured,true);
 assert.equal((await route.POST(req({action:'connect',apiKey:'short',apiPassword:'x',mode:'sandbox'}))).status,400);
 await route.POST(req({action:'disconnect'}));assert.equal((await eway.ewayStatus()).configured,false);
 console.log('PASS: encrypted credential storage, redacted status and errors, read-only authentication probe, correct mode hosts, failed updates retained, permissions and origin enforced, disconnect. No real eWAY requests made.');
})();
