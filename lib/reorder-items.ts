import type {Item} from './quote';

export function reorderItems(items:Item[],sku:string,targetSku:string,position:'before'|'after'):Item[]{
 if(sku===targetSku)return items;
 const moving=items.find(i=>i.sku===sku);
 if(!moving||!items.some(i=>i.sku===targetSku))return items;
 const next=items.filter(i=>i.sku!==sku);
 const target=next.findIndex(i=>i.sku===targetSku);
 next.splice(target+(position==='after'?1:0),0,moving);
 return next;
}
