const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),modules=new Map(),objects=new Map();
const config={COST_ADMIN_USER_IDS:'approved-admin',HUBSPOT_CREDENTIAL_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),BUCKET:{head:async key=>objects.has(key)?{}:null,get:async key=>objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null,put:async(key,value)=>objects.set(key,value),delete:async key=>objects.delete(key)}};
function load(file){file=path.resolve(root,file);if(modules.has(file))return modules.get(file);const result={};modules.set(file,result);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',js)(name=>name==='server-only'?{}:name==='cloudflare:workers'?{env:config}:name.startsWith('@/')?load(name.slice(2)+'.ts'):name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),result);return result;}
let calls=[],failure=0,schemaMode='normal',associationFailure=false,individualFailure=false,companyFailure=false;
const token='test-only-token-not-a-real-credential';
global.fetch=async(url,init)=>{
 calls.push({url,init});assert.match(url,/^https:\/\/api\.hubapi\.com\/crm\/v[34]\/(objects|properties|associations)\//);assert.equal(init.headers.Authorization,'Bearer '+token);assert.equal(init.redirect,'manual');
 if(failure)return new Response(JSON.stringify({secret:token,email:'private-upstream-error@example.invalid'}),{status:failure});
 if(url.endsWith('/associations/contacts/companies/batch/read')){
  if(associationFailure===true)return Response.json({status:'COMPLETE',errors:[{message:'private error'}],results:[]},{status:207});
  if(associationFailure==='pending')return Response.json({status:'PENDING',results:[]});
  const inputs=JSON.parse(init.body).inputs;
  return Response.json({status:'COMPLETE',errors:associationFailure==='partial'?[{message:'private error for missing row'}]:[],results:inputs.filter(input=>associationFailure!=='partial'||input.id==='12').map(input=>({from:{id:input.id},to:input.id==='12'?(input.after?[{toObjectId:31},{toObjectId:32}]:[{toObjectId:31}]):input.id==='13'?[{toObjectId:32}]:[],...(input.id==='12'&&!input.after?{paging:{next:{after:'next-company-page'}}}:{})}))});
 }
 if(/\/contacts\/\d+\/associations\/companies/.test(url)){
  if(individualFailure)return new Response('{}',{status:503});
  const id=url.match(/\/contacts\/(\d+)\//)[1],next=new URL(url).searchParams.has('after');
  return Response.json({results:id==='12'?(next?[{toObjectId:32}]:[{toObjectId:31}]):id==='13'?[{toObjectId:32}]:[],...(id==='12'&&!next?{paging:{next:{after:'next-single-page'}}}:{})});
 }
 if(companyFailure&&url.endsWith('/companies/batch/read'))return new Response('{}',{status:503});
 if(url.endsWith('/properties/companies')){
  if(schemaMode==='denied')return new Response('{}',{status:403});
  return Response.json({results:schemaMode==='missing'?[]:[{name:'exo_vendor_reference_v2',label:'Verdex Vendor No'},...(schemaMode==='duplicate'?[{name:'other_field',label:'Verdex Vendor No.'}]:[])]});
 }
 if(url.includes('/contacts/search'))return Response.json({results:[{id:'12',properties:{firstname:'Jane',lastname:'Smith',email:'jane@example.invalid',company:'Old text company',address:' 10 Contact Street ',city:'Melbourne',state:'Victoria',zip:'3000',private_property:'do not return'}},{id:'13',properties:{firstname:'John',email:'john@example.invalid'}},{id:'14',properties:{firstname:'Sam',company:'Text company only'}}],paging:{next:{after:20}}});
 if(url.includes('/contacts/12?'))return Response.json({id:'12',properties:{firstname:' Jane ',lastname:' Smith ',email:'jane@example.invalid',company:'Contact Company',address:' 10 Contact Street ',city:'Melbourne',state:' victoria ',zip:'3000',country:'Australia'},associations:{companies:{results:[{id:'31'},{id:'31'},{id:'32'}]}}});
 if(url.endsWith('/companies/batch/read'))return Response.json({results:[{id:'31',properties:{name:'Company One',exo_vendor_reference_v2:' 00123 ',address:'Never import this address'}},{id:'32',properties:{name:'Company Two',exo_vendor_reference_v2:'VER-2000'}}]});
 return Response.json({results:[]});
};
const route=load('app/api/admin/hubspot/route.ts');
const req=(body,id='approved-admin',origin='https://quote.invalid',raw=false)=>new Request('https://quote.invalid/api/admin/hubspot',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{}),...(id?{'oai-authenticated-user-id':id,'oai-authenticated-user-email':'admin@example.invalid'}:{})},body:raw?body:JSON.stringify(body)});
(async()=>{
 for(const action of ['status','connect','disconnect','search','contact','test']){
  assert.equal((await route.POST(req({action,token,query:'Jane',id:'12'},null))).status,401);
  assert.equal((await route.POST(req({action,token,query:'Jane',id:'12'},'unapproved-user'))).status,403);
  assert.equal((await route.POST(req({action,token,query:'Jane',id:'12'},'approved-admin','https://evil.invalid'))).status,403);
  assert.equal((await route.POST(req({action},'approved-admin',null))).status,403);
 }
 assert.equal(calls.length,0);
 assert.equal((await route.POST(req('x'.repeat(8193),'approved-admin','https://quote.invalid',true))).status,413);
 assert.equal((await route.POST(req('oops','approved-admin','https://quote.invalid',true))).status,400);
 assert.equal((await route.POST(req({action:'search',query:'J'}))).status,400);
 assert.equal((await route.POST(req({action:'contact',id:'../companies'}))).status,400);
 assert.equal((await route.POST(req({action:'search',query:'Jane'}))).status,409);
 assert.equal((await route.POST(req({action:'connect',token}))).status,200);
 assert.equal(calls.length,2);assert.equal(objects.size,1);assert.ok(![...objects.values()][0].includes(token));
 const encrypted=[...objects.values()][0];
 const status=await route.POST(req({action:'status'}));assert.match(status.headers.get('Cache-Control'),/private.*no-store/);assert.deepEqual(await status.json(),{configured:true,managedByHosting:false});
 const response=await route.POST(req({action:'search',query:'Jane',after:'20'})),result=await response.json();assert.equal(response.status,200);assert.equal(result.contacts[0].id,'12');assert.equal(result.after,'20');assert.equal(result.contacts[0].contact,'Jane Smith');assert.equal(result.contacts[0].email,'jane@example.invalid');assert.equal(result.contacts[0].company,'Old text company');assert.equal(result.contacts[0].address,'10 Contact Street');assert.equal(result.contacts[0].suburb,'Melbourne');assert.equal(result.contacts[0].state,'VIC');assert.equal(result.contacts[0].postcode,'3000');assert.doesNotMatch(JSON.stringify(result),/private_property|do not return|token/);
 assert.equal(JSON.parse(calls.find(call=>call.url.endsWith('/contacts/search')).init.body).after,'20');
 assert.deepEqual(result.contacts[0].companies.map(company=>company.id),['31','32']);assert.deepEqual(result.contacts[0].companies.map(company=>company.vendorNumber),['00123','VER-2000']);assert.deepEqual(result.contacts[1].companies.map(company=>company.id),['32']);assert.deepEqual(result.contacts[2].companies,[]);assert.deepEqual(result.warnings,[]);
 const associationCalls=calls.filter(call=>call.url.includes('/associations/'));assert.equal(associationCalls.length,2);assert.equal(JSON.parse(associationCalls[0].init.body).inputs.length,3);assert.deepEqual(JSON.parse(associationCalls[1].init.body).inputs,[{id:'12',after:'next-company-page'}]);assert.equal(JSON.parse(calls.at(-1).init.body).inputs.length,2);
 for(const mode of [true,'partial','pending']){
  associationFailure=mode;const recovered=await route.POST(req({action:'search',query:'Jane'}));assert.equal(recovered.status,200);const data=await recovered.json();assert.equal(data.contacts.length,3);assert.deepEqual(data.contacts[0].companies.map(c=>c.id),['31','32']);assert.deepEqual(data.contacts[1].companies.map(c=>c.id),['32']);assert.deepEqual(data.contacts[2].companies,[]);assert.equal(data.contacts[2].companiesIncomplete,false);assert.deepEqual(data.warnings,[]);assert.doesNotMatch(JSON.stringify(data),/private error/);
 }
 associationFailure='partial';individualFailure=true;
 const partial=await (await route.POST(req({action:'search',query:'Jane'}))).json();assert.equal(partial.contacts.length,3);assert.equal(partial.contacts[0].companies.length,2);assert.equal(partial.contacts[0].companiesIncomplete,false);assert.equal(partial.contacts[1].companiesIncomplete,true);assert.ok(partial.warnings.length>0);
 associationFailure=true;
 const manual=await (await route.POST(req({action:'contact',id:'12'}))).json();assert.equal(manual.contact.contact,'Jane Smith');assert.equal(manual.companies.length,0);assert.ok(manual.contact.warnings.length>0);
 associationFailure=false;individualFailure=false;companyFailure=true;
 const unavailable=await (await route.POST(req({action:'search',query:'Jane'}))).json();assert.equal(unavailable.contacts.length,3);assert.equal(unavailable.contacts[0].companies.length,2);assert.equal(unavailable.contacts[0].companies[0].vendorNumber,undefined);assert.ok(unavailable.warnings.length>0);companyFailure=false;

 const detail=await (await route.POST(req({action:'contact',id:'12'}))).json();assert.equal(detail.contact.address,'10 Contact Street');assert.equal(detail.contact.state,'VIC');assert.equal(detail.contact.postcode,'3000');assert.deepEqual(detail.contact.warnings,[]);assert.equal(detail.companies.length,2);assert.doesNotMatch(JSON.stringify(detail),/Never import/);assert.equal(JSON.parse(calls.at(-1).init.body).inputs.length,2);
 assert.deepEqual(JSON.parse(calls.at(-1).init.body).properties,['name','exo_vendor_reference_v2']);assert.equal(detail.companies[0].vendorNumber,'00123');assert.equal(detail.companies[1].vendorNumber,'VER-2000');
 for(const mode of ['missing','duplicate','denied']){schemaMode=mode;const response=await route.POST(req({action:'contact',id:'12'}));assert.equal(response.status,200);const data=await response.json();assert.ok(data.contact.warnings.length>0);assert.equal(data.companies[0].vendorNumber,undefined);assert.deepEqual(JSON.parse(calls.at(-1).init.body).properties,['name']);}schemaMode='normal';
 failure=401;const rejected=await route.POST(req({action:'connect',token}));assert.equal(rejected.status,409);assert.doesNotMatch(await rejected.text(),/test-only-token|private-upstream/);assert.equal([...objects.values()][0],encrypted);
 failure=302;const redirected=await route.POST(req({action:'connect',token}));assert.equal(redirected.status,503);assert.match(await redirected.text(),/unexpected redirect/);assert.equal([...objects.values()][0],encrypted);
 failure=429;assert.equal((await route.POST(req({action:'search',query:'Jane'}))).status,429);failure=0;
 const {matchHubSpotState}=load('lib/hubspot-contact.ts');
 for(const [input,expected] of [['New South Wales','NSW'],['Victoria','VIC'],['Queensland','QLD'],['South Australia','SA'],['Western Australia','WA'],['Tasmania','TAS'],['Northern Territory','NT'],['Australian Capital Territory','ACT'],['Sydney New South Wales','NSW'],[' sydney,  new\u00a0south  wales ','NSW'],['Melbourne - Victoria','VIC'],['Sydney NSW','NSW'],['NSW - New South Wales','NSW'],['NSW / Victoria',''],['Victorian',''],['Sydney',''],['','']])assert.equal(matchHubSpotState(input),expected,input);
 const mappedState=load('lib/hubspot-contact.ts').mapHubSpotContact({id:'12',properties:{firstname:'Jane',email:'jane@example.invalid',address:'10 Contact Street',city:'Sydney',state:'Sydney New South Wales',zip:'2000'}});assert.equal(mappedState.state,'NSW');assert.equal(mappedState.suburb,'Sydney');assert.equal(mappedState.warnings.length,0);
 const {mapHubSpotContact}=load('lib/hubspot-contact.ts');const missing=mapHubSpotContact({id:'99',properties:{state:'California',zip:'90210',country:'USA'}});assert.equal(missing.state,'');assert.equal(missing.postcode,'');assert.ok(missing.warnings.length>=5);
 const {newQuote}=load('lib/quote.ts'),{applyQuoteAction}=load('lib/quote-actions.ts'),{sharedDemoQuote}=load('lib/shared-demo.ts');
 const q=newQuote(true);q.status='Draft';q.hubspotContactId='12';q.hubspotCompanyId='31';q.contact='Private CRM Name';q.email='private-crm@example.invalid';q.address='10 Private CRM Street';
 const {hubSpotQuotePatch}=load('lib/hubspot-contact.ts');
 q.vendorNumber='MANUAL';q.customerTerms='30 DAYS EOM';q.reference='Customer PO';
 const sameCompany=hubSpotQuotePatch(detail.contact,detail.companies[0],q);assert.equal(sameCompany.vendorNumber,'00123');assert.equal(sameCompany.customerTerms,undefined);
 const otherCompany=hubSpotQuotePatch(detail.contact,detail.companies[1],q);assert.equal(otherCompany.vendorNumber,'VER-2000');assert.equal(otherCompany.hubspotCompanyId,'32');assert.equal(otherCompany.customerTerms,'');
 assert.equal(hubSpotQuotePatch(detail.contact,{id:'31',name:'Same company',vendorNumber:''},q).vendorNumber,'');
 assert.equal(hubSpotQuotePatch(detail.contact,{id:'31',name:'Same company'},q).vendorNumber,'MANUAL');
 assert.equal(hubSpotQuotePatch(detail.contact,undefined,q).vendorNumber,'');
 Object.assign(q,sameCompany);q.contact='Private CRM Name';q.email='private-crm@example.invalid';q.address='10 Private CRM Street';
 const saved=applyQuoteAction(q,{action:'save',version:q.version,quote:q});assert.equal(saved.hubspotContactId,'12');assert.equal(saved.hubspotCompanyId,'31');assert.equal(saved.vendorNumber,'00123');
 const demo=sharedDemoQuote(saved);assert.doesNotMatch(JSON.stringify(demo),/hubspotContactId|hubspotCompanyId|Private CRM|private-crm/);assert.equal(demo.contact,'Alex Smith');assert.equal(demo.vendorNumber,'');
 assert.equal((await route.POST(req({action:'disconnect'}))).status,200);assert.equal(objects.size,0);assert.equal((await route.POST(req({action:'search',query:'Jane'}))).status,409);
 const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
 const {hubspotRequest,HubSpotError}=load('lib/hubspot.ts');
 // Exercise the actual request function with Workers' native Request validation.
 // A Node-only fetch mock accepts redirect values that workerd rejects.
 const mf=new Miniflare({modules:true,script:`${HubSpotError.toString()}
const hubspotRequest=${hubspotRequest.toString()};
globalThis.fetch=async(input,init)=>{const request=new Request(input,init);return Response.json({reached:true,redirect:request.redirect});};
export default {async fetch(){return Response.json(await hubspotRequest('/crm/v3/objects/contacts?limit=1',undefined,'test-runtime-token'));}}`});
 try{const response=await mf.dispatchFetch('http://localhost/');assert.equal(response.status,200);assert.deepEqual(await response.json(),{reached:true,redirect:'manual'});}finally{await mf.dispose();}
 console.log('PASS: Workers request compatibility, refused redirects, strict admin and origin checks, bounded requests, encrypted credentials, validated scopes, token-safe errors, contact-first address mapping, company choices, pagination, CRM ID persistence, public-demo redaction and disconnect.');
})().catch(error=>{console.error(error);process.exitCode=1;});
