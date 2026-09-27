const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const modules = new Map();
const config = {COST_ADMIN_USER_IDS:'test-admin'};
let catalogueCalls = 0, costCalls = 0;
const fakeCosts = new Map([['V123', {averageCost:12.34, latestCost:98765.43}], ['ZERO', {averageCost:0, latestCost:9}]]);
function load(file) {
  file = path.resolve(root, file);
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText;
  const localRequire = name => {
    if (name === 'server-only') return {};
    if (name === 'cloudflare:workers') return {env:config};
    if (name === '@/lib/cost-data') return {getCosts:async()=>{costCalls++; return fakeCosts;}};
    if (name === '@/lib/catalogue-data') return {getCatalogue:async()=>{catalogueCalls++; return {products:[{sku:' v123 '},{sku:'ZERO'},{sku:'MISSING'}]};}};
    return load(name.startsWith('@/') ? name.slice(2)+'.ts' : path.resolve(path.dirname(file), name+'.ts'));
  };
  new Function('require', 'exports', js)(localRequire, exports);
  return exports;
}
(async () => {
  const {parseCsv,costRecords,createCostCache,createCostSource,limitedText} = load('lib/cost-source.ts');
  const parsed = costRecords(parseCsv('\uFEFF"SKU","Average Cost","Latest Cost"\r\n" v123 ","$1,234.5678","22.30"\r\nZERO,0,0\r\nBLANK,,\r\nBAD,abc,N/A\r\nDup,1,2\r\ndUP,3,4\r\n'));
  assert.deepEqual(parsed.get('V123'), {averageCost:1234.5678, latestCost:22.3});
  assert.equal(parsed.get('ZERO').averageCost, 0);
  assert.equal(parsed.get('BLANK').averageCost, null);
  assert.equal(parsed.get('BAD').latestCost, null);
  assert.equal(parsed.get('DUP').averageCost, null);
  assert.equal(parsed.get('DUP').duplicate, true);
  assert.equal(parsed.has('UNKNOWN'), false);
  assert.deepEqual(parseCsv('"a\nb","x""y"\n'), [['a\nb','x"y']]);
  assert.throws(()=>parseCsv('"unterminated'));
  assert.throws(()=>costRecords([['unexpected','headings']]));
  assert.throws(()=>createCostSource({COST_SOURCE_MODE:'oauth',COST_SHEET_ID:'some_id'}));
  await assert.rejects(limitedText(new Response('x'.repeat(5_000_001))));
  let time = 0, loads = 0, broken = false;
  const cached = createCostCache({load:async()=>{loads++; if(broken) throw Error('private source details'); return parsed;}}, ()=>time);
  await cached(); await Promise.all([cached(),cached(),cached()]); assert.equal(loads,1);
  time = 899_999; await cached(); assert.equal(loads,1);
  time = 900_000; await cached(); assert.equal(loads,2);
  time = 1_800_000; broken = true; await assert.rejects(cached(), /Cost source unavailable/);
  // A retry must recover immediately, without retaining a failed operation.
  broken = false; await cached(); assert.equal(loads,4);

  // Simulate an interrupted Worker fetch whose promise never settles. A new
  // request must load independently, then supply completed data to later calls.
  let attempts=0;
  const interrupted=createCostCache({load:()=>++attempts===1?new Promise(()=>{}):Promise.resolve(parsed)});
  void interrupted();
  const recovered=await Promise.race([interrupted(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Retry was stranded by an earlier request')),100))]);
  assert.equal(recovered,parsed); await interrupted(); assert.equal(attempts,2);

  // An older failing request must not erase a newer successful refresh.
  let failOld;
  attempts=0;
  const concurrent=createCostCache({load:()=>++attempts===1?new Promise((_,reject)=>{failOld=reject;}):Promise.resolve(parsed)});
  const older=concurrent(); await concurrent(); failOld(Error('interrupted'));
  assert.equal(await older,parsed); await concurrent(); assert.equal(attempts,2);

  const {adminAccess} = load('lib/admin-access.ts');
  const request = (id, sku='v123') => new Request('https://test.invalid/admin/unit-cost?sku='+encodeURIComponent(sku), {headers:id?{'oai-authenticated-user-id':id,'oai-authenticated-user-email':'test@example.invalid'}:{}});
  assert.equal(adminAccess(request('test-admin'),{}),403);
  assert.equal(adminAccess(request('test-admin'),config),200);
  assert.equal(adminAccess(request('local-preview'),config),403);
  const {GET} = load('app/admin/unit-cost/route.ts');
  for(const id of [undefined,'other-user']) {
    const response=await GET(request(id)); assert.equal(response.status,id?403:401);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.doesNotMatch(await response.text(),/12\.34|98765\.43/);
  }
  assert.equal(costCalls,0); assert.equal(catalogueCalls,0);
  const ok=await GET(request('test-admin',' V123 ')); const html=await ok.text();
  assert.equal(ok.status,200); assert.match(html,/\$12\.34/); assert.doesNotMatch(html,/98765\.43|<script|google|sheet/i);
  assert.match(ok.headers.get('content-security-policy'),/sandbox/);
  assert.doesNotMatch(ok.headers.get('content-security-policy'),/allow-same-origin|allow-scripts/);
  assert.match(await (await GET(request('test-admin','zero'))).text(),/\$0\.00/);
  assert.match(await (await GET(request('test-admin','MISSING'))).text(),/N\/A/);
  const prior=costCalls; assert.match(await (await GET(request('test-admin','EXO-ONLY'))).text(),/N\/A/); assert.equal(costCalls,prior);
  config.COST_ADMIN_USER_IDS=''; assert.equal((await GET(request('test-admin'))).status,403);
  console.log('PASS: parsing and SKU matching; Average + Latest import; zero/missing/duplicates; cache expiry and interrupted-request recovery; anonymous/non-admin/revoked access denied before fetch; authorised script-free cost cells; no Latest Cost disclosure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
