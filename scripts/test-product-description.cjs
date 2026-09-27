const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,resolve=require){const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(name=>name==='server-only'?{}:resolve(name),out);return out;}
const {sanitiseProductDescription:clean}=load('lib/product-description.ts');
const {parseFeed}=load('lib/product-feed.ts');
const rich='<p><strong>Features</strong><br>Safe &amp; practical</p><ul><li>First feature</li><li><em>Second feature</em><ol><li>Nested step</li></ol></li></ul>';
const feed=parseFeed('<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>TEST</g:id><title>Test product</title><g:price>25.00 AUD</g:price><link>https://www.verdex.com.au/test</link><description><![CDATA['+rich+']]></description></item></channel></rss>');
const safe=clean(feed.products[0].description);
for(const tag of ['<p>','<strong>','<ul>','<ol>','<li>','<em>'])assert(safe.includes(tag));
assert.match(safe,/<br\s*\/>/);assert.match(safe,/Safe &amp; practical/);
const malicious='<p onclick="bad()" style="position:fixed">Keep</p><script>alert(1)</script><style>body{display:none}</style><img src=x onerror=bad()><iframe src="https://evil.invalid">bad</iframe><svg onload=bad()><circle/></svg><math><mtext>bad</mtext></math><a href="javascript:bad()">Link text</a>';
assert.equal(clean(malicious),'<p>Keep</p>Link text');
assert.equal(clean('&lt;script&gt;alert(1)&lt;/script&gt;'),'&lt;script&gt;alert(1)&lt;/script&gt;');
assert.equal(clean('<ul><li>One<li>Two</ul>'),'<ul><li>One</li><li>Two</li></ul>');
const route=load('app/product-details/route.ts',name=>name.includes('product-description')?{sanitiseProductDescription:clean}:name.includes('catalogue-data')?{getCatalogue:async()=>feed}:{catalogue:[]});
(async()=>{const r=await route.GET(new Request('https://test.invalid/product-details?sku=TEST'));const html=await r.text();assert.equal(r.status,200);assert(html.includes('<div class="description">'+safe+'</div>'));assert(html.includes('View product on website'));assert(!html.includes('Product information from the Verdex Magento feed.'));assert(!html.includes('<p class="description">'));assert(r.headers.get('content-security-policy').includes("default-src 'none'"));assert(!fs.readFileSync('app/quote-app.tsx','utf8').includes('Product information from Verdex.'));console.log('PASS: XML CDATA → sanitised lists/paragraphs/emphasis → popup HTML; hostile attributes/scripts/embeds removed; entities remain safe; requested copy replaced.');})().catch(e=>{console.error(e);process.exitCode=1;});
