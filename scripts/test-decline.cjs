const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(p){p=path.resolve(root,p);if(cache.has(p))return cache.get(p);const e={};cache.set(p,e);new Function('require','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(p),n+'.ts')):require(n),e);return e;}
const {newQuote}=load('lib/quote.ts'),{applyQuoteAction}=load('lib/quote-actions.ts'),{declineReasons}=load('lib/decline-reasons.ts');
const q=newQuote(true), original=structuredClone(q);
const decline=reason=>applyQuoteAction(q,{action:'decline',version:q.version,reason});
for(const reason of [undefined,null,'','   ','Other',[],[declineReasons[0],declineReasons[1]]])assert.throws(()=>decline(reason),/Select one reason/);
for(const reason of declineReasons){const result=decline(reason);assert.equal(result.status,'Declined');assert.equal(result.events.at(-1).text,'Customer declined: '+reason);assert.equal(result.version,q.version+1);}
assert.deepEqual(q,original);
assert.throws(()=>applyQuoteAction({...q,status:'Accepted'},{action:'decline',version:q.version,reason:declineReasons[0]}),/Only a ready quote/);
console.log('PASS: all seven decline reasons saved; missing, arbitrary and multiple reasons rejected; original quote unchanged and status guard retained.');
