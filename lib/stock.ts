export const stockFields=[{key:'totalStock',label:'Total Stock'},{key:'committedStock',label:'Committed'},{key:'sydney',label:'NSW'},{key:'brisbane',label:'QLD'},{key:'melbourne',label:'VIC'}] as const;
export type StockLevels=Record<typeof stockFields[number]['key'],number|null>;
export const emptyStock=():StockLevels=>({totalStock:null,committedStock:null,melbourne:null,brisbane:null,sydney:null});
export const stockLabel=(value:number|null|undefined)=>value===null||value===undefined?'N/A':new Intl.NumberFormat('en-AU',{maximumFractionDigits:6}).format(value);
