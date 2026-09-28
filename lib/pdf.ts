import {netUnitPrice,lineSubtotal,hasDiscount,discountLabel} from './line-pricing';
import {PDFDocument,rgb,type PDFPage,type PDFFont,type PDFImage,PDFName,PDFString} from 'pdf-lib';
import {quoteRows,reanchorBlocks,noteText} from './quote-layout';
import {fulfilmentCharges} from './fulfilment';
import {deliveryAddress} from './delivery-address';
import {lineKey,type Quote,type Item,totals,money,dateLabel} from './quote';
import fontkit from '@pdf-lib/fontkit';
import {pdfRegular,pdfBold,pdfItalic} from './pdf-fonts';
import {pdfLogo} from './pdf-logo';
import {pdfImageType,type PdfImages} from './pdf-images';

const W=595,H=842,L=26,R=569,BODY_BOTTOM=787;
const BLUE=rgb(18/255,116/255,186/255),INK=rgb(.12,.16,.19),GRAY=rgb(.36,.41,.45),LINE=rgb(.81,.85,.88),PALE=rgb(.94,.95,.96),WHITE=rgb(1,1,1);
const clean=(s:string)=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[–—‑]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x20-\x7e\n]/g,'?');
const safeLink=(raw?:string)=>{try{const u=new URL(raw||'');return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const numericDate=(s:string)=>/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10).split('-').reverse().join('.'):clean(s);
const branches=[
 ['Sydney','(02) 8865 1800','23 Hawthorne Ave, Marsden Park NSW 2765'],
 ['Melbourne','(03) 9115 9100','43 Zenith Road, Dandenong South VIC 3175'],
 ['Brisbane','(07) 3558 9700','42 Mineral Sizer Court, Narangba QLD 4504'],
 ['Adelaide','(08) 8166 5151','9 Woodlands Terrace, Edwardstown South Australia 5039'],
 ['Perth','(08) 9488 8181','276 Ayres Road, Forrestdale Western Australia 6112'],
];

export async function quotePdf(q:Quote,url:string,images:PdfImages=new Map()):Promise<Uint8Array>{
 const doc=await PDFDocument.create();doc.setTitle('Quotation '+q.number);doc.setAuthor('Verdex Equipment Pty Ltd');doc.setSubject('Verdex quotation');
 doc.registerFontkit(fontkit);
 const font=await doc.embedFont(pdfRegular,{subset:true}),bold=await doc.embedFont(pdfBold,{subset:true}),italic=await doc.embedFont(pdfItalic,{subset:true});
 const logo=await doc.embedJpg(pdfLogo),pictures=new Map<string,PDFImage>();
 for(const [id,bytes] of images){try{const type=pdfImageType(bytes);if(type)pictures.set(id,type==='png'?await doc.embedPng(bytes):await doc.embedJpg(bytes));}catch{/* Use a labelled fallback if an image is unavailable. */}}
 let page:PDFPage,y=0,tableActive=false;const online=safeLink(url),shipping=fulfilmentCharges(q);
 function text(s:string,x:number,top:number,size=9,f:PDFFont=font,color=INK){page.drawText(clean(s),{x,y:H-top-size,size,font:f,color});}
 function right(s:string,end:number,top:number,size=9,f:PDFFont=font,color=INK){text(s,end-f.widthOfTextAtSize(clean(s),size),top,size,f,color);}
 function rect(x:number,top:number,width:number,height:number,fill=WHITE,border?:ReturnType<typeof rgb>){page.drawRectangle({x,y:H-top-height,width,height,color:fill,...(border?{borderColor:border,borderWidth:.6}:{})});}
 function rule(top:number,x=L,end=R,color=LINE,thickness=.6){page.drawLine({start:{x,y:H-top},end:{x:end,y:H-top},color,thickness});}
 function wrap(raw:string,width:number,size=9,f:PDFFont=font):string[]{
  const lines:string[]=[];
  for(const para of clean(raw).split('\n')){let line='';for(const word of para.split(/\s+/).filter(Boolean)){
   if(line&&f.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line='';}
   if(f.widthOfTextAtSize(word,size)>width){let part='';for(const char of word){if(part&&f.widthOfTextAtSize(part+char,size)>width){lines.push(part);part='';}part+=char;}line=part;}else line+=(line?' ':'')+word;
  }lines.push(line);}
  return lines;
 }
 function paragraph(s:string,x:number,top:number,width:number,size=9,f:PDFFont=font,color=INK,leading=size+3){const lines=wrap(s,width,size,f);for(const line of lines){text(line,x,top,size,f,color);top+=leading;}return top;}
 function link(target:string,x:number,top:number,width:number,height:number){const ann=doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,H-top-height,x+width,H-top],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(target)}});const ref=doc.context.register(ann);const previous=page.node.Annots();if(previous)previous.push(ref);else page.node.set(PDFName.of('Annots'),doc.context.obj([ref]));}
 function image(img:PDFImage,x:number,top:number,width:number,height:number){const scale=Math.min(width/img.width,height/img.height),w=img.width*scale,h=img.height*scale;page.drawImage(img,{x:x+(width-w)/2,y:H-top-h-(height-h)/2,width:w,height:h});}
 function button(top:number,x=344,width=225){if(!online)return;rect(x,top,width,27,BLUE);const label='Approve Quote and Checkout';text(label,x+12,top+7,11,bold,WHITE);text('>',x+width-15,top+5,14,bold,WHITE);link(online,x,top,width,27);}
 function newPage(first=false){page=doc.addPage([W,H]);tableActive=false;
  if(first){image(logo,L,24,224,55);text('Quotation '+q.number,L,92,19,bold);y=paragraph('Quotation Prepared By: '+(q.salesperson?.name||'Daniel Ovenden'),L,122,263,11,bold)+5;if(q.salesperson){if(q.salesperson.phone)y=paragraph('Phone: '+q.salesperson.phone,L,y,263,8.5)+2;y=paragraph('Email: '+q.salesperson.email,L,y,263,8.5)+2;}y+=10;}
  else{image(logo,L,21,130,32);right('Quotation '+q.number,R,26,14,bold);right('Continued',R,47,8,font,GRAY);rule(67);y=81;}
 }
 function header(){if(y+29>BODY_BOTTOM)newPage();rect(L,y,R-L,27,PALE);text('Image',L+7,y+8,8.5,bold);text('SKU',76,y+8,8.5,bold);text('Description',130,y+8,8.5,bold);right('Qty',407,y+8,8.5,bold);right('Unit Price',480,y+4,8.5,bold);right('(Ex GST)',480,y+15,7,font,GRAY);right('Subtotal',R-6,y+8,8.5,bold);y+=34;tableActive=true;}
 function room(height:number,table=false){if(y+height>BODY_BOTTOM){newPage();if(table)header();}}
 function flow(s:string,size=9,f:PDFFont=font,color=INK,width=R-L,x=L){for(const line of wrap(s,width,size,f)){room(size+4);text(line,x,y,size,f,color);y+=size+4;}}
 newPage(true);
 // The first page mirrors the supplied letterhead and customer panel.
 text('Quote To:',L,y,12,bold,BLUE);y+=21;
 const customer:[string,PDFFont][]=[[q.contact,bold],[q.company,font],[deliveryAddress(q),font],['Email: '+q.email,font]];
 if(q.vendorNumber?.trim())customer.push(['Vendor Number: '+q.vendorNumber,bold]);
 if(q.customerTerms?.trim())customer.push(['Customer terms: '+q.customerTerms,font]);
 if(q.reference?.trim())customer.push(['Customer reference: '+q.reference,font]);
 const customerHeight=Math.max(105,customer.reduce((sum,[s,f])=>sum+wrap(s,239,9,f).length*12+2,16));rect(L,y,263,customerHeight,WHITE,BLUE);let cy=y+9;
 for(const [s,f] of customer){cy=paragraph(s,L+11,cy,239,9,f)+2;}y+=customerHeight+8;
 const boxWidth=127;for(const [index,label,value] of [[0,'Quote Number',q.number],[1,'Date',numericDate(q.date)]] as const){const x=L+index*(boxWidth+9);rect(x,y,boxWidth,46,WHITE,BLUE);rect(x,y,boxWidth,21,BLUE);text(label,x+10,y+5,10,bold,WHITE);const size=value.length>19?8:11;text(value,x+10,y+28,size,bold);}const leftEnd=y+46;
 let ry=20;for(const [city,phone,address] of branches){right(city,R,ry,9,bold);ry+=12;right('Tel: '+phone,R,ry,8);ry+=11;for(const line of wrap(address,248,7.5)){right(line,R,ry,7.5);ry+=10;}ry+=8;}
 right('Email: sales@verdex.com.au',R,ry,8.5);ry+=12;right('Web: www.verdex.com.au',R,ry,8.5);link('https://www.verdex.com.au',395,ry,174,12);ry+=12;right('Verdex Equipment Pty Ltd',R,ry,8.5);ry+=12;right('ABN: 66 640 439 149',R,ry,8.5);ry+=18;
 const buttonTop=Math.max(ry,leftEnd-27);button(buttonTop);y=Math.max(leftEnd,buttonTop+27)+12;
 text('Valid until '+dateLabel(q.expiry)+'  |  All prices in AUD',L,y,8,font,GRAY);y+=20;
 header();
 function product(item:Item,optional=false){
  const lines:{s:string;f:PDFFont;size:number;color:ReturnType<typeof rgb>;target?:string}[]=[];
  for(const s of wrap(item.name,248,9,bold))lines.push({s,f:bold,size:9,color:INK});
  if(hasDiscount(item))lines.push({s:'Discount: '+discountLabel(item),f:bold,size:8,color:BLUE});
  if(optional)lines.push({s:'Optional - not included in total',f:italic,size:8,color:GRAY});
  else if(item.optional)lines.push({s:'Selected additional option',f:italic,size:8,color:GRAY});
  const target=safeLink(item.url);if(target)lines.push({s:'View product details on website',f:font,size:8,color:BLUE,target});
  if(item.note?.trim())for(const s of wrap('Note: '+item.note,248,8.5))lines.push({s,f:font,size:8.5,color:INK});
  const sku=wrap(item.sku,46,8),leading=12;
  const totalHeight=Math.max(62,lines.length*leading+16,sku.length*11+16);
  // Start a normal row together; exceptionally long notes continue with an explicit label.
  room(Math.min(totalHeight,300),true);let first=true;
  while(lines.length){
   const capacity=Math.max(1,Math.floor((BODY_BOTTOM-y-16)/leading));if(capacity<2){newPage();header();continue;}
   const part=lines.splice(0,capacity),height=Math.max(first?62:30,part.length*leading+16,first?sku.length*11+16:0);
   if(y+height>BODY_BOTTOM){newPage();header();lines.unshift(...part);continue;}
   if(first){const picture=pictures.get(lineKey(item));if(picture)image(picture,L+3,y+3,40,49);else{rect(L+3,y+6,38,40,PALE);text('No image',L+6,y+21,6.5,font,GRAY);}
    sku.forEach((s,n)=>text(s,76,y+9+n*11,8));right(String(item.qty),407,y+9,9);if(hasDiscount(item)){const original=money(item.price),originalWidth=font.widthOfTextAtSize(original,8);right(original,480,y+8,8,font,GRAY);rule(y+13,480-originalWidth,480,GRAY,.5);right(money(netUnitPrice(item)),480,y+22,9,bold);}else right(money(item.price),480,y+9,9);right(optional?'-':money(lineSubtotal(item)),R-6,y+9,9,bold);
   }else text('(continued)',76,y+8,7,font,GRAY);
   let rowY=y+7;for(const entry of part){text(entry.s,130,rowY,entry.size,entry.f,entry.color);if(entry.target)link(entry.target,130,rowY,Math.min(248,font.widthOfTextAtSize(entry.s,entry.size)),12);rowY+=leading;}
   y+=height;rule(y-3);first=false;if(lines.length){newPage();header();}
  }
 }
 const active=q.items.filter(i=>(!i.optional||i.selected)&&i.qty>0);
 for(const row of quoteRows({items:active,blocks:reanchorBlocks(q,active)})){
  if(row.kind==='product'){if(!tableActive)header();product(row.item);}
  else if(row.block.kind==='divider'){room(16,true);rule(y+4,L,R,BLUE);y+=16;}
  else{y+=3;flow(noteText(row.block.content),9);y+=10;tableActive=false;}
 }
 y+=12;tableActive=false;
 const comments=!shipping.pickup&&!shipping.ownFreight?(q.deliveryNotes||'').trim():'';
 const commentLines=wrap(comments,139,8);const extended=commentLines.length>10;
 if(extended){room(35);flow('COMMENTS',9,bold);flow(comments,8.5);y+=10;}
 const paymentOptions=[q.customerTerms?.trim()||'Account (subject to approval)','Direct Deposit','Visa, Mastercard or Amex'];
 const paymentHeight=10+15+paymentOptions.reduce((sum,s)=>sum+wrap('- '+s,174,8).length*11+1,0)+15+33+5;
 const panelHeight=Math.max(116,paymentHeight,extended?50:35+commentLines.length*10),finalHeight=panelHeight+74;
 room(finalHeight);const top=Math.max(y,BODY_BOTTOM-finalHeight);
 rule(top,L,R,BLUE,1);rule(top+2,L,R,BLUE,.4);
 let py=top+10;text('Payment Options',L+5,py,10,bold);py+=15;
 for(const option of paymentOptions){py=paragraph('- '+option,L+5,py,174,8)+1;}
 text('Bank Account Details',L+5,py+2,9,bold);py+=15;
 for(const line of ['Acc Name: Verdex Equipment Pty Ltd','Bank: Westpac','BSB: 032 080   Account #: 630470']){text(line,L+5,py,8);py+=11;}
 rect(216,top+8,150,panelHeight-8,WHITE,LINE);text('Comments',222,top+14,9,bold);let commentY=top+29;
 for(const s of extended?['See comments above.']:commentLines){text(s,222,commentY,8);commentY+=10;}
 const tx=373,tw=R-tx;rect(tx,top+8,tw,panelHeight-8,PALE);const t=totals(q),charges:[string,number][]=[['SubTotal',t.items],[shipping.pickup?'Pickup':shipping.ownFreight?'Own Freight':'Shipping and Handling',shipping.total],['GST (10%)',t.gst]];
 function summaryRow(label:string,value:number,rowTop:number,grand=false){
  const face=grand?bold:font,labelSize=grand?10:9,valueSize=grand?12:10,amount=money(value);
  // Reserve a real gap using embedded-font widths, including for large totals.
  const scale=Math.min(1,(tw-16-12)/(face.widthOfTextAtSize(label,labelSize)+face.widthOfTextAtSize(amount,valueSize)));
  text(label,tx+8,rowTop+(valueSize-labelSize)*scale,labelSize*scale,face);
  right(amount,R-8,rowTop,valueSize*scale,face);
 }
 charges.forEach(([label,value],i)=>summaryRow(label,value,top+14+i*19));
 rule(top+panelHeight-30,tx,R,BLUE,2);summaryRow('Total Incl GST',t.total,top+panelHeight-22,true);
 rule(top+panelHeight+5,L,R,BLUE,.7);text('Thank you for your enquiry. We look forward to servicing your requirements.',L,top+panelHeight+14,7.5,italic);text("Quotation is subject to Verdex's terms and conditions.",L,top+panelHeight+27,7.5);button(top+panelHeight+42,344,225);
 // Complete page numbering after pagination; every checkout link only opens the online quote.
 const pages=doc.getPages();pages.forEach((p,index)=>{page=p;rule(811);text('Quote Ref No. '+q.number,L,817,7.5);text(numericDate(q.date),275,817,7.5);right('Page '+(index+1)+' of '+pages.length,R,817,7.5);text('Test quotation - no live order or payment. Online quote access rules apply.',L,799,7,font,GRAY);});
 return doc.save();
}
