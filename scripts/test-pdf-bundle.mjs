// Exercise the ESM dependency entrypoints used by the deployed Worker/browser.
// CommonJS-only tests do not catch fontkit's default-export interop regression.
import {build} from 'vite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const out=await mkdtemp(join(tmpdir(),'verdex-pdf-bundle-'));
try{
 await build({configFile:false,logLevel:'error',build:{outDir:out,emptyOutDir:true,minify:true,lib:{entry:{pdf:'lib/pdf.ts',quote:'lib/quote.ts'},formats:['es'],fileName:(_,name)=>name+'.mjs'}}});
 const {quotePdf}=await import(pathToFileURL(join(out,'pdf.mjs')).href);
 const {newQuote}=await import(pathToFileURL(join(out,'quote.mjs')).href);
 const bytes=await quotePdf(newQuote(true),'https://example.invalid/quote');
 assert.equal(Buffer.from(bytes).toString('ascii',0,5),'%PDF-');
 const {PDFDocument}=await import('pdf-lib');
 const doc=await PDFDocument.load(bytes);
 assert.ok(doc.getPageCount()>0);
 console.log('PASS: production-style ESM bundle loads embedded fonts and generates a valid quote PDF.');
}finally{await rm(out,{recursive:true,force:true});}
