const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),loaded=new Map(),records=new Map(),objects=new Map();let reads=0,failInsert=false,feedAverage=60;
const quote={status:'Draft',items:[]};
const config={COST_ADMIN_USER_IDS:'test-admin',DB:{prepare(sql){return {bind(...args){return {async first(){reads++;if(sql.includes('FROM quotes'))return args[0]==='quote-1'&&args[1]==='test-admin'?{data:JSON.stringify(quote)}:null;return records.get(args[0])?.owner===args[1]?records.get(args[0]):null;},async run(){if(sql.startsWith('INSERT INTO adhoc_products')){if(failInsert)throw Error('Storage unavailable');const keys=['id','owner','quote_id','sku','name','cost','price','qty','image_key','image_type','created','images_json','family_id','source_sku','cost_from_feed'];records.set(args[0],Object.fromEntries(keys.map((k,i)=>[k,args[i]])));}return {meta:{changes:1}};}}}}}},BUCKET:{async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}}};
function load(file){file=path.resolve(root,file);if(loaded.has(file))return loaded.get(file);const exports={};loaded.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>{if(name==='server-only')return {};if(name==='cloudflare:workers')return {env:config};if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);const target=path.resolve(name.startsWith('@/')?path.join(root,name.slice(2)+'.ts'):path.join(path.dirname(file),name+'.ts'));if(target.endsWith('/catalogue-data.ts'))return {getCatalogue:async()=>({products:[{sku:'FEED',name:'Feed product',regularPrice:10000,price:10000,qty:1,image:'https://www.verdex.com.au/media/catalog/feed.jpg',url:'https://www.verdex.com.au/feed-product'}]})};if(target.endsWith('/cost-data.ts'))return {getCosts:async()=>new Map([['FEED',{averageCost:feedAverage}]])};return load(target);},exports);return exports;}
const auth={'oai-authenticated-user-id':'test-admin','oai-authenticated-user-email':'test@example.invalid',origin:'https://test.invalid'};
function form(values={}){const f=new FormData();for(const [key,value] of Object.entries({id:crypto.randomUUID(),quoteId:'quote-1',sku:' CUSTOM ',name:'Custom product',cost:'60',price:'100',qty:'2',...values}))f.set(key,value);return f;}
function request(form,headers=auth){return new Request('https://test.invalid/admin/adhoc',{method:'POST',headers,body:form});}
(async()=>{
const create=load('app/admin/adhoc/route.ts'),metadata=load('app/api/admin/adhoc/route.ts'),images=load('app/api/product-images/[id]/route.ts'),lib=load('lib/adhoc-products.ts');
assert.equal((await create.POST(request(form(),{}))).status,401);assert.equal(reads,0);
assert.equal((await create.POST(request(form(),{...auth,'oai-authenticated-user-id':'other'}))).status,403);assert.equal(reads,0);
assert.equal((await create.POST(request(form(),{...auth,origin:'https://evil.invalid'}))).status,403);assert.equal(reads,0);
for(const values of [{sku:' feed '},{cost:''},{price:'0'},{cost:'-1'},{qty:'0'},{quoteId:'not-mine'},{image:new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})}])assert.equal((await create.POST(request(form(values)))).status,400);
const id=crypto.randomUUID(),png=new Uint8Array([137,80,78,71,13,10,26,10]);
assert.equal((await create.POST(request(form({id,image:new File([png],'image.png',{type:'image/png'})})))).status,200);
assert.equal(records.get(id).cost,6000);assert.equal(records.get(id).sku,'CUSTOM');assert.equal(objects.size,1);
assert.equal((await create.POST(request(form({id})))).status,200);assert.equal(records.size,1);
const response=await metadata.GET(new Request('https://test.invalid/api/admin/adhoc?id='+id,{headers:auth}));const {item}=await response.json();assert.equal(item.adhocId,id);assert.equal(item.price,10000);assert.equal(item.image,'/api/product-images/'+id);assert.equal(item.cost,undefined);assert.equal(item.owner,undefined);assert.match(response.headers.get('cache-control'),/no-store/);
assert.equal((await metadata.GET(new Request('https://test.invalid/api/admin/adhoc?id='+id))).status,401);
assert.equal(await lib.getAdhoc(id,'other-owner'),null);await assert.rejects(()=>lib.verifyAdhocItems([item],[],'other-quote','test-admin'));await assert.rejects(()=>lib.verifyAdhocItems([{...item,sku:'changed'}],[],'quote-1','test-admin'));
const verified=await lib.verifyAdhocItems([{...item,name:'tampered',standardPrice:1}],[],'quote-1','test-admin');assert.equal(verified[0].name,'Custom product');assert.equal(verified[0].standardPrice,10000);
const {withStandardPrices}=load('lib/standard-prices.ts');assert.equal((await withStandardPrices({items:verified},{items:[]})).items[0].standardPrice,10000);
const {parseMarginItems}=load('lib/gross-profit.ts'),{reviewMargins}=load('lib/margin-review.ts');assert.equal(parseMarginItems([item])[0].adhocId,id);
const req=new Request('https://test.invalid',{headers:auth});assert.equal((await reviewMargins([item],req)).overall.pct,40);assert.equal((await reviewMargins([{...item,price:9000}],req)).lines[0].low,true);
assert.equal((await reviewMargins([item],new Request('https://test.invalid',{headers:{...auth,'oai-authenticated-user-id':'other'}}))).overall.pct,null);
const costFrame=await load('app/admin/unit-cost/route.ts').GET(new Request('https://test.invalid/admin/unit-cost?sku=CUSTOM&adhocId='+id,{headers:auth}));assert.match(await costFrame.text(),/\$60\.00/);assert.match(costFrame.headers.get('content-security-policy'),/sandbox/);
assert.equal((await images.GET(new Request('https://test.invalid',{headers:auth}),{params:{id}})).status,200);assert.equal((await images.GET(new Request('https://test.invalid',{headers:{...auth,'oai-authenticated-user-id':'other'}}),{params:{id}})).status,404);
const zero=crypto.randomUUID();assert.equal((await create.POST(request(form({id:zero,cost:'0'})))).status,200);assert.equal((await reviewMargins([lib.publicAdhoc(records.get(zero))],req)).overall.pct,100);
const {newQuote}=load('lib/quote.ts'),{applyQuoteAction}=load('lib/quote-actions.ts');const q=newQuote(true);q.status='Draft';const saved=applyQuoteAction(q,{action:'save',version:q.version,quote:{...q,items:[item]}});assert.equal(saved.items[0].adhocId,id);assert.doesNotMatch(JSON.stringify(saved),/"cost"|"image_key"/);
// Multiple images and copy-on-edit preserve old records and quote snapshots.
quote.items=[item];
const editId=crypto.randomUUID(),editForm=form({id:editId,editId:id,name:'Updated custom product',cost:'75',keepImage:'0'});
editForm.append('images',new File([png],'second.png',{type:'image/png'}));editForm.append('images',new File([png],'third.png',{type:'image/png'}));
assert.equal((await create.POST(request(editForm))).status,200);
const changed=lib.publicAdhoc(records.get(editId));assert.equal(changed.name,'Updated custom product');assert.equal(changed.images.length,3);assert.equal(records.get(editId).cost,7500);assert.equal(records.get(editId).family_id,id);
assert.equal(records.get(id).cost,6000);assert.equal(lib.publicAdhoc(records.get(id)).images.length,1);assert.equal(records.get(id).name,'Custom product');
const replacement=await lib.verifyAdhocItems([{...changed,price:9000,qty:7,note:'Keep my note'}],[item],'quote-1','test-admin');assert.equal(replacement[0].price,9000);assert.equal(replacement[0].qty,7);assert.equal(replacement[0].note,'Keep my note');assert.equal(replacement[0].images.length,3);
assert.equal((await reviewMargins([changed],req)).overall.pct,25);
for(const index of [0,1,2])assert.equal((await images.GET(new Request('https://test.invalid?index='+index,{headers:auth}),{params:{id:editId}})).status,200);
assert.equal((await images.GET(new Request('https://test.invalid?index=3',{headers:auth}),{params:{id:editId}})).status,404);
assert.equal((await images.GET(new Request('https://test.invalid?index=-1',{headers:auth}),{params:{id:editId}})).status,404);
const again=crypto.randomUUID(),againForm=form({id:again,editId,name:'Name only',cost:'',keepImage:'1'});
assert.equal((await create.POST(request(againForm))).status,200);assert.equal(records.get(again).cost,7500);assert.equal(lib.adhocImages(records.get(again)).length,1);assert.equal(lib.adhocImages(records.get(again))[0].key,lib.adhocImages(records.get(editId))[1].key);
await lib.verifyAdhocItems([lib.publicAdhoc(records.get(again))],[item],'quote-1','test-admin');
const zeroEdit=crypto.randomUUID();assert.equal((await create.POST(request(form({id:zeroEdit,editId:again,cost:'0'})))).status,200);assert.equal(records.get(zeroEdit).cost,0);assert.deepEqual(lib.publicAdhoc(records.get(zeroEdit)).images,[]);
const excessive=form({editId});for(let n=0;n<9;n++)excessive.append('images',new File([png],'image.png'));assert.equal((await create.POST(request(excessive))).status,400);
const invalid=form({editId,keepImage:'99'});assert.equal((await create.POST(request(invalid))).status,400);
const failedId=crypto.randomUUID();assert.equal((await create.POST(request(form({id:failedId,editId,name:''})))).status,400);assert.equal(records.has(failedId),false);
assert.equal((await metadata.GET(new Request('https://test.invalid/api/admin/adhoc?id='+failedId,{headers:auth}))).status,404);
const wrong=crypto.randomUUID();records.set(wrong,{...records.get(id),id:wrong,quote_id:'another-quote'});assert.equal((await create.POST(request(form({editId:wrong})))).status,400);
quote.status='Ready';assert.equal((await create.POST(request(form({editId})))).status,400);quote.status='Draft';
const editedSave=applyQuoteAction(q,{action:'save',version:q.version,quote:{...q,items:replacement}});assert.equal(editedSave.items[0].images.length,3);assert.doesNotMatch(JSON.stringify(editedSave),/"cost"|"image_key"|"family_id"/);
const unrelated=crypto.randomUUID();records.set(unrelated,{...records.get(id),id:unrelated,family_id:unrelated});await assert.rejects(()=>lib.verifyAdhocItems([lib.publicAdhoc(records.get(unrelated))],[item],'quote-1','test-admin'));
const beforeObjects=objects.size,rollbackId=crypto.randomUUID(),rollbackForm=form({id:rollbackId,editId,keepImage:'0'});rollbackForm.append('images',new File([png],'new.png'));failInsert=true;assert.equal((await create.POST(request(rollbackForm))).status,400);failInsert=false;assert.equal(objects.size,beforeObjects);assert.equal(records.has(rollbackId),false);assert.equal(objects.has(lib.adhocImages(records.get(id))[0].key),true);
const legacy={...records.get(id),images_json:null,family_id:null};assert.equal(lib.adhocImages(legacy).length,1);
// Feed SKU edits keep the feed image, stock/price identity, and live cost unless overridden.
const feedItem={sku:'FEED',name:'Feed product',price:9500,standardPrice:10000,qty:3,baseQty:3,optional:false,selected:true,note:'Keep assembled',image:'https://www.verdex.com.au/media/catalog/feed.jpg',url:'https://www.verdex.com.au/feed-product'};
quote.items=[feedItem];
const feedId=crypto.randomUUID(),feedEdit=form({id:feedId,editSku:' feed ',sku:'FEED',name:'Feed product assembled',cost:'',keepImage:'0'});feedEdit.append('images',new File([png],'extra.png'));
const feedResponse=await create.POST(request(feedEdit));assert.equal(feedResponse.status,200,await feedResponse.text());
const feedRow=records.get(feedId),feedPublic=lib.publicAdhoc(feedRow);assert.equal(feedRow.source_sku,'FEED');assert.equal(feedRow.cost_from_feed,1);assert.equal(feedPublic.sourceSku,'FEED');assert.equal(feedPublic.images.length,2);assert.equal(feedPublic.cost,undefined);assert.equal(feedPublic.cost_from_feed,undefined);
const feedVerified=(await lib.verifyAdhocItems([{...feedItem,...feedPublic,qty:3,price:9500,note:'Keep assembled'}],[feedItem],'quote-1','test-admin'))[0];assert.equal(feedVerified.url,feedItem.url);assert.equal(feedVerified.standardPrice,10000);assert.equal(feedVerified.price,9500);assert.equal(feedVerified.qty,3);assert.equal(feedVerified.note,'Keep assembled');assert.equal(feedVerified.sourceSku,'FEED');
assert.equal((await reviewMargins([{...feedPublic,price:10000}],req)).overall.pct,40);
const feedCost=await load('app/admin/unit-cost/route.ts').GET(new Request('https://test.invalid/admin/unit-cost?sku=FEED&adhocId='+feedId,{headers:auth}));assert.match(await feedCost.text(),/\$60\.00/);feedAverage=null;assert.equal((await reviewMargins([feedPublic],req)).overall.pct,null);const missingFeedCost=await load('app/admin/unit-cost/route.ts').GET(new Request('https://test.invalid/admin/unit-cost?sku=FEED&adhocId='+feedId,{headers:auth}));assert.match(await missingFeedCost.text(),/N\/A/);feedAverage=60;
const sourceImage=await images.GET(new Request('https://test.invalid',{headers:auth}),{params:{id:feedId}});assert.equal(sourceImage.status,302);assert.equal(sourceImage.headers.get('location'),feedItem.image);
assert.equal((await images.GET(new Request('https://test.invalid?index=1',{headers:auth}),{params:{id:feedId}})).status,200);
const feedOverride=crypto.randomUUID();assert.equal((await create.POST(request(form({id:feedOverride,editId:feedId,name:'Renamed feed product',cost:'75',keepImage:'1'})))).status,200);assert.equal(records.get(feedOverride).cost_from_feed,0);assert.equal(records.get(feedOverride).source_sku,'FEED');assert.equal(records.get(feedOverride).family_id,feedId);assert.equal((await reviewMargins([lib.publicAdhoc(records.get(feedOverride))],req)).overall.pct,25);
assert.equal(records.get(feedId).cost_from_feed,1);assert.equal(lib.adhocImages(records.get(feedId)).length,2);
const feedZero=crypto.randomUUID();assert.equal((await create.POST(request(form({id:feedZero,editId:feedOverride,cost:'0'})))).status,200);assert.equal((await reviewMargins([lib.publicAdhoc(records.get(feedZero))],req)).overall.pct,100);
// The same SKU can have different per-line custom costs without cross-contamination.
const pair=[{...lib.publicAdhoc(records.get(feedOverride)),lineId:crypto.randomUUID(),price:10000,qty:1},{...feedItem,lineId:crypto.randomUUID(),price:10000,qty:1}];
const pairGp=await reviewMargins(parseMarginItems(pair),req);assert.deepEqual(pairGp.lines.map(i=>i.pct),[25,40]);assert.equal(pairGp.overall.pct,32.5);
const verifiedPair=await lib.verifyAdhocItems(pair,[], 'quote-1','test-admin');assert.equal(verifiedPair[0].adhocId,feedOverride);assert.equal(verifiedPair[1].adhocId,undefined);
const badFeed=form({editSku:'DOES-NOT-EXIST',cost:''});assert.equal((await create.POST(request(badFeed))).status,400);
quote.items=[feedVerified];assert.equal((await create.POST(request(form({editSku:'FEED',cost:''})))).status,400);
assert.equal(lib.safeFeedImage('javascript:alert(1)'),undefined);assert.equal(lib.safeFeedImage('https://evil.invalid/media/file.png'),undefined);
console.log('PASS: feed edits, retained feed images, uploaded images, inherited/overridden/zero cost, sale/stock identity, trusted metadata, revision preservation; multi-image creation/editing, blank/zero cost, immutable prior versions, image removal, save preservation, upload limits, ownership, draft-only edits, failure confirmation, cost privacy and GP.');
})().catch(e=>{console.error(e);process.exitCode=1;});
