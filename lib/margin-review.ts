import 'server-only';
import {getCosts} from './cost-data';
import {getCatalogue} from './catalogue-data';
import {normaliseSku} from './cost-source';
import {calculateMargins,type MarginItem} from './gross-profit';
export async function reviewMargins(items:MarginItem[]){
  const [costs,catalogue]=await Promise.all([getCosts(),getCatalogue()]);
  return calculateMargins(items,costs,new Set(catalogue.products.map(p=>normaliseSku(p.sku))));
}
